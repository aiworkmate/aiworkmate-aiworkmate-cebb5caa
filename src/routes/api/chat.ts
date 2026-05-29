// Server route — streams chat completions from Lovable AI Gateway.
//
// Stability layers (all on top of existing architecture; no rewrite):
//   1. Hard safety wrapper — every request goes through try/catch; never 5xx.
//   2. Smart router (strict JSON: intent / needsLiveData / needsMemory).
//   3. Live-data auto-trigger via web search when needsLiveData is true.
//   4. "Smarter over time" memory: recall on input, extract on output.
//   5. Parallel execution (router + memory + conv check + live search) for low latency,
//      plus a small in-process TTL cache for repeated live queries.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { routeMessage } from "@/lib/chat/router.server";
import { webSearch, type WebSearchResult } from "@/lib/chat/web-search.server";
import {
  recallMemories,
  storeMemory,
  formatMemoriesForPrompt,
  extractPreference,
  reinforceMemories,
  type MemoryEntry,
} from "@/lib/chat/memory.server";
import {
  recallRoutingPreference,
  recordRoutingOutcome,
  logResponseOutcome,
} from "@/lib/chat/adaptive.server";
import { liveDataCache } from "@/lib/chat/cache.server";
import { safe, metrics } from "@/lib/chat/safe.server";






const Body = z.object({
  conversationId: z.string().uuid(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().min(1).max(20000),
  })).min(1).max(50),
});

const FRIENDLY_FALLBACK = "Sorry, something went wrong. Please try again.";

type Stage =
  | "auth" | "validate" | "router" | "memory" | "tools"
  | "live" | "llm.request" | "llm.stream" | "persist";

function log(reqId: string, stage: Stage, status: "ok" | "warn" | "error", info: Record<string, unknown> = {}) {
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
  metrics.recordFallback(reason);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ delta: message, isFallback: true, reason })}\n\n`),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch { /* ignore */ } finally { controller.close(); }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { ...sseHeaders(), "X-Chat-Fallback": "1", "X-Chat-Fallback-Reason": reason },
  });
}
type Conv = { id: string; user_id: string; title: string; workspace_id: string | null; organization_id: string | null };

function makeUserClient(token: string): SupabaseClient<Database> | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function fetchConversation(sb: SupabaseClient<Database>, convId: string): Promise<Conv | null> {
  try {
    const { data } = await sb
      .from("conversations").select("id, user_id, title, workspace_id, organization_id")
      .eq("id", convId).maybeSingle();
    return (data as Conv | null) ?? null;
  } catch {
    return null;
  }
}

async function cachedWebSearch(query: string): Promise<WebSearchResult | null> {
  const key = query.trim().toLowerCase().slice(0, 300);
  const hit = liveDataCache.get(key) as WebSearchResult | null | undefined;
  if (hit !== undefined) return hit;
  const result = await webSearch(query);
  liveDataCache.set(key, result);
  return result;
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

          const sb = makeUserClient(token);
          if (!sb) {
            log(reqId, "auth", "error", { reason: "missing_supabase_env" });
            return gracefulStream(reqId, FRIENDLY_FALLBACK, "missing_supabase_env");
          }

          let userId: string;
          try {
            const { data: userData, error: userErr } = await sb.auth.getUser(token);
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

          const lastUser = [...parsed.messages].reverse().find((m) => m.role === "user");
          const lastUserText = lastUser?.content ?? "";

          // ── Stage: router (strict JSON contract; pure function, instant) ──
          const decision = routeMessage(lastUserText);
          log(reqId, "router", "ok", { ...decision });

          // ── Parallel: conv ownership + memory + routing pref + (optional) live data ──
          // Adaptive: routing preference learned from past outcomes can suppress live calls.
          const tParallel = Date.now();
          const [conv, memories, routingPref, liveEarly] = await Promise.all([
            safe(() => fetchConversation(sb, parsed.conversationId), null, "conv"),
            decision.needsMemory
              ? safe(() => recallMemories(userId, 8), [] as MemoryEntry[], "memory")
              : Promise.resolve<MemoryEntry[]>([]),
            safe(
              () => recallRoutingPreference(userId, decision.intent),
              { preferLive: null, avgLatency: 0, sampleSize: 0 },
              "routing_pref",
            ),
            decision.needsLiveData
              ? safe(() => cachedWebSearch(lastUserText), null as WebSearchResult | null, "live")
              : Promise.resolve<WebSearchResult | null>(null),
          ]);
          // Suppress live data when the user historically does better without it for this intent.
          const live = routingPref.preferLive === false ? null : liveEarly;
          log(reqId, "router", "ok", {
            adaptive: { preferLive: routingPref.preferLive, samples: routingPref.sampleSize },
          });

          log(reqId, "memory", "ok", { hits: memories.length });
          log(reqId, "live", live ? "ok" : "warn", {
            triggered: decision.needsLiveData,
            provider: live?.provider ?? null,
            sources: live?.sources.length ?? 0,
            ms: Date.now() - tParallel,
          });
          // Placeholder for the future tool layer.
          log(reqId, "tools", "ok", { invoked: 0 });

          if (!conv || conv.user_id !== userId) {
            log(reqId, "router", "warn", { reason: !conv ? "not_found" : "forbidden" });
            return gracefulStream(reqId, "This conversation is no longer available.", "conv_unavailable");
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            log(reqId, "llm.request", "error", { reason: "missing_api_key" });
            return gracefulStream(reqId, "The AI service is temporarily unavailable. Please try again shortly.", "no_api_key");
          }

          // Persist user message + auto-title + preference extraction.
          // ASYNC ONLY — fire-and-forget so DB latency never blocks time-to-first-token.
          if (lastUser) {
            const userContent = lastUser.content;
            const isNewConv = conv.title === "New conversation";
            void (async () => {
              try {
                await sb.from("messages").insert({
                  conversation_id: conv.id, user_id: userId, role: "user", content: userContent,
                  workspace_id: conv.workspace_id, organization_id: conv.organization_id,
                });
                if (isNewConv) {
                  await sb.from("conversations")
                    .update({ title: userContent.slice(0, 60).trim() }).eq("id", conv.id);
                }
                log(reqId, "persist", "ok", { kind: "user_message" });
              } catch (err) {
                log(reqId, "persist", "warn", { kind: "user_message", err: String(err) });
              }
            })();
            const pref = extractPreference(userContent);
            if (pref) void storeMemory(userId, pref, "preference", 0.85).catch(() => {});
          }

          // ── Assemble system context ─────────────────────────────────────
          const contextBlocks: string[] = [
            "You are AI WorkMate, a secure enterprise AI assistant. Be precise, structured, and professional. Use markdown. Never reveal chain-of-thought or internal tooling. Provide only the final answer.",
          ];
          const memBlock = formatMemoriesForPrompt(memories);
          if (memBlock) contextBlocks.push(memBlock);
          if (live) {
            const srcs = live.sources.length ? `\nSources: ${live.sources.join(", ")}` : "";
            contextBlocks.push(
              `Live web context for the user's latest question (use it to ground your answer; cite the sources):\n${live.summary}${srcs}`,
            );
          }
          const systemPrompt = { role: "system" as const, content: contextBlocks.join("\n\n") };

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
              body: JSON.stringify({ model, stream: true, messages: [systemPrompt, ...parsed.messages] }),
              signal: controller.signal,
            });
            clearTimeout(timeout);
            log(reqId, "llm.request", upstream.ok ? "ok" : "warn", {
              model, status: upstream.status, ms: Date.now() - llmStart,
              intent: decision.intent, liveUsed: !!live, memUsed: memories.length,
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

          // ── Stage: llm.stream — typed SSE events + token deltas ─────────
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          let assembled = "";
          const convId = conv.id;
          const convWorkspaceId = conv.workspace_id;
          const convOrganizationId = conv.organization_id;
          const memoryIds = memories.map((m) => m.id);

          const send = (controller: ReadableStreamDefaultController, event: Record<string, unknown>) => {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            } catch { /* closed */ }
          };

          const stream = new ReadableStream({
            async start(controller) {
              // ── Prelude events: tell the client what we did before the LLM call ──
              send(controller, { type: "state", phase: "thinking", reqId });
              if (decision.needsLiveData) {
                send(controller, {
                  type: "tool",
                  name: "web_search",
                  status: live ? "done" : "skipped",
                  sources: live?.sources ?? [],
                  provider: live?.provider ?? null,
                });
                if (live && live.sources.length) {
                  send(controller, { type: "sources", sources: live.sources, provider: live.provider });
                }
              }
              if (memories.length) {
                send(controller, { type: "memory", used: memories.length, ids: memoryIds });
              }
              send(controller, { type: "state", phase: "generating" });

              const reader = upstream.body!.getReader();
              let buffer = "";
              let firstTokenAt: number | null = null;
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
                    if (payload === "[DONE]") continue;
                    try {
                      const json = JSON.parse(payload);
                      const delta = json.choices?.[0]?.delta?.content ?? "";
                      if (delta) {
                        if (firstTokenAt === null) {
                          firstTokenAt = Date.now();
                          log(reqId, "llm.stream", "ok", { ttftMs: firstTokenAt - t0 });
                        }
                        assembled += delta;
                        // `delta` key kept for legacy clients; `type: "token"` is canonical.
                        send(controller, { type: "token", delta });
                      }
                    } catch { /* keepalive — ignore */ }
                  }
                }
                log(reqId, "llm.stream", "ok", { chars: assembled.length, ms: Date.now() - llmStart });
              } catch (err) {
                log(reqId, "llm.stream", "error", { err: String(err), assembledChars: assembled.length });
                if (!assembled) {
                  send(controller, {
                    type: "token", delta: FRIENDLY_FALLBACK,
                    isFallback: true, reason: "stream_failed",
                  });
                }
              } finally {
                let assistantMessageId: string | null = null;
                if (assembled.trim()) {
                  try {
                    const { data: inserted } = await sb.from("messages").insert({
                      conversation_id: convId, user_id: userId, role: "assistant", content: assembled,
                      workspace_id: convWorkspaceId, organization_id: convOrganizationId,
                    }).select("id").single();
                    assistantMessageId = (inserted as { id: string } | null)?.id ?? null;
                    await sb.from("conversations")
                      .update({ updated_at: new Date().toISOString() }).eq("id", convId);
                    log(reqId, "persist", "ok", { kind: "assistant_message", chars: assembled.length });
                  } catch (err) {
                    log(reqId, "persist", "warn", { kind: "assistant_message", err: String(err) });
                  }
                }
                // ── Adaptive: record outcome + reinforce memories used ──
                const totalMs = Date.now() - t0;
                const success = assembled.trim().length > 0;
                void recordRoutingOutcome({
                  userId, intent: decision.intent, liveUsed: !!live,
                  success, latencyMs: totalMs,
                }).catch(() => {});
                void logResponseOutcome({
                  userId, conversationId: convId, intent: decision.intent,
                  liveUsed: !!live, memoryHits: memories.length,
                  latencyMs: totalMs, chars: assembled.length, wasFallback: !success,
                }).catch(() => {});
                if (success && memories.length) {
                  void reinforceMemories(memoryIds).catch(() => {});
                }
                send(controller, {
                  type: "done",
                  messageId: assistantMessageId,
                  memoryIds,
                  intent: decision.intent,
                  liveUsed: !!live,
                  ttfbMs: firstTokenAt ? firstTokenAt - t0 : null,
                  totalMs,
                });
                try { controller.enqueue(encoder.encode("data: [DONE]\n\n")); } catch { /* closed */ }
                log(reqId, "llm.stream", "ok", { closed: true, totalMs });
                try { controller.close(); } catch { /* already closed */ }
              }
            },
          });


          return new Response(stream, {
            status: 200,
            headers: {
              ...sseHeaders(),
              "X-Request-Id": reqId,
              "X-Chat-Intent": decision.intent,
              "X-Chat-Live": decision.needsLiveData ? "1" : "0",
              "X-Chat-Memory": String(memories.length),
            },
          });
        } catch (err) {
          log(reqId, "llm.stream", "error", { unhandled: true, err: String(err) });
          return gracefulStream(reqId, FRIENDLY_FALLBACK, "unhandled");
        }
      },
    },
  },
});
