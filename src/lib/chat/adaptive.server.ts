// Adaptive routing + behavior analytics.
// Records per-(intent, liveUsed) success/latency stats and lets the router
// consult past performance to bias its decisions over time.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ChatIntent } from "./router.server";

export interface RoutingPreference {
  preferLive: boolean | null; // null = no signal yet
  avgLatency: number;
  sampleSize: number;
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

/** Upsert routing stat after a response — rolling avg latency, success/failure counters. */
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

/** Append a behavior outcome row — fuel for future ML/analytics, cheap to write. */
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
