// Phase 2 — Knowledge Extraction Layer.
// Additive: reads recent turns, asks Gemini Flash for structured JSON
// (projects, goals, tasks, decisions, preferences), then upserts each as a
// memory row using stable content prefixes so repeated mentions update the
// same record instead of duplicating. Zero schema changes.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requestChatCompletion } from "./model.server";

const MAX_TRANSCRIPT_CHARS = 6000;
const EXTRACT_TIMEOUT_MS = 18_000;
const DEBOUNCE_MS = 60_000; // per conversation
const lastRun = new Map<string, number>();

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const trim = (s: string, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

interface ProjectRec { name: string; summary?: string; status?: string; milestones?: string[]; risks?: string[]; next_actions?: string[] }
interface GoalRec    { title: string; metric?: string; target?: string; progress?: string; deadline?: string }
interface TaskRec    { description: string; project?: string; due?: string; priority?: "low" | "med" | "high" }
interface DecisionRec { summary: string; rationale?: string }
interface PreferenceRec { content: string }

interface Extracted {
  projects?: ProjectRec[];
  goals?: GoalRec[];
  tasks?: TaskRec[];
  decisions?: DecisionRec[];
  preferences?: PreferenceRec[];
}

interface UpsertArgs {
  userId: string;
  content: string;
  category: "project" | "goal" | "task" | "decision" | "preference";
  confidence: number;
  usefulness: number;
}

async function upsertStructured({ userId, content, category, confidence, usefulness }: UpsertArgs) {
  const normalized = trim(content, 500);
  if (normalized.length < 8) return;
  try {
    // Match by stable prefix (e.g. "[Project] Acme — ...") to update in place.
    const prefixMatch = normalized.match(/^\[(?:Project|Goal|Task|Decision|Preference)\][^—|]{0,80}/i);
    const prefix = prefixMatch ? prefixMatch[0] : null;

    let existing: { id: string; frequency?: number; usefulness?: number; confidence?: number } | null = null;
    if (prefix) {
      const { data } = await supabaseAdmin
        .from("memories")
        .select("id, frequency, usefulness, confidence")
        .eq("user_id", userId)
        .eq("category", category)
        .ilike("content", `${prefix.replace(/[%_]/g, " ")}%`)
        .limit(1)
        .maybeSingle();
      existing = (data as typeof existing) ?? null;
    }

    if (existing) {
      await supabaseAdmin
        .from("memories")
        .update({
          content: normalized,
          frequency: (existing.frequency ?? 1) + 1,
          usefulness: clamp01(Math.max(existing.usefulness ?? 0.5, usefulness) + 0.03),
          confidence: clamp01(Math.max(existing.confidence ?? 0.6, confidence)),
          last_used_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      return;
    }

    await supabaseAdmin.from("memories").insert({
      user_id: userId,
      content: normalized,
      category,
      confidence: clamp01(confidence),
      usefulness: clamp01(usefulness),
      pinned: false,
    });
  } catch {
    /* swallow */
  }
}

function formatProject(p: ProjectRec): string {
  const parts: string[] = [];
  if (p.summary) parts.push(p.summary);
  if (p.status) parts.push(`status: ${p.status}`);
  if (p.milestones?.length) parts.push(`milestones: ${p.milestones.slice(0, 4).join("; ")}`);
  if (p.risks?.length) parts.push(`risks: ${p.risks.slice(0, 3).join("; ")}`);
  if (p.next_actions?.length) parts.push(`next: ${p.next_actions.slice(0, 3).join("; ")}`);
  return `[Project] ${trim(p.name, 80)} — ${parts.join(" | ")}`;
}

function formatGoal(g: GoalRec): string {
  const parts: string[] = [];
  if (g.metric) parts.push(`metric: ${g.metric}`);
  if (g.target) parts.push(`target: ${g.target}`);
  if (g.progress) parts.push(`progress: ${g.progress}`);
  if (g.deadline) parts.push(`deadline: ${g.deadline}`);
  return `[Goal] ${trim(g.title, 80)} — ${parts.join(" | ")}`;
}

function formatTask(t: TaskRec): string {
  const parts: string[] = [];
  if (t.project) parts.push(`project: ${t.project}`);
  if (t.due) parts.push(`due: ${t.due}`);
  if (t.priority) parts.push(`priority: ${t.priority}`);
  return `[Task] ${trim(t.description, 120)}${parts.length ? ` — ${parts.join(" | ")}` : ""}`;
}

function parseJson(raw: string): Extracted | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Extracted;
  } catch {
    return null;
  }
}

async function callExtractor(transcript: string, priorContext: string): Promise<Extracted | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  const system = {
    role: "system" as const,
    content:
      "You extract structured knowledge from a chat between a user and an AI assistant. " +
      "Output STRICT JSON only — no prose, no markdown fences. Schema: " +
      `{"projects":[{"name":string,"summary":string,"status":string,"milestones":string[],"risks":string[],"next_actions":string[]}],` +
      `"goals":[{"title":string,"metric":string,"target":string,"progress":string,"deadline":string}],` +
      `"tasks":[{"description":string,"project":string,"due":string,"priority":"low"|"med"|"high"}],` +
      `"decisions":[{"summary":string,"rationale":string}],` +
      `"preferences":[{"content":string}]}. ` +
      "Only include items that are explicit or strongly implied by the user. Omit empty arrays. " +
      "Be terse. Skip small talk. Do not invent values.",
  };
  const user = {
    role: "user" as const,
    content:
      (priorContext ? `Prior known context (avoid duplicating):\n${priorContext}\n\n` : "") +
      `Recent transcript:\n${transcript}\n\nReturn ONLY the JSON object.`,
  };
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), EXTRACT_TIMEOUT_MS);
  try {
    const { response } = await requestChatCompletion({
      apiKey,
      messages: [system, user],
      signal: controller.signal,
      preferredModels: ["google/gemini-2.5-flash"],
    });
    if (!response.ok || !response.body) return null;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let acc = "";
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
          const d = j.choices?.[0]?.delta?.content ?? "";
          if (d) acc += d;
        } catch { /* keepalive */ }
      }
    }
    return parseJson(acc);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export interface ExtractInput {
  userId: string;
  conversationId: string;
}

/** Fire-and-forget. Debounced per conversation. Never throws. */
export async function maybeExtractKnowledge({ userId, conversationId }: ExtractInput): Promise<void> {
  try {
    const last = lastRun.get(conversationId) ?? 0;
    if (Date.now() - last < DEBOUNCE_MS) return;
    lastRun.set(conversationId, Date.now());

    const { data: rows } = await supabaseAdmin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(12);
    const list = ((rows ?? []) as Array<{ role: string; content: string }>).reverse();
    if (list.length < 2) return;

    let transcript = "";
    for (const m of list) {
      const piece = `${m.role}: ${trim(m.content, 1200)}\n`;
      if (transcript.length + piece.length > MAX_TRANSCRIPT_CHARS) break;
      transcript += piece;
    }

    // Prior context: recent project/goal memories, to discourage duplicates.
    const { data: prior } = await supabaseAdmin
      .from("memories")
      .select("content, category")
      .eq("user_id", userId)
      .in("category", ["project", "goal", "task", "decision"])
      .order("updated_at", { ascending: false })
      .limit(20);
    const priorContext = ((prior ?? []) as Array<{ content: string; category: string }>)
      .map((p) => `- ${p.content}`)
      .join("\n");

    const extracted = await callExtractor(transcript, priorContext);
    if (!extracted) return;

    const ops: Promise<void>[] = [];
    for (const p of (extracted.projects ?? []).slice(0, 6)) {
      if (!p?.name) continue;
      ops.push(upsertStructured({ userId, content: formatProject(p), category: "project", confidence: 0.82, usefulness: 0.78 }));
    }
    for (const g of (extracted.goals ?? []).slice(0, 6)) {
      if (!g?.title) continue;
      ops.push(upsertStructured({ userId, content: formatGoal(g), category: "goal", confidence: 0.82, usefulness: 0.78 }));
    }
    for (const t of (extracted.tasks ?? []).slice(0, 10)) {
      if (!t?.description) continue;
      ops.push(upsertStructured({ userId, content: formatTask(t), category: "task", confidence: 0.74, usefulness: 0.7 }));
    }
    for (const d of (extracted.decisions ?? []).slice(0, 6)) {
      if (!d?.summary) continue;
      const content = `[Decision] ${trim(d.summary, 140)}${d.rationale ? ` — rationale: ${trim(d.rationale, 200)}` : ""}`;
      ops.push(upsertStructured({ userId, content, category: "decision", confidence: 0.78, usefulness: 0.72 }));
    }
    for (const pr of (extracted.preferences ?? []).slice(0, 6)) {
      if (!pr?.content) continue;
      ops.push(upsertStructured({ userId, content: `[Preference] ${trim(pr.content, 200)}`, category: "preference", confidence: 0.8, usefulness: 0.75 }));
    }
    await Promise.allSettled(ops);
  } catch {
    /* swallow */
  }
}
