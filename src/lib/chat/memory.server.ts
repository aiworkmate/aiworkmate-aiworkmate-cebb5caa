// Long-term adaptive memory — the AI brain.
// Stores user preferences, habits, recurring topics. Self-improves via usage signals:
//   - frequency (auto-incremented when recalled)
//   - usefulness (boosted on reuse, decayed on staleness)
//   - last_used_at (drives recency ranking)
// All ops are best-effort; failures return safe defaults so the chat pipeline never breaks.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface MemoryEntry {
  id: string;
  content: string;
  category: string;
  pinned: boolean;
  confidence: number;
  frequency?: number;
  usefulness?: number;
}

/** Recall top memories by composite score, then bump frequency/last_used for the hits. */
export async function recallMemories(userId: string, limit = 8): Promise<MemoryEntry[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("memories")
      .select("id, content, category, pinned, confidence, frequency, usefulness")
      .eq("user_id", userId)
      .order("pinned", { ascending: false })
      .order("usefulness", { ascending: false })
      .order("frequency", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    const entries = data as MemoryEntry[];
    // Fire-and-forget: bump usage signal for recalled memories.
    if (entries.length) {
      const ids = entries.map((e) => e.id);
      void (async () => {
        try {
          // increment frequency + refresh last_used_at via RPC-less update loop
          await Promise.all(
            entries.map((e) =>
              supabaseAdmin
                .from("memories")
                .update({
                  frequency: (e.frequency ?? 1) + 1,
                  last_used_at: new Date().toISOString(),
                })
                .eq("id", e.id),
            ),
          );
        } catch { /* swallow */ }
        void ids;
      })();
    }
    return entries;
  } catch {
    return [];
  }
}

const MEMORY_KEYWORDS = [
  "i prefer", "i like", "i love", "i hate", "i want",
  "i always", "i never", "i usually", "i work as", "i am a",
  "remember that", "remember to", "call me", "my name is", "my preferred name is",
];

export function shouldStoreMemory(text: string): boolean {
  const t = (text ?? "").toLowerCase().trim();
  if (t.length < 5 || t.length > 500) return false;
  return MEMORY_KEYWORDS.some((k) => t.includes(k));
}

/** Store note. Merges duplicates by exact content (case-insensitive) to keep memory clean. */
export async function storeMemory(
  userId: string,
  content: string,
  category: string = "general",
  confidence: number = 0.7,
): Promise<void> {
  const trimmed = content.trim().slice(0, 500);
  if (!trimmed) return;
  if (!shouldStoreMemory(trimmed)) return;
  try {
    // Dedupe: if a near-identical memory already exists, just bump it instead of inserting.
    const { data: existing } = await supabaseAdmin
      .from("memories")
      .select("id, frequency, usefulness")
      .eq("user_id", userId)
      .ilike("content", trimmed)
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("memories")
        .update({
          frequency: ((existing as { frequency?: number }).frequency ?? 1) + 1,
          usefulness: Math.min(1, ((existing as { usefulness?: number }).usefulness ?? 0.5) + 0.05),
          last_used_at: new Date().toISOString(),
          confidence: Math.max(confidence, 0.7),
        })
        .eq("id", (existing as { id: string }).id);
      return;
    }

    await supabaseAdmin.from("memories").insert({
      user_id: userId,
      content: trimmed,
      category,
      confidence,
      pinned: false,
    });
  } catch {
    /* swallow */
  }
}

/** Boost usefulness for memories that were actually surfaced AND followed by a non-fallback reply. */
export async function reinforceMemories(memoryIds: string[]): Promise<void> {
  if (!memoryIds.length) return;
  try {
    const { data } = await supabaseAdmin
      .from("memories")
      .select("id, usefulness")
      .in("id", memoryIds);
    if (!data) return;
    await Promise.all(
      (data as { id: string; usefulness: number }[]).map((m) =>
        supabaseAdmin
          .from("memories")
          .update({ usefulness: Math.min(1, (m.usefulness ?? 0.5) + 0.03) })
          .eq("id", m.id),
      ),
    );
  } catch { /* swallow */ }
}

export function formatMemoriesForPrompt(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map((e) => `- (${e.category}${e.pinned ? ", pinned" : ""}) ${e.content}`);
  return `Known user context (use only if relevant, do not mention unless asked):\n${lines.join("\n")}`;
}

const PREF_PATTERNS = [
  /^(?:i (?:prefer|like|love|hate|always|never|usually|work as|am a)\b.{3,200})/i,
  /^(?:call me|my name is|my preferred name is)\b.{2,80}/i,
  /^(?:remember (?:that|to)\b.{3,200})/i,
];

export function extractPreference(text: string): string | null {
  const t = text.trim();
  for (const re of PREF_PATTERNS) {
    const m = t.match(re);
    if (m) return m[0].trim();
  }
  return null;
}
