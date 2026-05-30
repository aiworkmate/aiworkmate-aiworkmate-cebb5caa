// Phase 2 — Memory quality & context health.
// Read-only server fn that derives stats from existing tables (no schema change).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface MemoryRow {
  id: string;
  content: string;
  category: string;
  pinned: boolean;
  confidence: number;
  frequency: number | null;
  usefulness: number | null;
  last_used_at: string | null;
  updated_at: string | null;
  created_at: string | null;
}

export interface CategoryStat {
  category: string;
  count: number;
  avgUsefulness: number;
  avgConfidence: number;
  avgFrequency: number;
}

export interface ContextHealth {
  totalMemories: number;
  pinned: number;
  archived: number;
  byCategory: CategoryStat[];
  avgUsefulness: number;
  avgConfidence: number;
  retrievalCoverage: number; // % of memories used at least once
  recentlyReinforced: number; // used in last 7 days
  compressedConversations: number;
  totalConversations: number;
  totalMessages: number;
  feedbackHelpfulRatio: number | null;
  feedbackCount: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export const getContextHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ContextHealth> => {
    const { supabase, userId } = context;

    const [memRes, convRes, msgRes, summRes, feedRes] = await Promise.all([
      supabase.from("memories")
        .select("id, category, pinned, confidence, frequency, usefulness, last_used_at")
        .eq("user_id", userId),
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("conversations").select("id", { count: "exact", head: true })
        .eq("user_id", userId).not("summary", "is", null),
      supabase.from("memory_feedback").select("helpful").eq("user_id", userId).limit(500),
    ]);

    type M = {
      category: string; pinned: boolean; confidence: number;
      frequency: number | null; usefulness: number | null; last_used_at: string | null;
    };
    const memories = (memRes.data ?? []) as M[];
    const total = memories.length;
    const pinned = memories.filter((m) => m.pinned).length;
    const archived = memories.filter((m) => m.category === "archived").length;
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    const used = memories.filter((m) => (m.frequency ?? 0) > 0).length;
    const recent = memories.filter((m) => m.last_used_at && new Date(m.last_used_at).getTime() > sevenDaysAgo).length;

    const groups = new Map<string, M[]>();
    for (const m of memories) {
      const k = m.category || "general";
      groups.set(k, [...(groups.get(k) ?? []), m]);
    }
    const byCategory: CategoryStat[] = [...groups.entries()].map(([category, rows]) => {
      const avg = (key: keyof M) => {
        const vals = rows.map((r) => Number(r[key] ?? 0)).filter((n) => Number.isFinite(n));
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      };
      return {
        category,
        count: rows.length,
        avgUsefulness: clamp01(avg("usefulness")),
        avgConfidence: clamp01(avg("confidence")),
        avgFrequency: avg("frequency"),
      };
    }).sort((a, b) => b.count - a.count);

    const avgUsefulness = total
      ? memories.reduce((s, m) => s + Number(m.usefulness ?? 0), 0) / total
      : 0;
    const avgConfidence = total
      ? memories.reduce((s, m) => s + Number(m.confidence ?? 0), 0) / total
      : 0;

    const feedback = (feedRes.data ?? []) as { helpful: boolean }[];
    const helpful = feedback.filter((f) => f.helpful).length;
    const feedbackHelpfulRatio = feedback.length ? helpful / feedback.length : null;

    return {
      totalMemories: total,
      pinned,
      archived,
      byCategory,
      avgUsefulness: clamp01(avgUsefulness),
      avgConfidence: clamp01(avgConfidence),
      retrievalCoverage: total ? used / total : 0,
      recentlyReinforced: recent,
      compressedConversations: summRes.count ?? 0,
      totalConversations: convRes.count ?? 0,
      totalMessages: msgRes.count ?? 0,
      feedbackHelpfulRatio,
      feedbackCount: feedback.length,
    };
  });
