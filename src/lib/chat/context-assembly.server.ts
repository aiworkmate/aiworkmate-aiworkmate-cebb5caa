// Context assembly + bounded char-budget trimmer.
// Defensive against the recent `messages[N].content too_big` failure: we cap
// per-message and total payload size BEFORE Zod runs in the chat handler.
//
// Zero schema changes — reads the rolling summary from the existing
// `conversations.summary` column (already present in the baseline schema).

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const MAX_MESSAGE_CHARS = 8000;          // well below the 20k Zod cap
export const MAX_TOTAL_CHARS = 14000;           // total across the messages array
export const RECENT_MESSAGES_KEEP = 12;         // always retain the most recent N

export interface RawMsg { role: "user" | "assistant" | "system"; content: string }

export interface AssembledContext {
  messages: RawMsg[];
  trimmed: boolean;
  originalCount: number;
  originalChars: number;
  finalChars: number;
  summaryInjected: boolean;
  summaryText: string | null;
}

function clip(s: string, n: number): string {
  if (s.length <= n) return s;
  const head = Math.floor(n * 0.7);
  const tail = n - head - 24;
  return `${s.slice(0, head)}\n…[truncated ${s.length - n} chars]…\n${s.slice(s.length - Math.max(tail, 0))}`;
}

async function loadConversationSummary(conversationId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from("conversations")
      .select("summary")
      .eq("id", conversationId)
      .maybeSingle();
    return (data as { summary?: string | null } | null)?.summary ?? null;
  } catch {
    return null;
  }
}

export async function assembleBoundedMessages(
  rawMessages: RawMsg[],
  conversationId: string | null,
): Promise<AssembledContext> {
  const originalCount = rawMessages.length;
  const originalChars = rawMessages.reduce((n, m) => n + (m.content?.length ?? 0), 0);

  const clipped: RawMsg[] = rawMessages.map((m) => ({
    role: m.role,
    content: clip(m.content ?? "", MAX_MESSAGE_CHARS),
  }));

  const recent = clipped.slice(-RECENT_MESSAGES_KEEP);
  const older = clipped.slice(0, Math.max(0, clipped.length - RECENT_MESSAGES_KEEP));

  let summaryText: string | null = null;
  let summaryInjected = false;
  const persisted = conversationId ? await loadConversationSummary(conversationId) : null;
  if (persisted || older.length > 0) {
    const digest = older.length
      ? older.map((m) => `${m.role}: ${m.content.replace(/\s+/g, " ").slice(0, 280)}`).join("\n")
      : "";
    summaryText = [
      persisted ? `Conversation summary so far:\n${persisted}` : null,
      digest ? `Earlier turns (compressed):\n${digest}` : null,
    ].filter(Boolean).join("\n\n");
    summaryText = clip(summaryText, MAX_MESSAGE_CHARS);
  }

  const out: RawMsg[] = [];
  if (summaryText) {
    out.push({ role: "system", content: summaryText });
    summaryInjected = true;
  }
  out.push(...recent);

  let total = out.reduce((n, m) => n + m.content.length, 0);
  while (total > MAX_TOTAL_CHARS && out.length > 1) {
    const idx = out.findIndex((m, i) => i > 0 && m.role !== "system");
    if (idx < 0) break;
    total -= out[idx].content.length;
    out.splice(idx, 1);
  }

  const finalChars = out.reduce((n, m) => n + m.content.length, 0);
  return {
    messages: out,
    trimmed:
      finalChars < originalChars ||
      clipped.some((c, i) => c.content.length !== (rawMessages[i].content?.length ?? 0)),
    originalCount,
    originalChars,
    finalChars,
    summaryInjected,
    summaryText,
  };
}
