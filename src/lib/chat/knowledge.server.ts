// Lightweight knowledge extractor — updates project_summaries, goal_summaries,
// task_summaries, and user_profile_summary from a single chat turn. Best-effort.
// Heuristic-only (no extra model calls) to keep latency at zero on the hot path.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PROJECT_RE = /\b(?:project|building|working on|launching|shipping)\s+(?:called\s+|named\s+)?["']?([A-Z][\w\s.-]{2,40})["']?/gi;
const GOAL_RE = /\b(?:my goal|i (?:want|need|plan|aim) to|objective is|goal is to)\s+([^.!?\n]{6,140})/gi;
const TASK_RE = /\b(?:todo|to do|task|remind me to|i (?:should|must|need to))\s+([^.!?\n]{6,140})/gi;
const PROFILE_PREF_RE = /\b(?:i (?:prefer|like|always|never|usually)|call me|my name is)\b[^.!?\n]{3,160}/gi;

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export async function extractKnowledge(
  userId: string,
  userText: string,
  assistantText = "",
): Promise<void> {
  const combined = `${userText}\n${assistantText}`;
  try {
    // --- Projects ---
    const projects = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = PROJECT_RE.exec(combined)) !== null) {
      const title = m[1].trim().replace(/\s+/g, " ");
      if (title.length >= 3) projects.add(title);
    }
    for (const title of projects) {
      const key = slugify(title);
      if (!key) continue;
      await supabaseAdmin
        .from("project_summaries")
        .upsert(
          {
            user_id: userId,
            project_key: key,
            title,
            summary: `User has mentioned project "${title}".`,
            status: "active",
            last_referenced_at: new Date().toISOString(),
            confidence: 0.7,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,project_key" },
        );
    }

    // --- Goals ---
    while ((m = GOAL_RE.exec(userText)) !== null) {
      const title = m[1].trim().slice(0, 140);
      if (title.length < 6) continue;
      // dedupe by ilike title
      const { data: existing } = await supabaseAdmin
        .from("goal_summaries")
        .select("id")
        .eq("user_id", userId)
        .ilike("title", title)
        .limit(1)
        .maybeSingle();
      if (existing) {
        await supabaseAdmin
          .from("goal_summaries")
          .update({ last_referenced_at: new Date().toISOString() })
          .eq("id", (existing as { id: string }).id);
      } else {
        await supabaseAdmin.from("goal_summaries").insert({
          user_id: userId, title, summary: title, status: "active", priority: 5,
        });
      }
    }

    // --- Tasks ---
    while ((m = TASK_RE.exec(userText)) !== null) {
      const title = m[1].trim().slice(0, 140);
      if (title.length < 6) continue;
      const { data: existing } = await supabaseAdmin
        .from("task_summaries")
        .select("id")
        .eq("user_id", userId)
        .ilike("title", title)
        .limit(1)
        .maybeSingle();
      if (existing) {
        await supabaseAdmin
          .from("task_summaries")
          .update({ last_referenced_at: new Date().toISOString() })
          .eq("id", (existing as { id: string }).id);
      } else {
        await supabaseAdmin.from("task_summaries").insert({
          user_id: userId, title, summary: title, status: "active", priority: 5,
        });
      }
    }

    // --- User profile preferences (append, dedup'd) ---
    const prefs: string[] = [];
    while ((m = PROFILE_PREF_RE.exec(userText)) !== null) {
      const line = m[0].trim().slice(0, 200);
      if (line && !prefs.includes(line)) prefs.push(line);
    }
    if (prefs.length) {
      const { data: prior } = await supabaseAdmin
        .from("user_profile_summary")
        .select("preferences")
        .eq("user_id", userId)
        .maybeSingle();
      const existingPrefs = ((prior as { preferences?: string } | null)?.preferences ?? "")
        .split("\n").map((s) => s.trim()).filter(Boolean);
      const merged = Array.from(new Set([...existingPrefs, ...prefs])).slice(-40).join("\n");
      await supabaseAdmin
        .from("user_profile_summary")
        .upsert({
          user_id: userId,
          preferences: merged,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
    }
  } catch {
    /* swallow */
  }
}
