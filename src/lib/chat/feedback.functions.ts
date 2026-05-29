// Memory feedback server function.
// Records whether a response was helpful and adjusts the usefulness of memories
// that were surfaced to produce it.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Input = z.object({
  messageId: z.string().uuid().nullable().optional(),
  conversationId: z.string().uuid().nullable().optional(),
  memoryIds: z.array(z.string().uuid()).max(32).default([]),
  helpful: z.boolean(),
  note: z.string().max(500).optional(),
});

export const submitMemoryFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const impact = data.helpful ? 0.85 : 0.15;

    // 1. Record the feedback row (RLS-scoped insert via user-bound client).
    await context.supabase.from("memory_feedback").insert({
      user_id: userId,
      message_id: data.messageId ?? null,
      conversation_id: data.conversationId ?? null,
      memory_ids: data.memoryIds,
      helpful: data.helpful,
      impact,
      note: data.note ?? null,
    });

    // 2. Adjust usefulness of cited memories. Boost helpful, decay unhelpful.
    if (data.memoryIds.length) {
      const { data: rows } = await supabaseAdmin
        .from("memories")
        .select("id, usefulness")
        .in("id", data.memoryIds)
        .eq("user_id", userId);
      if (rows?.length) {
        await Promise.all(
          rows.map((m) => {
            const curr = (m as { usefulness: number }).usefulness ?? 0.5;
            const next = data.helpful
              ? Math.min(1, curr + 0.08)
              : Math.max(0, curr - 0.12);
            return supabaseAdmin
              .from("memories")
              .update({ usefulness: next, last_used_at: new Date().toISOString() })
              .eq("id", (m as { id: string }).id);
          }),
        );
      }
    }

    return { ok: true, impact };
  });
