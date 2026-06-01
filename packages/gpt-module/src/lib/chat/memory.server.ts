// Long-term adaptive memory engine.
// Uses the existing `memories` table and strengthens behavior through category-aware
// extraction, ranking, reinforcement, and cleanup. All operations are best-effort.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type MemoryCategory = "identity" | "preference" | "project" | "knowledge" | "interaction" | "general";

export interface MemoryEntry {
  id: string;
  content: string;
  category: string;
  pinned: boolean;
  confidence: number;
  frequency?: number;
  usefulness?: number;
}

export interface MemoryCandidate {
  content: string;
  category: MemoryCategory;
  confidence: number;
  usefulness: number;
}

const DAILY_DECAY = 0.995;
const CATEGORY_WEIGHT: Record<string, number> = {
  identity: 0.16,
  project: 0.14,
  preference: 0.12,
  knowledge: 0.08,
  interaction: 0.06,
  general: 0,
};
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "because", "before", "being", "could", "from",
  "have", "into", "just", "like", "more", "need", "only", "over", "please", "should",
  "that", "their", "there", "these", "this", "with", "what", "when", "where", "which",
  "while", "would", "your", "you", "the", "and", "for", "are", "but", "not", "can",
  "will", "make", "want", "need", "using", "than", "then", "them", "they", "our",
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

function normalizeContent(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 500);
}

function relevanceScore(memory: MemoryEntry, queryTerms: Set<string>): number {
  if (queryTerms.size === 0) return 0;
  const memoryTerms = terms(`${memory.category} ${memory.content}`);
  let hits = 0;
  for (const t of queryTerms) if (memoryTerms.has(t)) hits++;
  return hits / Math.max(1, queryTerms.size);
}

function addCandidate(
  candidates: MemoryCandidate[],
  content: string | null | undefined,
  category: MemoryCategory,
  confidence: number,
  usefulness: number,
) {
  const normalized = normalizeContent(content ?? "");
  if (normalized.length < 8 || normalized.length > 500) return;
  if (candidates.some((c) => c.content.toLowerCase() === normalized.toLowerCase())) return;
  candidates.push({ content: normalized, category, confidence: clamp01(confidence), usefulness: clamp01(usefulness) });
}

function sentenceMatches(text: string, patterns: RegExp[], max = 3): string[] {
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+|;\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const matches: string[] = [];
  for (const sentence of sentences) {
    if (matches.length >= max) break;
    if (sentence.length > 260) continue;
    if (patterns.some((re) => re.test(sentence))) matches.push(sentence);
  }
  return matches;
}

export function extractMemoryCandidates(userText: string, assistantText = ""): MemoryCandidate[] {
  const text = normalizeContent(userText);
  const combined = `${text}\n${normalizeContent(assistantText)}`;
  const candidates: MemoryCandidate[] = [];

  for (const sentence of sentenceMatches(text, [
    /\b(call me|my name is|my preferred name is)\b/i,
    /\b(i work as|i am a|i'm a|my role is|my company is)\b/i,
  ])) {
    addCandidate(candidates, sentence, "identity", 0.9, 0.82);
  }

  for (const sentence of sentenceMatches(text, [
    /\b(i prefer|i like|i love|i hate|i usually|i always|i never)\b/i,
    /\b(prefer .*format|keep .*short|be concise|give me steps|use bullets|use markdown)\b/i,
    /\b(favorite tool|preferred workflow|workflow preference)\b/i,
  ], 4)) {
    addCandidate(candidates, sentence, "preference", 0.84, 0.78);
  }

  const knownProjects = ["AI WorkMate", "BIM Explorer"];
  for (const project of knownProjects) {
    if (new RegExp(`\\b${project.replace(/ /g, "\\s+")}\\b`, "i").test(combined)) {
      addCandidate(candidates, `Project memory: ${project} is an important ongoing initiative.`, "project", 0.78, 0.76);
    }
  }
  for (const sentence of sentenceMatches(text, [
    /\b(project|app|platform|startup|business|venture|initiative|long-term goal)\b/i,
    /\b(i am building|i'm building|we are building|working on|roadmap|phase)\b/i,
  ], 4)) {
    if (/\b(project|app|platform|startup|business|venture|initiative|goal|building|roadmap|phase)\b/i.test(sentence)) {
      addCandidate(candidates, sentence, "project", 0.76, 0.72);
    }
  }

  for (const sentence of sentenceMatches(text, [
    /\b(remember that|important context|key fact|keep in mind)\b/i,
    /\b(works best when|does not work when|the rule is|constraint is)\b/i,
  ], 3)) {
    addCandidate(candidates, sentence, "knowledge", 0.74, 0.68);
  }

  for (const sentence of sentenceMatches(text, [
    /\b(i often ask|i usually ask|we often|common request|repeat this workflow|next time)\b/i,
  ], 2)) {
    addCandidate(candidates, sentence, "interaction", 0.68, 0.62);
  }

  return candidates.slice(0, 8);
}

/** Recall top memories by composite score, then bump frequency/last_used and decay usefulness. */
export async function recallMemories(userId: string, limit = 8, query = ""): Promise<MemoryEntry[]> {
  try {
    const candidateLimit = Math.min(Math.max(limit * 6, 24), 60);
    const { data, error } = await supabaseAdmin
      .from("memories")
      .select("id, content, category, pinned, confidence, frequency, usefulness, last_used_at, updated_at")
      .eq("user_id", userId)
      .neq("category", "archived")
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
        const confidence = clamp01(e.confidence ?? 0.7);
        const recency = clamp01(1 / (1 + daysIdle / 14));
        const frequency = Math.min(1, Math.log1p(e.frequency ?? 0) / Math.log(25));
        const relevance = relevanceScore(e, queryTerms);
        const category = CATEGORY_WEIGHT[e.category] ?? 0;
        const score =
          (e.pinned ? 0.35 : 0) +
          usefulness * 0.26 +
          confidence * 0.14 +
          relevance * 0.27 +
          frequency * 0.06 +
          recency * 0.05 +
          category;
        return { entry: e, usefulness, score, relevance };
      })
      .filter((r) =>
        r.entry.pinned ||
        queryTerms.size === 0 ||
        r.relevance > 0 ||
        ["identity", "project", "preference"].includes(r.entry.category) ||
        (r.entry.usefulness ?? 0) >= 0.78,
      )
      .sort((a, b) => b.score - a.score);

    const selected: typeof ranked = [];
    const perCategory = new Map<string, number>();
    for (const row of ranked) {
      if (selected.length >= limit) break;
      const category = row.entry.category || "general";
      const count = perCategory.get(category) ?? 0;
      const cap = row.entry.pinned ? limit : category === "identity" || category === "project" ? 3 : 4;
      if (count >= cap && row.relevance < 0.2) continue;
      selected.push(row);
      perCategory.set(category, count + 1);
    }

    if (selected.length) {
      void (async () => {
        try {
          await Promise.all(
            selected.map(({ entry, usefulness }) =>
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
    return selected.map((r) => ({ ...r.entry, usefulness: r.usefulness }));
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
  usefulness: number = 0.65,
): Promise<void> {
  const trimmed = normalizeContent(content);
  if (!trimmed) return;
  if (category === "general" && !shouldStoreMemory(trimmed)) return;
  try {
    const { data: existing } = await supabaseAdmin
      .from("memories")
      .select("id, frequency, usefulness, confidence, category")
      .eq("user_id", userId)
      .ilike("content", trimmed)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const row = existing as { id: string; frequency?: number; usefulness?: number; confidence?: number; category?: string };
      await supabaseAdmin
        .from("memories")
        .update({
          frequency: (row.frequency ?? 1) + 1,
          usefulness: clamp01(Math.max(row.usefulness ?? 0.5, usefulness) + 0.04),
          confidence: clamp01(Math.max(row.confidence ?? 0.5, confidence)),
          category: row.category === "general" ? category : row.category,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      return;
    }

    await supabaseAdmin.from("memories").insert({
      user_id: userId,
      content: trimmed,
      category,
      confidence: clamp01(confidence),
      usefulness: clamp01(usefulness),
      pinned: false,
    });
  } catch {
    /* swallow */
  }
}

export async function persistMemoryCandidates(userId: string, candidates: MemoryCandidate[]): Promise<void> {
  if (!candidates.length) return;
  await Promise.all(
    candidates.map((candidate) =>
      storeMemory(userId, candidate.content, candidate.category, candidate.confidence, candidate.usefulness),
    ),
  );
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

export async function recordMemoryUseOutcome(memoryIds: string[], params: { success: boolean; wasFallback: boolean; responseChars: number }) {
  if (!memoryIds.length) return;
  try {
    const { data } = await supabaseAdmin
      .from("memories")
      .select("id, category, confidence, frequency, usefulness")
      .in("id", memoryIds);
    if (!data) return;
    await Promise.all(
      (data as { id: string; category: string; confidence: number; frequency: number; usefulness: number }[]).map((m) => {
        const boost = params.success && !params.wasFallback && params.responseChars > 120 ? 0.025 : -0.06;
        const usefulness = clamp01((m.usefulness ?? 0.5) + boost);
        const archive = usefulness < 0.08 && (m.frequency ?? 0) > 5 && !["identity", "project"].includes(m.category);
        return supabaseAdmin
          .from("memories")
          .update({
            usefulness,
            confidence: archive ? Math.max(0.1, (m.confidence ?? 0.5) - 0.1) : m.confidence,
            category: archive ? "archived" : m.category,
          })
          .eq("id", m.id);
      }),
    );
  } catch { /* swallow */ }
}

export function formatMemoriesForPrompt(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";
  const labels: Record<string, string> = {
    identity: "Identity memory",
    preference: "Preference memory",
    project: "Project memory",
    knowledge: "Knowledge memory",
    interaction: "Interaction memory",
    general: "General memory",
  };
  const grouped = new Map<string, MemoryEntry[]>();
  for (const entry of entries) {
    const category = labels[entry.category] ? entry.category : "general";
    grouped.set(category, [...(grouped.get(category) ?? []), entry]);
  }
  const sections: string[] = [];
  for (const [category, rows] of grouped) {
    const lines = rows.map((e) => `- ${e.content}`);
    sections.push(`${labels[category] ?? labels.general}:\n${lines.join("\n")}`);
  }
  return `Known user context. Use only when relevant and do not mention memory unless asked.\n${sections.join("\n\n")}`;
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
