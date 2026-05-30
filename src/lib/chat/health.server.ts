// Append-only context-health metric sink. Best-effort, swallowed errors.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type HealthEvent =
  | "context.assembled"
  | "context.trimmed"
  | "summary.created"
  | "summary.skipped"
  | "validation.failed"
  | "retrieval.quality";

export async function recordHealth(
  userId: string,
  conversationId: string | null,
  event_type: HealthEvent,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabaseAdmin.from("context_health_events").insert({
      user_id: userId,
      conversation_id: conversationId,
      event_type,
      payload: payload as never,
    });
  } catch {
    /* swallow */
  }
}
