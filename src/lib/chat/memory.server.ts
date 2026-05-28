// Lightweight "smarter over time" memory layer.
// Uses the existing public.memories table (RLS-protected; service role bypasses).
// All operations are best-effort — failures return safe defaults.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface MemoryEntry {
  id: string;
  content: string;
  category: string;
  pinned: boolean;
  confidence: number;
}

export async function recallMemories(userId: string, limit = 8): Promise<MemoryEntry[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("memories")
      .select("id, content, category, pinned, confidence")
      .eq("user_id", userId)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as MemoryEntry[];
  } catch {
    return [];
  }
}

/** Gate before storing — keeps memory clean by only saving clear, intentional signals. */
const MEMORY_KEYWORDS = [
  "i prefer",
  "i like",
  "i love",
  "i hate",
  "i want",
  "i always",
  "i never",
  "i usually",
  "i work as",
  "i am a",
  "remember that",
  "remember to",
  "call me",
  "my name is",
  "my preferred name is",
];

export function shouldStoreMemory(text: string): boolean {
  const t = (text ?? "").toLowerCase().trim();
  if (t.length < 5 || t.length > 500) return false;
  return MEMORY_KEYWORDS.some((k) => t.includes(k));
}

/** Store a short note (preference, recurring topic, correction). Best-effort. */
export async function storeMemory(
  userId: string,
  content: string,
  category: string = "general",
  confidence: number = 0.7,
): Promise<void> {
  const trimmed = content.trim().slice(0, 500);
  if (!trimmed) return;
  if (!shouldStoreMemory(trimmed)) return; // noise filter
  try {
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

export function formatMemoriesForPrompt(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map((e) => `- (${e.category}${e.pinned ? ", pinned" : ""}) ${e.content}`);
  return `Known user context (use only if relevant, do not mention unless asked):\n${lines.join("\n")}`;
}

// Heuristic extractor: pull a short "preference" line out of a user message when
// it clearly states one. Combined with shouldStoreMemory() for the noise filter.
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
