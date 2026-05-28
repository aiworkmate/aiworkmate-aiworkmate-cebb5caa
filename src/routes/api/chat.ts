// Server route — streams chat completions from Lovable AI Gateway.
// The browser only renders the stream. All orchestration happens here.
//
// Hard guarantee: this endpoint NEVER returns a 5xx and NEVER throws to the
// client. Any internal failure is converted into a graceful SSE stream that
// emits a single friendly delta + [DONE], so the chat UI always shows a reply.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Body = z.object({
  conversationId: z.string().uuid(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().min(1).max(20000),
  })).min(1).max(50),
});

const FRIENDLY_FALLBACK = "Sorry, something went wrong. Please try again.";

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
}

function gracefulStream(message: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: message })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch {
        /* ignore */
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { status: 200, headers: sseHeaders() });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization") ?? "";
          const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
          if (!token) return gracefulStream("Your session expired. Please sign in again.");

          let userId: string;
          try {
            const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
            if (userErr || !userData.user) {
              return gracefulStream("Your session expired. Please sign in again.");
            }
            userId = userData.user.id;
          } catch (err) {
            console.error("[chat] auth lookup failed:", err);
            return gracefulStream(FRIENDLY_FALLBACK);
          }

          let parsed: z.infer<typeof Body>;
          try {
            parsed = Body.parse(await request.json());
          } catch (err) {
            console.error("[chat] invalid input:", err);
            return gracefulStream("That message couldn't be processed. Please try again.");
          }

          // Verify conversation ownership (best-effort; failure → graceful)
          let conv: { id: string; user_id: string; title: string } | null = null;
          try {
            const { data } = await supabaseAdmin
              .from("conversations").select("id, user_id, title")
              .eq("id", parsed.conversationId).maybeSingle();
            conv = data as typeof conv;
          } catch (err) {
            console.error("[chat] conversation lookup failed:", err);
          }
          if (!conv || conv.user_id !== userId) {
            return gracefulStream("This conversation is no longer available.");
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            console.error("[chat] LOVABLE_API_KEY missing");
            return gracefulStream("The AI service is temporarily unavailable. Please try again shortly.");
          }

          // Persist the latest user message (best-effort)
          const lastUser = [...parsed.messages].reverse().find((m) => m.role === "user");
          if (lastUser) {
            try {
              await supabaseAdmin.from("messages").insert({
                conversation_id: conv.id, user_id: userId, role: "user", content: lastUser.content,
              });
              if (conv.title === "New conversation") {
                const newTitle = lastUser.content.slice(0, 60).trim();
                await supabaseAdmin.from("conversations").update({ title: newTitle }).eq("id", conv.id);
              }
            } catch (err) {
              console.error("[chat] persist user message failed:", err);
              // continue — we still want to attempt the AI call
            }
          }

          const systemPrompt = {
            role: "system" as const,
            content:
              "You are AI WorkMate, a secure enterprise AI assistant. Be precise, structured, and professional. Use markdown. Never reveal chain-of-thought or internal tooling. Provide only the final answer.",
          };

          // Upstream AI call with timeout
          let upstream: Response;
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 60_000);
            upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                stream: true,
                messages: [systemPrompt, ...parsed.messages],
              }),
              signal: controller.signal,
            });
            clearTimeout(timeout);
          } catch (err) {
            console.error("[chat] upstream fetch failed:", err);
            return gracefulStream(FRIENDLY_FALLBACK);
          }

          if (!upstream.ok || !upstream.body) {
            const txt = await upstream.text().catch(() => "");
            console.error(`[chat] upstream error ${upstream.status}: ${txt}`);
            if (upstream.status === 429) {
              return gracefulStream("The AI service is busy right now. Please try again in a moment.");
            }
            if (upstream.status === 402) {
              return gracefulStream("AI usage limit reached. Please contact your administrator.");
            }
            return gracefulStream(FRIENDLY_FALLBACK);
          }

          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          let assembled = "";

          const convId = conv.id;
          const stream = new ReadableStream({
            async start(controller) {
              const reader = upstream.body!.getReader();
              let buffer = "";
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buffer += decoder.decode(value, { stream: true });
                  let idx;
                  while ((idx = buffer.indexOf("\n")) !== -1) {
                    const line = buffer.slice(0, idx).trim();
                    buffer = buffer.slice(idx + 1);
                    if (!line.startsWith("data:")) continue;
                    const payload = line.slice(5).trim();
                    if (payload === "[DONE]") {
                      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                      continue;
                    }
                    try {
                      const json = JSON.parse(payload);
                      const delta = json.choices?.[0]?.delta?.content ?? "";
                      if (delta) {
                        assembled += delta;
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
                      }
                    } catch {
                      /* ignore non-JSON keepalives */
                    }
                  }
                }
              } catch (err) {
                console.error("[chat] stream read failed:", err);
                if (!assembled) {
                  try {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ delta: FRIENDLY_FALLBACK })}\n\n`),
                    );
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  } catch {
                    /* ignore */
                  }
                }
              } finally {
                // Persist assistant message (best-effort)
                if (assembled.trim()) {
                  try {
                    await supabaseAdmin.from("messages").insert({
                      conversation_id: convId, user_id: userId, role: "assistant", content: assembled,
                    });
                    await supabaseAdmin.from("conversations")
                      .update({ updated_at: new Date().toISOString() }).eq("id", convId);
                  } catch (err) {
                    console.error("[chat] persist assistant message failed:", err);
                  }
                }
                try { controller.close(); } catch { /* already closed */ }
              }
            },
          });

          return new Response(stream, { status: 200, headers: sseHeaders() });
        } catch (err) {
          // Last-resort guard — should never fire, but guarantees no 500.
          console.error("[chat] unhandled error:", err);
          return gracefulStream(FRIENDLY_FALLBACK);
        }
      },
    },
  },
});
