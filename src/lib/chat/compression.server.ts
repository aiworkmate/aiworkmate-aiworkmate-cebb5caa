// Conversation compression — best-effort summarization.
// Stores the rolling summary in conversation_summaries (one row per conversation).
// Original messages are NEVER deleted.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requestChatCompletion } from "@/lib/chat/model.server";

const COMPRESS_TRIGGER_MESSAGES = 24;
const COMPRESS_TRIGGER_CHARS = 40_000;
const MAX_SUMMARY_CHARS = 4000;

interface SummarizeInput {
  userId: string;
  conversationId: string;
}

async function shouldCompress(conversationId: string): Promise<{
  do: boolean;
  rows: Array<{ id: string; role: string; content: string; created_at: string }>;
  totalChars: number;
}> {
  const { data } = await supabaseAdmin
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as Array<{ id: string; role: string; content: string; created_at: string }>;
  const totalChars = rows.reduce((n, r) => n + (r.content?.length ?? 0), 0);
  const do_ = rows.length >= COMPRESS_TRIGGER_MESSAGES || totalChars >= COMPRESS_TRIGGER_CHARS;
  return { do: do_, rows, totalChars };
}

/** Trigger summarization if the conversation grew beyond thresholds. */
export async function maybeSummarizeConversation({ userId, conversationId }: SummarizeInput): Promise<void> {
  try {
    const { do: shouldDo, rows, totalChars } = await shouldCompress(conversationId);
    if (!shouldDo || rows.length === 0) return;

    // Fetch existing summary so we can extend rather than rewrite from scratch.
    const { data: prior } = await supabaseAdmin
      .from("conversation_summaries")
      .select("summary, covered_up_to_message_id")
      .eq("conversation_id", conversationId)
      .maybeSingle();
    const priorSummary = (prior as { summary?: string } | null)?.summary ?? "";

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return;

    const transcript = rows
      .slice(-60) // bound transcript size to summarizer
      .map((r) => `${r.role}: ${r.content.replace(/\s+/g, " ").slice(0, 800)}`)
      .join("\n");

    const systemPrompt = {
      role: "system" as const,
      content:
        "You are a precise conversation summarizer. Produce a faithful, dense summary that preserves: user identity facts, preferences, goals, decisions, tasks, open questions, important constraints, project context, and any committed plans. Omit small talk. Output plain text under 4000 characters. Do not invent details.",
    };
    const userPrompt = {
      role: "user" as const,
      content:
        (priorSummary ? `Existing summary so far:\n${priorSummary}\n\n` : "") +
        `New transcript to fold into the summary:\n${transcript}\n\nReturn ONLY the updated summary.`,
    };

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 25_000);
    let summary = "";
    try {
      const { response } = await requestChatCompletion({
        apiKey,
        messages: [systemPrompt, userPrompt],
        signal: controller.signal,
        preferredModels: ["google/gemini-2.5-flash"],
      });
      if (!response.ok || !response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            const delta = j.choices?.[0]?.delta?.content ?? "";
            if (delta) summary += delta;
          } catch { /* keepalive */ }
        }
      }
    } finally {
      clearTimeout(t);
    }

    summary = summary.trim().slice(0, MAX_SUMMARY_CHARS);
    if (!summary) return;

    const lastId = rows[rows.length - 1].id;
    await supabaseAdmin
      .from("conversation_summaries")
      .upsert(
        {
          user_id: userId,
          conversation_id: conversationId,
          summary,
          covered_up_to_message_id: lastId,
          message_count: rows.length,
          token_estimate: Math.round(totalChars / 4),
          quality_score: 0.75,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "conversation_id" },
      );
  } catch {
    /* swallow — best effort */
  }
}
