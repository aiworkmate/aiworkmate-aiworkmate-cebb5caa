// Long-term adaptive memory - the AI brain.
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

// Daily decay multiplier - usefulness slowly fades when memories aren't reused.
// Applied per recall against `last_used_at`, so it self-corrects without a cron job.
const DAILY_DECAY = 0.995;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "because", "before", "being", "could", "from",
  "have", "into", "just", "like", "more", "need", "only", "over", "please", "should",
  "that", "their", "there", "these", "this", "with", "what", "when", "where", "which",
  "while", "would", "your", "you", "the", "and", "for", "are", "but", "not",
]);

function terms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && !STOP_WORDS.has(t)),
  );
}

function relevanceScore(memory: MemoryEntry, queryTerms: Set<string>): number {
  if (queryTerms.size === 0) return 0;
  const memoryTerms = terms(`${memory.category} ${memory.content}`);
  let hits = 0;
  for (const t of queryTerms) if (memoryTerms.has(t)) hits++;
  return hits / Math.max(1, queryTerms.size);
}

/** Recall top memories by composite score, then bump frequency/last_used and decay usefulness. */
export async function recallMemories(userId: string, limit = 8, query = ""): Promise<MemoryEntry[]> {
  try {
    const candidateLimit = Math.min(Math.max(limit * 4, 16), 40);
    const { data, error } = await supabaseAdmin
      .from("memories")
      .select("id, content, category, pinned, confidence, frequency, usefulness, last_used_at, updated_at")
      .eq("user_id", userId)
      .order("pinned", { ascending: false })
      .order("usefulness", { ascending: false })
      .order("frequency", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(candidateLimit);
    if (error || !data) return [];
    const entries = data as (MemoryEntry & { last_used_at?: string; updated_at?: string })[];
    const queryTerms = terms(query);
    const now = Date.now();
    const ranked = entries
      .map((e) => {
        const lastUsed = e.last_used_at ? new Date(e.last_used_at).getTime() : now;
        const daysIdle = Math.max(0, (now - lastUsed) / 86_400_000);
        const usefulness = clamp01((e.usefulness ?? 0.5) * Math.pow(DAILY_DECAY, daysIdle));
        const recency = clamp01(1 / (1 + daysIdle / 14));
        const frequency = Math.min(1, Math.log1p(e.frequency ?? 0) / Math.log(20));
        const relevance = relevanceScore(e, queryTerms);
        const score = (e.pinned ? 0.35 : 0) + usefulness * 0.3 + relevance * 0.25 + frequency * 0.06 + recency * 0.04;
        return { entry: e, usefulness, score, relevance };
      })
      .filter((r) => r.entry.pinned || queryTerms.size === 0 || r.relevance > 0 || (r.entry.usefulness ?? 0) >= 0.75)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Fire-and-forget: bump usage signal + apply daily decay on the recalled rows.
    if (ranked.length) {
      void (async () => {
        try {
          await Promise.all(
            ranked.map(({ entry, usefulness }) =>
              supabaseAdmin
                .from("memories")
                .update({
                  frequency: (entry.frequency ?? 1) + 1,
                  usefulness,
                  last_used_at: new Date(now).toISOString(),
                })
                .eq("id", entry.id),
            ),
          );
        } catch { /* swallow */ }
      })();
    }
    return ranked.map((r) => ({ ...r.entry, usefulness: r.usefulness }));
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
          usefulness: clamp01(((existing as { usefulness?: number }).usefulness ?? 0.5) + 0.05),

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
          .update({ usefulness: clamp01((m.usefulness ?? 0.5) + 0.03) })
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
