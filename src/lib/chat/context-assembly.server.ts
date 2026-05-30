// Context assembly + bounded char-budget trimmer.
// Defensive against the recent `messages[N].content too_big` failure: we cap
// per-message and total payload size BEFORE Zod runs in the chat handler.
//
// Additive only — does not replace router, memory, live-data, or model logic.

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
  // keep head + tail so context is preserved even when a single message is huge
  const head = Math.floor(n * 0.7);
  const tail = n - head - 24;
  return `${s.slice(0, head)}\n…[truncated ${s.length - n} chars]…\n${s.slice(s.length - Math.max(tail, 0))}`;
}

async function loadConversationSummary(conversationId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from("conversation_summaries")
      .select("summary")
      .eq("conversation_id", conversationId)
      .maybeSingle();
    return (data as { summary?: string } | null)?.summary ?? null;
  } catch {
    return null;
  }
}

/**
 * Build a bounded `messages` payload for the model.
 * - Per-message cap: MAX_MESSAGE_CHARS
 * - Total cap: MAX_TOTAL_CHARS
 * - Keeps the last RECENT_MESSAGES_KEEP messages
 * - Older messages collapsed into a synthetic system summary (using
 *   the persisted conversation_summary when available)
 */
export async function assembleBoundedMessages(
  rawMessages: RawMsg[],
  conversationId: string | null,
): Promise<AssembledContext> {
  const originalCount = rawMessages.length;
  const originalChars = rawMessages.reduce((n, m) => n + (m.content?.length ?? 0), 0);

  // 1. Hard-clip every message so a single poisoned message can never exceed cap.
  const clipped: RawMsg[] = rawMessages.map((m) => ({
    role: m.role,
    content: clip(m.content ?? "", MAX_MESSAGE_CHARS),
  }));

  // 2. Split into "older" + "recent" tail.
  const recent = clipped.slice(-RECENT_MESSAGES_KEEP);
  const older = clipped.slice(0, Math.max(0, clipped.length - RECENT_MESSAGES_KEEP));

  // 3. Pull persisted summary for the conversation; combine with cheap inline digest
  //    of the older slice so we always carry forward something useful.
  let summaryText: string | null = null;
  let summaryInjected = false;
  const persisted = conversationId ? await loadConversationSummary(conversationId) : null;
  if (persisted || older.length > 0) {
    const digest =
      older.length > 0
        ? older
            .map((m) => `${m.role}: ${m.content.replace(/\s+/g, " ").slice(0, 280)}`)
            .join("\n")
        : "";
    summaryText = [
      persisted ? `Conversation summary so far:\n${persisted}` : null,
      digest ? `Earlier turns (compressed):\n${digest}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");
    summaryText = clip(summaryText, MAX_MESSAGE_CHARS);
  }

  const out: RawMsg[] = [];
  if (summaryText) {
    out.push({ role: "system", content: summaryText });
    summaryInjected = true;
  }
  out.push(...recent);

  // 4. Enforce global total cap by dropping oldest non-system entries.
  let total = out.reduce((n, m) => n + m.content.length, 0);
  while (total > MAX_TOTAL_CHARS && out.length > 1) {
    // find first non-system message and drop it
    const idx = out.findIndex((m, i) => i > 0 && m.role !== "system");
    if (idx < 0) break;
    total -= out[idx].content.length;
    out.splice(idx, 1);
  }

  const finalChars = out.reduce((n, m) => n + m.content.length, 0);
  return {
    messages: out,
    trimmed: finalChars < originalChars || clipped.some((c, i) => c.content.length !== (rawMessages[i].content?.length ?? 0)),
    originalCount,
    originalChars,
    finalChars,
    summaryInjected,
    summaryText,
  };
}
