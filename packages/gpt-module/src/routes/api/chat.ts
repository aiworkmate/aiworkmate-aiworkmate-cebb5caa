// Server route - streams chat completions from Lovable AI Gateway.
// Stability layers stay on top of the existing architecture: auth, strict routing,
// memory, live data, streaming, persistence, adaptive learning, and admin controls.
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
  extractMemoryCandidates,
  persistMemoryCandidates,
  recordMemoryUseOutcome,
  type MemoryEntry,
} from "@/lib/chat/memory.server";
import {
  recallRoutingPreference,
  recordRoutingOutcome,
  logResponseOutcome,
  recallAdaptiveProfile,
  formatAdaptiveProfileForPrompt,
  recordAdaptiveLearning,
} from "@/lib/chat/adaptive.server";
import { liveDataCache } from "@/lib/chat/cache.server";
import { safe, metrics } from "@/lib/chat/safe.server";
import { requestChatCompletion } from "@/lib/chat/model.server";
import { getAiControlForUser, type AiControlSettings } from "@/lib/admin/ai-control.server";

const Body = z.object({
  conversationId: z.string().uuid(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().min(1).max(20000),
  })).min(1).max(50),
});

const FRIENDLY_FALLBACK = "Sorry, something went wrong. Please try again.";
const LIVE_OPTIONAL_GATE_MS = 700;
const LIVE_REQUIRED_GATE_MS = 5200;
const LIVE_OPTIONAL_PROVIDER_TIMEOUT_MS = 1800;
const LIVE_REQUIRED_PROVIDER_TIMEOUT_MS = 2500;
const DEFAULT_AI_CONTROL: AiControlSettings = {
  modelOverride: null,
  systemOverride: null,
  forceLiveData: false,
  forceMemory: false,
};

type Stage =
  | "auth" | "validate" | "router" | "memory" | "tools"
  | "live" | "llm.request" | "llm.stream" | "persist";

type Conv = {
  id: string;
  user_id: string;
  title: string;
  workspace_id: string | null;
  organization_id: string | null;
};

const LIVE_REQUIRED_PATTERNS = [
  /\b(today|tonight|right now|currently|latest|breaking|news|what(?:'s| is) happening)\b/i,
  /\b(price|trading at|stock|stocks|bitcoin|btc|crypto|weather|forecast|score|scores|standings|who won)\b/i,
  /\b(nba|nfl|nhl|mlb|epl|premier league|game|match)\b.*\b(latest|today|tonight|score|won|result)\b/i,
];

function isLiveRequiredQuery(text: string): boolean {
  return LIVE_REQUIRED_PATTERNS.some((re) => re.test(text));
}

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
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: message, isFallback: true, reason })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch { /* ignore */ } finally { controller.close(); }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { ...sseHeaders(), "X-Chat-Fallback": "1", "X-Chat-Fallback-Reason": reason },
  });
}

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
      .from("conversations")
      .select("id, user_id, title, workspace_id, organization_id")
      .eq("id", convId)
      .maybeSingle();
    return (data as Conv | null) ?? null;
  } catch {
    return null;
  }
}

async function cachedWebSearch(query: string, timeoutMs = LIVE_REQUIRED_PROVIDER_TIMEOUT_MS): Promise<WebSearchResult | null> {
  const key = query.trim().toLowerCase().slice(0, 300);
  const hit = liveDataCache.get(key) as WebSearchResult | undefined;
  if (hit !== undefined) return hit;
  const result = await webSearch(query, timeoutMs);
  if (result) liveDataCache.set(key, result);
  return result;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const reqId = crypto.randomUUID();
        const t0 = Date.now();
        try {
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
          let userEmail: string | null = null;
          try {
            const { data: userData, error: userErr } = await sb.auth.getUser(token);
            if (userErr || !userData.user) {
              log(reqId, "auth", "warn", { reason: "invalid_token", err: userErr?.message });
              return gracefulStream(reqId, "Your session expired. Please sign in again.", "invalid_token");
            }
            userId = userData.user.id;
            userEmail = userData.user.email ?? null;
            log(reqId, "auth", "ok", { userId });
          } catch (err) {
            log(reqId, "auth", "error", { err: String(err) });
            return gracefulStream(reqId, FRIENDLY_FALLBACK, "auth_exception");
          }

          const aiControl = await safe(
            () => getAiControlForUser(userId, { email: userEmail ?? undefined, sub: userId }),
            DEFAULT_AI_CONTROL,
            "admin_control",
          );

          let parsed: z.infer<typeof Body>;
          try {
            parsed = Body.parse(await request.json());
            log(reqId, "validate", "ok", { conversationId: parsed.conversationId, messageCount: parsed.messages.length });
          } catch (err) {
            log(reqId, "validate", "error", { err: String(err) });
            return gracefulStream(reqId, "That message couldn't be processed. Please try again.", "bad_input");
          }

          const lastUser = [...parsed.messages].reverse().find((m) => m.role === "user");
          const lastUserText = lastUser?.content ?? "";
          const decision = routeMessage(lastUserText);
          const liveRequired = decision.needsLiveData && isLiveRequiredQuery(lastUserText);
          const needsLiveData = decision.needsLiveData || aiControl.forceLiveData;
          const needsMemory = decision.needsMemory || aiControl.forceMemory;
          log(reqId, "router", "ok", {
            ...decision,
            needsLiveData,
            needsMemory,
            liveRequired,
            adminControl: {
              modelOverride: Boolean(aiControl.modelOverride),
              systemOverride: Boolean(aiControl.systemOverride),
              forceLiveData: aiControl.forceLiveData,
              forceMemory: aiControl.forceMemory,
            },
          });

          const tParallel = Date.now();
          const [conv, memories, routingPref, adaptiveProfile] = await Promise.all([
            safe(() => fetchConversation(sb, parsed.conversationId), null, "conv"),
            needsMemory
              ? safe(() => recallMemories(userId, 8, lastUserText), [] as MemoryEntry[], "memory")
              : Promise.resolve<MemoryEntry[]>([]),
            safe(
              () => recallRoutingPreference(userId, decision.intent),
              { preferLive: null, avgLatency: 0, sampleSize: 0 },
              "routing_pref",
            ),
            safe(() => recallAdaptiveProfile(userId), null, "adaptive_profile"),
          ]);

          const liveAllowedByProfile = liveRequired || !adaptiveProfile || adaptiveProfile.liveDataEffectiveness >= 0.18 || aiControl.forceLiveData;
          const shouldAttemptLive = needsLiveData && liveAllowedByProfile && (liveRequired || routingPref.preferLive !== false || aiControl.forceLiveData);
          const liveGateMs = liveRequired ? LIVE_REQUIRED_GATE_MS : LIVE_OPTIONAL_GATE_MS;
          const liveProviderTimeoutMs = liveRequired ? LIVE_REQUIRED_PROVIDER_TIMEOUT_MS : LIVE_OPTIONAL_PROVIDER_TIMEOUT_MS;
          const livePromise: Promise<WebSearchResult | null> = shouldAttemptLive
            ? safe(() => cachedWebSearch(lastUserText, liveProviderTimeoutMs), null as WebSearchResult | null, "live")
            : Promise.resolve<WebSearchResult | null>(null);
          const liveEarly = shouldAttemptLive
            ? await Promise.race<WebSearchResult | null>([
                livePromise,
                new Promise<null>((r) => setTimeout(() => r(null), liveGateMs)),
              ])
            : null;
          const live = routingPref.preferLive === false && !liveRequired && !aiControl.forceLiveData ? null : liveEarly;
          const liveDeferred = shouldAttemptLive && !liveEarly && !liveRequired;

          log(reqId, "router", "ok", { adaptive: { preferLive: routingPref.preferLive, samples: routingPref.sampleSize } });
          log(reqId, "memory", "ok", { hits: memories.length });
          log(reqId, "live", live ? "ok" : "warn", {
            triggered: needsLiveData,
            required: liveRequired,
            attempted: shouldAttemptLive,
            allowedByProfile: liveAllowedByProfile,
            gateMs: liveGateMs,
            providerTimeoutMs: liveProviderTimeoutMs,
            provider: live?.provider ?? null,
            sources: live?.sources.length ?? 0,
            injected: Boolean(live),
            deferred: liveDeferred,
            ms: Date.now() - tParallel,
          });
          log(reqId, "tools", "ok", { invoked: shouldAttemptLive ? 1 : 0 });

          if (!conv || conv.user_id !== userId) {
            log(reqId, "router", "warn", { reason: !conv ? "not_found" : "forbidden" });
            return gracefulStream(reqId, "This conversation is no longer available.", "conv_unavailable");
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            log(reqId, "llm.request", "error", { reason: "missing_api_key" });
            return gracefulStream(reqId, "The AI service is temporarily unavailable. Please try again shortly.", "no_api_key");
          }

          if (lastUser) {
            const userContent = lastUser.content;
            const isNewConv = conv.title === "New conversation";
            void (async () => {
              try {
                await sb.from("messages").insert({
                  conversation_id: conv.id,
                  user_id: userId,
                  role: "user",
                  content: userContent,
                  workspace_id: conv.workspace_id,
                  organization_id: conv.organization_id,
                });
                if (isNewConv) {
                  await sb.from("conversations").update({ title: userContent.slice(0, 60).trim() }).eq("id", conv.id);
                }
                log(reqId, "persist", "ok", { kind: "user_message" });
              } catch (err) {
                log(reqId, "persist", "warn", { kind: "user_message", err: String(err) });
              }
            })();
            const pref = extractPreference(userContent);
            if (pref) void storeMemory(userId, pref, "preference", 0.85).catch(() => {});
            const candidates = extractMemoryCandidates(userContent);
            if (candidates.length) void persistMemoryCandidates(userId, candidates).catch(() => {});
          }

          const contextBlocks: string[] = [
            aiControl.systemOverride || "You are AI WorkMate, a secure enterprise AI assistant. Be precise, structured, and professional. Use markdown. Never reveal chain-of-thought or internal tooling. Use available memory only when relevant. Cite live-data sources when provided. If live web context is provided, treat it as current data and do not claim you lack live access. Adapt answer length and style to the user's learned preferences. Provide only the final answer.",
          ];
          if (adaptiveProfile) contextBlocks.push(formatAdaptiveProfileForPrompt(adaptiveProfile));
          const memBlock = formatMemoriesForPrompt(memories);
          if (memBlock) contextBlocks.push(memBlock);
          if (live) {
            const srcs = live.sources.length ? `\nSources: ${live.sources.join(", ")}` : "";
            contextBlocks.push(`Live web context for the user's latest question (use it to ground your answer; cite the sources):\n${live.summary}${srcs}`);
          } else if (liveRequired) {
            contextBlocks.push(
              "Live web context was required and the live-data system was attempted before this model call, but no usable Tavily or SerpAPI result returned within the bounded latency budget. Do not claim the product has no live-data system; say the live lookup did not return usable results and ask the user to retry if current data is essential.",
            );
          }
          const systemPrompt = { role: "system" as const, content: contextBlocks.join("\n\n") };

          let upstream: Response;
          let model = "unknown";
          let attemptedModels: string[] = [];
          const llmStart = Date.now();
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 60_000);
            try {
              const result = await requestChatCompletion({
                apiKey,
                messages: [systemPrompt, ...parsed.messages],
                signal: controller.signal,
                preferredModels: aiControl.modelOverride ? [aiControl.modelOverride] : [],
              });
              upstream = result.response;
              model = result.model;
              attemptedModels = result.attemptedModels;
            } finally {
              clearTimeout(timeout);
            }
            log(reqId, "llm.request", upstream.ok ? "ok" : "warn", {
              model,
              attemptedModels,
              status: upstream.status,
              ms: Date.now() - llmStart,
              intent: decision.intent,
              liveRequired,
              liveAttempted: shouldAttemptLive,
              liveInjected: Boolean(live),
              liveUsed: !!live,
              memUsed: memories.length,
            });
          } catch (err) {
            log(reqId, "llm.request", "error", { model, err: String(err), ms: Date.now() - llmStart });
            return gracefulStream(reqId, FRIENDLY_FALLBACK, "upstream_fetch_failed");
          }

          if (!upstream.ok || !upstream.body) {
            const txt = await upstream.text().catch(() => "");
            log(reqId, "llm.request", "error", { model, status: upstream.status, body: txt.slice(0, 500) });
            if (upstream.status === 429) {
              return gracefulStream(reqId, "The AI service is busy right now. Please try again in a moment.", "rate_limited");
            }
            if (upstream.status === 402) {
              return gracefulStream(reqId, "AI usage limit reached. Please contact your administrator.", "payment_required");
            }
            return gracefulStream(reqId, FRIENDLY_FALLBACK, `upstream_${upstream.status}`);
          }

          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          let assembled = "";
          const convId = conv.id;
          const convWorkspaceId = conv.workspace_id;
          const convOrganizationId = conv.organization_id;
          const memoryIds = memories.map((m) => m.id);
          let seq = 0;
          const send = (controller: ReadableStreamDefaultController, payload: Record<string, unknown>) => {
            try {
              const env = { v: 1, requestId: reqId, seq: seq++, ts: Date.now(), ...payload };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(env)}\n\n`));
            } catch { /* closed */ }
          };

          const stream = new ReadableStream({
            async start(controller) {
              send(controller, { type: "state", phase: "thinking" });
              if (needsLiveData) {
                send(controller, {
                  type: "tool",
                  name: "web_search",
                  status: live ? "done" : liveDeferred ? "start" : "skipped",
                  sources: live?.sources ?? [],
                  provider: live?.provider ?? null,
                  required: liveRequired,
                });
                if (live?.sources.length) send(controller, { type: "sources", sources: live.sources, provider: live.provider });
              }
              if (memories.length) send(controller, { type: "memory", used: memories.length, ids: memoryIds });
              send(controller, { type: "state", phase: "generating" });

              let progressiveSources: string[] = [];
              if (liveDeferred) {
                void livePromise.then((late) => {
                  if (!late?.sources.length) {
                    send(controller, { type: "tool", name: "web_search", status: "skipped", required: liveRequired });
                    return;
                  }
                  progressiveSources = late.sources;
                  send(controller, { type: "tool", name: "web_search", status: "done", sources: late.sources, provider: late.provider, required: liveRequired });
                  send(controller, { type: "sources", sources: late.sources, provider: late.provider });
                }).catch(() => {});
              }

              const reader = upstream.body!.getReader();
              let buffer = "";
              let firstTokenAt: number | null = null;
              let errorStage: string | undefined;
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
                      if (!delta) continue;
                      if (firstTokenAt === null) {
                        firstTokenAt = Date.now();
                        console.log("[chat:telemetry:ttft]", {
                          requestId: reqId,
                          ttftMs: firstTokenAt - t0,
                          model,
                          intent: decision.intent,
                          liveRequired,
                          usedLive: !!live,
                          memoryCount: memories.length,
                        });
                      }
                      assembled += delta;
                      send(controller, { type: "token", delta });
                    } catch { /* keepalive */ }
                  }
                }
                log(reqId, "llm.stream", "ok", { chars: assembled.length, ms: Date.now() - llmStart });
              } catch (err) {
                errorStage = "llm";
                log(reqId, "llm.stream", "error", { err: String(err), assembledChars: assembled.length });
                if (!assembled) {
                  send(controller, { type: "token", delta: FRIENDLY_FALLBACK, isFallback: true, reason: "stream_failed" });
                }
              } finally {
                let assistantMessageId: string | null = null;
                if (assembled.trim()) {
                  try {
                    const { data: inserted } = await sb.from("messages").insert({
                      conversation_id: convId,
                      user_id: userId,
                      role: "assistant",
                      content: assembled,
                      model,
                      workspace_id: convWorkspaceId,
                      organization_id: convOrganizationId,
                    }).select("id").single();
                    assistantMessageId = (inserted as { id: string } | null)?.id ?? null;
                    await sb.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
                    log(reqId, "persist", "ok", { kind: "assistant_message", chars: assembled.length });
                  } catch (err) {
                    if (!errorStage) errorStage = "persist";
                    log(reqId, "persist", "warn", { kind: "assistant_message", err: String(err) });
                  }
                }

                const totalMs = Date.now() - t0;
                const success = assembled.trim().length > 0;
                const toolNames = shouldAttemptLive ? ["web_search"] : [];
                void recordRoutingOutcome({ userId, intent: decision.intent, liveUsed: !!live, success, latencyMs: totalMs }).catch(() => {});
                void logResponseOutcome({
                  userId,
                  conversationId: convId,
                  intent: decision.intent,
                  liveUsed: !!live,
                  memoryHits: memories.length,
                  latencyMs: totalMs,
                  chars: assembled.length,
                  wasFallback: !success,
                }).catch(() => {});
                void recordMemoryUseOutcome(memoryIds, {
                  success,
                  wasFallback: !success,
                  responseChars: assembled.length,
                }).catch(() => {});
                void recordAdaptiveLearning({
                  userId,
                  userText: lastUserText,
                  assistantText: assembled,
                  intent: decision.intent,
                  liveUsed: !!live || progressiveSources.length > 0,
                  memoryHits: memories.length,
                  toolNames,
                  latencyMs: totalMs,
                  wasFallback: !success,
                }).catch(() => {});
                if (success) {
                  const candidates = extractMemoryCandidates(lastUserText, assembled);
                  if (candidates.length) void persistMemoryCandidates(userId, candidates).catch(() => {});
                }
                send(controller, {
                  type: "done",
                  messageId: assistantMessageId,
                  memoryIds,
                  intent: decision.intent,
                  liveRequired,
                  liveUsed: !!live || progressiveSources.length > 0,
                  sources: live?.sources ?? progressiveSources,
                  ttfbMs: firstTokenAt ? firstTokenAt - t0 : null,
                  totalMs,
                });
                console.log("[chat:telemetry:done]", {
                  requestId: reqId,
                  ttftMs: firstTokenAt ? firstTokenAt - t0 : null,
                  totalMs,
                  model,
                  liveRequired,
                  usedLive: !!live || progressiveSources.length > 0,
                  memoryCount: memories.length,
                  fallbackUsed: !success,
                  errorStage,
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
              "X-Chat-Live": needsLiveData ? "1" : "0",
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
