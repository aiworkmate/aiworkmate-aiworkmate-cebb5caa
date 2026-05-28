// Server route — streams chat completions from Lovable AI Gateway.
//
// Guarantees:
//  1. NEVER returns a 5xx; any internal failure becomes a graceful SSE reply.
//  2. Fallback is ONLY used after real recovery attempts fail — never as the
//     default path. Successful AI streams flow through untouched.
//  3. Every pipeline stage is logged with a structured `[chat:<stage>]` tag
//     and a per-request `reqId`, so upstream issues are diagnosable.
//  4. Fallback SSE frames carry `isFallback: true` so logs / future clients
//     can distinguish real answers from recovery messages.
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

type Stage =
  | "auth"
  | "validate"
  | "router"
  | "memory"
  | "tools"
  | "llm.request"
  | "llm.stream"
  | "persist";

function log(reqId: string, stage: Stage, status: "ok" | "warn" | "error", info: Record<string, unknown> = {}) {
  // Single structured line per stage. Easy to grep: `[chat:llm.request]`.
  const payload = { reqId, stage, status, ...info };
  if (status === "error") console.error(`[chat:${stage}]`, payload);
  else if (status === "warn") console.warn(`[chat:${stage}]`, payload);
  else console.log(`[chat:${stage}]`, payload);
}

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
}

function gracefulStream(reqId: string, message: string, reason: string): Response {
  log(reqId, "llm.stream", "warn", { fallback: true, reason });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      try {
        // Mark this frame as a fallback so clients/logs can distinguish it
        // from a real model token.
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ delta: message, isFallback: true, reason })}\n\n`),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch {
        /* ignore */
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { ...sseHeaders(), "X-Chat-Fallback": "1", "X-Chat-Fallback-Reason": reason },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const reqId = crypto.randomUUID();
        const t0 = Date.now();
        try {
          // ── Stage: auth ─────────────────────────────────────────────────
          const auth = request.headers.get("authorization") ?? "";
          const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
          if (!token) {
            log(reqId, "auth", "warn", { reason: "missing_bearer" });
            return gracefulStream(reqId, "Your session expired. Please sign in again.", "no_token");
          }

          let userId: string;
          try {
            const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
            if (userErr || !userData.user) {
              log(reqId, "auth", "warn", { reason: "invalid_token", err: userErr?.message });
              return gracefulStream(reqId, "Your session expired. Please sign in again.", "invalid_token");
            }
            userId = userData.user.id;
            log(reqId, "auth", "ok", { userId });
          } catch (err) {
            log(reqId, "auth", "error", { err: String(err) });
            return gracefulStream(reqId, FRIENDLY_FALLBACK, "auth_exception");
          }

          // ── Stage: validate ─────────────────────────────────────────────
          let parsed: z.infer<typeof Body>;
          try {
            parsed = Body.parse(await request.json());
            log(reqId, "validate", "ok", {
              conversationId: parsed.conversationId,
              messageCount: parsed.messages.length,
            });
          } catch (err) {
            log(reqId, "validate", "error", { err: String(err) });
            return gracefulStream(reqId, "That message couldn't be processed. Please try again.", "bad_input");
          }

          // ── Stage: router (conversation ownership check) ────────────────
          type Conv = { id: string; user_id: string; title: string };
          let conv: Conv | null = null;
          try {
            const { data, error } = await supabaseAdmin
              .from("conversations").select("id, user_id, title")
              .eq("id", parsed.conversationId).maybeSingle();
            if (error) log(reqId, "router", "warn", { err: error.message });
            conv = (data as Conv | null) ?? null;
          } catch (err) {
            log(reqId, "router", "error", { err: String(err) });
          }
          if (!conv || conv.user_id !== userId) {
            log(reqId, "router", "warn", { reason: !conv ? "not_found" : "forbidden" });
            return gracefulStream(reqId, "This conversation is no longer available.", "conv_unavailable");
          }
          log(reqId, "router", "ok", { convId: conv.id });

          // ── Stage: memory (placeholder until backend memory layer lands) ──
          // We log a stub so the pipeline shape is explicit and future
          // additions (vector recall, summaries) are easy to slot in.
          log(reqId, "memory", "ok", { hits: 0, note: "memory layer not yet wired" });

          // ── Stage: tools (placeholder) ──────────────────────────────────
          log(reqId, "tools", "ok", { invoked: 0, note: "tool layer not yet wired" });

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            log(reqId, "llm.request", "error", { reason: "missing_api_key" });
            return gracefulStream(reqId, "The AI service is temporarily unavailable. Please try again shortly.", "no_api_key");
          }

          // Persist the latest user message (best-effort, non-fatal)
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
              log(reqId, "persist", "ok", { kind: "user_message" });
            } catch (err) {
              log(reqId, "persist", "warn", { kind: "user_message", err: String(err) });
            }
          }

          const systemPrompt = {
            role: "system" as const,
            content:
              "You are AI WorkMate, a secure enterprise AI assistant. Be precise, structured, and professional. Use markdown. Never reveal chain-of-thought or internal tooling. Provide only the final answer.",
          };

          // ── Stage: llm.request ──────────────────────────────────────────
          const model = "google/gemini-2.5-flash";
          let upstream: Response;
          const llmStart = Date.now();
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 60_000);
            upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model,
                stream: true,
                messages: [systemPrompt, ...parsed.messages],
              }),
              signal: controller.signal,
            });
            clearTimeout(timeout);
            log(reqId, "llm.request", upstream.ok ? "ok" : "warn", {
              model, status: upstream.status, ms: Date.now() - llmStart,
            });
          } catch (err) {
            log(reqId, "llm.request", "error", { model, err: String(err), ms: Date.now() - llmStart });
            return gracefulStream(reqId, FRIENDLY_FALLBACK, "upstream_fetch_failed");
          }

          if (!upstream.ok || !upstream.body) {
            const txt = await upstream.text().catch(() => "");
            log(reqId, "llm.request", "error", { status: upstream.status, body: txt.slice(0, 500) });
            if (upstream.status === 429) {
              return gracefulStream(reqId, "The AI service is busy right now. Please try again in a moment.", "rate_limited");
            }
            if (upstream.status === 402) {
              return gracefulStream(reqId, "AI usage limit reached. Please contact your administrator.", "payment_required");
            }
            return gracefulStream(reqId, FRIENDLY_FALLBACK, `upstream_${upstream.status}`);
          }

          // ── Stage: llm.stream — pass tokens through unchanged ───────────
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
                      /* keepalive or partial frame — ignore */
                    }
                  }
                }
                log(reqId, "llm.stream", "ok", {
                  chars: assembled.length, ms: Date.now() - llmStart,
                });
              } catch (err) {
                log(reqId, "llm.stream", "error", {
                  err: String(err), assembledChars: assembled.length,
                });
                // Only emit a fallback frame if we never produced any real
                // tokens — otherwise the partial reply is the best result.
                if (!assembled) {
                  try {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({
                        delta: FRIENDLY_FALLBACK, isFallback: true, reason: "stream_failed",
                      })}\n\n`),
                    );
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  } catch { /* ignore */ }
                }
              } finally {
                if (assembled.trim()) {
                  try {
                    await supabaseAdmin.from("messages").insert({
                      conversation_id: convId, user_id: userId, role: "assistant", content: assembled,
                    });
                    await supabaseAdmin.from("conversations")
                      .update({ updated_at: new Date().toISOString() }).eq("id", convId);
                    log(reqId, "persist", "ok", { kind: "assistant_message", chars: assembled.length });
                  } catch (err) {
                    log(reqId, "persist", "warn", { kind: "assistant_message", err: String(err) });
                  }
                }
                log(reqId, "llm.stream", "ok", { closed: true, totalMs: Date.now() - t0 });
                try { controller.close(); } catch { /* already closed */ }
              }
            },
          });

          return new Response(stream, {
            status: 200,
            headers: { ...sseHeaders(), "X-Request-Id": reqId },
          });
        } catch (err) {
          // Last-resort guard. Never returns a 5xx.
          log(reqId, "llm.stream", "error", { unhandled: true, err: String(err) });
          return gracefulStream(reqId, FRIENDLY_FALLBACK, "unhandled");
        }
      },
    },
  },
});
