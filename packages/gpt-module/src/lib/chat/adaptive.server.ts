// Adaptive routing, behavior analytics, and personalized user learning.
// Uses existing `routing_stats`, `response_outcomes`, and `profiles.settings` storage.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { ChatIntent } from "./router.server";

export interface RoutingPreference {
  preferLive: boolean | null;
  avgLatency: number;
  sampleSize: number;
}

export interface AdaptiveProfile {
  preferredLength: "concise" | "balanced" | "detailed";
  communicationStyle: "direct" | "structured" | "technical";
  responseCount: number;
  avgResponseChars: number;
  memoryEffectiveness: number;
  liveDataEffectiveness: number;
  toolEffectiveness: Record<string, number>;
  recurringTopics: Array<{ topic: string; count: number; lastUsedAt: string }>;
  activeProjects: Array<{ name: string; count: number; lastUsedAt: string }>;
  lastQualityScore: number;
  updatedAt: string;
}

const DEFAULT_PROFILE: AdaptiveProfile = {
  preferredLength: "balanced",
  communicationStyle: "structured",
  responseCount: 0,
  avgResponseChars: 0,
  memoryEffectiveness: 0.55,
  liveDataEffectiveness: 0.55,
  toolEffectiveness: { web_search: 0.55 },
  recurringTopics: [],
  activeProjects: [],
  lastQualityScore: 0.5,
  updatedAt: new Date(0).toISOString(),
};

const TOPIC_STOP_WORDS = new Set([
  "about", "after", "again", "because", "before", "build", "change", "could", "from", "have",
  "make", "more", "need", "please", "should", "that", "their", "there", "these", "this",
  "with", "what", "when", "where", "which", "would", "your", "the", "and", "for", "are",
]);

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeProfile(value: unknown): AdaptiveProfile {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<AdaptiveProfile>;
  return {
    preferredLength: raw.preferredLength === "concise" || raw.preferredLength === "detailed" ? raw.preferredLength : "balanced",
    communicationStyle: raw.communicationStyle === "direct" || raw.communicationStyle === "technical" ? raw.communicationStyle : "structured",
    responseCount: Math.max(0, Math.round(safeNumber(raw.responseCount, 0))),
    avgResponseChars: Math.max(0, Math.round(safeNumber(raw.avgResponseChars, 0))),
    memoryEffectiveness: clamp01(safeNumber(raw.memoryEffectiveness, 0.55)),
    liveDataEffectiveness: clamp01(safeNumber(raw.liveDataEffectiveness, 0.55)),
    toolEffectiveness: raw.toolEffectiveness && typeof raw.toolEffectiveness === "object" && !Array.isArray(raw.toolEffectiveness)
      ? Object.fromEntries(Object.entries(raw.toolEffectiveness).map(([k, v]) => [k, clamp01(safeNumber(v, 0.55))]))
      : { web_search: 0.55 },
    recurringTopics: Array.isArray(raw.recurringTopics) ? raw.recurringTopics.slice(0, 12).map((t) => ({
      topic: String((t as { topic?: unknown }).topic ?? "").slice(0, 80),
      count: Math.max(1, Math.round(safeNumber((t as { count?: unknown }).count, 1))),
      lastUsedAt: String((t as { lastUsedAt?: unknown }).lastUsedAt ?? new Date(0).toISOString()),
    })).filter((t) => t.topic) : [],
    activeProjects: Array.isArray(raw.activeProjects) ? raw.activeProjects.slice(0, 10).map((p) => ({
      name: String((p as { name?: unknown }).name ?? "").slice(0, 80),
      count: Math.max(1, Math.round(safeNumber((p as { count?: unknown }).count, 1))),
      lastUsedAt: String((p as { lastUsedAt?: unknown }).lastUsedAt ?? new Date(0).toISOString()),
    })).filter((p) => p.name) : [],
    lastQualityScore: clamp01(safeNumber(raw.lastQualityScore, 0.5)),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date(0).toISOString(),
  };
}

async function getProfileSettings(userId: string): Promise<Record<string, unknown>> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();
  const settings = (data?.settings && typeof data.settings === "object" && !Array.isArray(data.settings))
    ? data.settings as Record<string, unknown>
    : {};
  return settings;
}

function extractTopics(text: string, max = 5): string[] {
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)) {
    const word = raw.trim();
    if (word.length < 4 || TOPIC_STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([topic]) => topic);
}

function extractProjects(text: string): string[] {
  const found = new Set<string>();
  for (const name of ["AI WorkMate", "BIM Explorer"]) {
    if (new RegExp(`\\b${name.replace(/ /g, "\\s+")}\\b`, "i").test(text)) found.add(name);
  }
  const projectMatch = text.match(/\b(?:project|app|platform|business|venture|initiative)\s+(?:called|named)?\s*([A-Z][A-Za-z0-9 -]{2,50})/);
  if (projectMatch?.[1]) found.add(projectMatch[1].trim());
  return [...found].slice(0, 5);
}

function mergeSignals<T extends { count: number; lastUsedAt: string }>(
  existing: T[],
  values: string[],
  key: keyof T,
  now: string,
  max: number,
): T[] {
  const rows = [...existing];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const current = rows.find((row) => String(row[key]).toLowerCase() === normalized.toLowerCase());
    if (current) {
      current.count += 1;
      current.lastUsedAt = now;
    } else {
      rows.push({ [key]: normalized, count: 1, lastUsedAt: now } as T);
    }
  }
  return rows.sort((a, b) => b.count - a.count || b.lastUsedAt.localeCompare(a.lastUsedAt)).slice(0, max);
}

function inferPreferredLength(userText: string, current: AdaptiveProfile["preferredLength"]): AdaptiveProfile["preferredLength"] {
  if (/\b(short|brief|concise|quick|summary|tl;?dr)\b/i.test(userText)) return "concise";
  if (/\b(detailed|deep|thorough|complete|step by step|explain)\b/i.test(userText)) return "detailed";
  return current;
}

function inferStyle(userText: string, current: AdaptiveProfile["communicationStyle"]): AdaptiveProfile["communicationStyle"] {
  if (/\b(code|technical|developer|backend|api|database|debug)\b/i.test(userText)) return "technical";
  if (/\b(direct|straight|no fluff|just tell me)\b/i.test(userText)) return "direct";
  if (/\b(plan|steps|checklist|structured|organized)\b/i.test(userText)) return "structured";
  return current;
}

function estimateQuality(params: {
  success: boolean;
  wasFallback: boolean;
  latencyMs: number;
  chars: number;
  memoryHits: number;
  liveUsed: boolean;
}) {
  let score = params.success ? 0.55 : 0.15;
  if (!params.wasFallback) score += 0.12;
  if (params.chars >= 120 && params.chars <= 4500) score += 0.12;
  if (params.latencyMs < 8000) score += 0.08;
  if (params.memoryHits > 0) score += 0.06;
  if (params.liveUsed) score += 0.04;
  return clamp01(score);
}

/** Look up whether live data has been historically helpful for this intent & user. */
export async function recallRoutingPreference(
  userId: string,
  intent: ChatIntent,
): Promise<RoutingPreference> {
  try {
    const { data } = await supabaseAdmin
      .from("routing_stats")
      .select("live_used, success_count, failure_count, avg_latency_ms")
      .eq("user_id", userId)
      .eq("intent", intent);
    if (!data || data.length === 0) return { preferLive: null, avgLatency: 0, sampleSize: 0 };
    type Row = { live_used: boolean; success_count: number; failure_count: number; avg_latency_ms: number };
    const rows = data as Row[];
    const liveRow = rows.find((r) => r.live_used);
    const noLiveRow = rows.find((r) => !r.live_used);
    const score = (r?: Row) =>
      r ? r.success_count / Math.max(1, r.success_count + r.failure_count) : 0;
    const liveScore = score(liveRow);
    const noLiveScore = score(noLiveRow);
    const sampleSize = rows.reduce((s, r) => s + r.success_count + r.failure_count, 0);
    if (sampleSize < 3) return { preferLive: null, avgLatency: 0, sampleSize };
    const preferLive =
      Math.abs(liveScore - noLiveScore) < 0.1 ? null : liveScore > noLiveScore;
    const avgLatency = Math.round(
      rows.reduce((s, r) => s + r.avg_latency_ms * (r.success_count + r.failure_count), 0) /
        Math.max(1, sampleSize),
    );
    return { preferLive, avgLatency, sampleSize };
  } catch {
    return { preferLive: null, avgLatency: 0, sampleSize: 0 };
  }
}

export async function recallAdaptiveProfile(userId: string): Promise<AdaptiveProfile> {
  try {
    const settings = await getProfileSettings(userId);
    return sanitizeProfile(settings.aiLearning);
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function formatAdaptiveProfileForPrompt(profile: AdaptiveProfile): string {
  const topics = profile.recurringTopics.slice(0, 5).map((t) => t.topic).join(", ");
  const projects = profile.activeProjects.slice(0, 5).map((p) => p.name).join(", ");
  const lines = [
    `Preferred answer length: ${profile.preferredLength}`,
    `Communication style: ${profile.communicationStyle}`,
    topics ? `Recurring topics: ${topics}` : "",
    projects ? `Active projects: ${projects}` : "",
    `Memory effectiveness score: ${profile.memoryEffectiveness.toFixed(2)}`,
    `Live-data effectiveness score: ${profile.liveDataEffectiveness.toFixed(2)}`,
  ].filter(Boolean);
  return `Adaptive user profile. Use this to tune tone, detail, and context selection without mentioning it.\n${lines.join("\n")}`;
}

/** Upsert routing stat after a response: rolling avg latency, success/failure counters. */
export async function recordRoutingOutcome(params: {
  userId: string;
  intent: ChatIntent;
  liveUsed: boolean;
  success: boolean;
  latencyMs: number;
}): Promise<void> {
  const { userId, intent, liveUsed, success, latencyMs } = params;
  try {
    const { data: existing } = await supabaseAdmin
      .from("routing_stats")
      .select("id, success_count, failure_count, avg_latency_ms")
      .eq("user_id", userId)
      .eq("intent", intent)
      .eq("live_used", liveUsed)
      .maybeSingle();

    if (existing) {
      const e = existing as { id: string; success_count: number; failure_count: number; avg_latency_ms: number };
      const total = e.success_count + e.failure_count;
      const newAvg = Math.round((e.avg_latency_ms * total + latencyMs) / (total + 1));
      await supabaseAdmin
        .from("routing_stats")
        .update({
          success_count: e.success_count + (success ? 1 : 0),
          failure_count: e.failure_count + (success ? 0 : 1),
          avg_latency_ms: newAvg,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", e.id);
    } else {
      await supabaseAdmin.from("routing_stats").insert({
        user_id: userId,
        intent,
        live_used: liveUsed,
        success_count: success ? 1 : 0,
        failure_count: success ? 0 : 1,
        avg_latency_ms: latencyMs,
      });
    }
  } catch { /* swallow */ }
}

/** Append a behavior outcome row. */
export async function logResponseOutcome(params: {
  userId: string;
  conversationId: string;
  intent: ChatIntent;
  liveUsed: boolean;
  memoryHits: number;
  latencyMs: number;
  chars: number;
  wasFallback: boolean;
}): Promise<void> {
  try {
    await supabaseAdmin.from("response_outcomes").insert({
      user_id: params.userId,
      conversation_id: params.conversationId,
      intent: params.intent,
      live_used: params.liveUsed,
      memory_hits: params.memoryHits,
      latency_ms: params.latencyMs,
      chars: params.chars,
      was_fallback: params.wasFallback,
    });
  } catch { /* swallow */ }
}

export async function recordAdaptiveLearning(params: {
  userId: string;
  userText: string;
  assistantText: string;
  intent: ChatIntent;
  liveUsed: boolean;
  memoryHits: number;
  toolNames: string[];
  latencyMs: number;
  wasFallback: boolean;
}): Promise<void> {
  try {
    const now = new Date().toISOString();
    const settings = await getProfileSettings(params.userId);
    const current = sanitizeProfile(settings.aiLearning);
    const chars = params.assistantText.length;
    const success = chars > 0 && !params.wasFallback;
    const responseCount = current.responseCount + 1;
    const avgResponseChars = Math.round((current.avgResponseChars * current.responseCount + chars) / Math.max(1, responseCount));
    const quality = estimateQuality({
      success,
      wasFallback: params.wasFallback,
      latencyMs: params.latencyMs,
      chars,
      memoryHits: params.memoryHits,
      liveUsed: params.liveUsed,
    });
    const memoryDelta = params.memoryHits > 0 ? (success ? 0.025 : -0.04) : -0.005;
    const liveDelta = params.liveUsed ? (success && params.latencyMs < 9000 ? 0.025 : -0.05) : 0.002;
    const toolEffectiveness = { ...current.toolEffectiveness };
    for (const tool of params.toolNames) {
      toolEffectiveness[tool] = clamp01((toolEffectiveness[tool] ?? 0.55) + (success ? 0.025 : -0.05));
    }

    const next: AdaptiveProfile = {
      preferredLength: inferPreferredLength(params.userText, current.preferredLength),
      communicationStyle: inferStyle(params.userText, current.communicationStyle),
      responseCount,
      avgResponseChars,
      memoryEffectiveness: clamp01(current.memoryEffectiveness + memoryDelta),
      liveDataEffectiveness: clamp01(current.liveDataEffectiveness + liveDelta),
      toolEffectiveness,
      recurringTopics: mergeSignals(current.recurringTopics, extractTopics(params.userText), "topic", now, 12),
      activeProjects: mergeSignals(current.activeProjects, extractProjects(`${params.userText}\n${params.assistantText}`), "name", now, 10),
      lastQualityScore: quality,
      updatedAt: now,
    };

    await supabaseAdmin
      .from("profiles")
      .update({ settings: { ...settings, aiLearning: next } as Json })
      .eq("user_id", params.userId);
  } catch { /* swallow */ }
}
