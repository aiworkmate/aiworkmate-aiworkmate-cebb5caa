// Server route — streams chat completions from Lovable AI Gateway.
// The browser only renders the stream. All orchestration happens here.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createMiddleware } from "@tanstack/react-start";

const Body = z.object({
  conversationId: z.string().uuid(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().min(1).max(20000),
  })).min(1).max(50),
});

// Adapt requireSupabaseAuth (server-fn middleware) into a request-middleware-like guard inline.
// Simpler approach: validate JWT via Supabase admin client directly.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        let parsed;
        try { parsed = Body.parse(await request.json()); }
        catch { return new Response("Invalid input", { status: 400 }); }

        // Verify conversation ownership
        const { data: conv } = await supabaseAdmin
          .from("conversations").select("id, user_id, title")
          .eq("id", parsed.conversationId).maybeSingle();
        if (!conv || conv.user_id !== userId) return new Response("Forbidden", { status: 403 });

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("AI gateway not configured", { status: 503 });

        // Persist the latest user message (last in array)
        const lastUser = [...parsed.messages].reverse().find((m) => m.role === "user");
        if (lastUser) {
          await supabaseAdmin.from("messages").insert({
            conversation_id: conv.id, user_id: userId, role: "user", content: lastUser.content,
          });
          // Auto-title from first message if still default
          if (conv.title === "New conversation") {
            const newTitle = lastUser.content.slice(0, 60).trim();
            await supabaseAdmin.from("conversations").update({ title: newTitle }).eq("id", conv.id);
          }
        }

        const systemPrompt = {
          role: "system" as const,
          content:
            "You are AI WorkMate, a secure enterprise AI assistant. Be precise, structured, and professional. Use markdown. Never reveal chain-of-thought or internal tooling. Provide only the final answer.",
        };

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        });

        if (!upstream.ok || !upstream.body) {
          const txt = await upstream.text().catch(() => "");
          return new Response(`Upstream error: ${upstream.status} ${txt}`, { status: 502 });
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let assembled = "";

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
                  if (payload === "[DONE]") { controller.enqueue(encoder.encode("data: [DONE]\n\n")); continue; }
                  try {
                    const json = JSON.parse(payload);
                    const delta = json.choices?.[0]?.delta?.content ?? "";
                    if (delta) {
                      assembled += delta;
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
                    }
                  } catch { /* ignore non-JSON keepalives */ }
                }
              }
            } catch (err) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`));
            } finally {
              // Persist assistant message
              if (assembled.trim()) {
                await supabaseAdmin.from("messages").insert({
                  conversation_id: conv.id, user_id: userId, role: "assistant", content: assembled,
                });
                await supabaseAdmin.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conv.id);
              }
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
