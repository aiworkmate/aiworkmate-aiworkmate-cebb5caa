# AI WorkMate V2 — Context Intelligence Extension

Purely additive. No existing backend system is replaced. Chat pipeline, auth, memory, Tavily/SerpAPI, SSE, persistence, RLS, adaptive learning, routing, and model orchestration stay exactly as they are today. This layer wraps inputs to the existing chat handler so oversized histories (the root cause of the recent `messages[31].content too_big` failure) can never reach the validator again.

## 1. New database tables (additive, RLS on)

All new tables live in `public`, scoped by `user_id` (+ `conversation_id` where relevant), with the standard GRANT block and `auth.uid()` policies. Nothing in existing tables is altered.

- `conversation_summaries` — rolling summary per conversation. Columns: `id`, `user_id`, `conversation_id`, `summary`, `covered_up_to_message_id`, `message_count`, `token_estimate`, `quality_score`, `created_at`, `updated_at`.
- `project_summaries` — one row per detected project/topic. Columns: `id`, `user_id`, `project_key`, `title`, `summary`, `status`, `last_referenced_at`, `confidence`.
- `user_profile_summary` — single row per user. Columns: `user_id` (pk), `identity`, `preferences`, `working_style`, `updated_at`.
- `goal_summaries` and `task_summaries` — `id`, `user_id`, `title`, `summary`, `status` (`active|paused|done`), `priority`, `last_referenced_at`.
- `context_health_events` — append-only metrics: `id`, `user_id`, `conversation_id`, `event_type`, `payload jsonb`, `created_at`. Used for compression ratio, retrieval quality, validation failures, assembly latency.

Existing `memories` table is untouched; reinforcement continues to use the existing fields (`frequency`, `usefulness`, `confidence`, `last_used_at`).

## 2. New server modules (additive files only)

Created under `src/lib/chat/` next to the existing ones — none of the existing `.server.ts` files are rewritten.

- `compression.server.ts` — `summarizeConversation(messages, prior?)` calls Lovable AI Gateway with a strict summarization prompt and writes/upserts into `conversation_summaries`. Triggered when message count > N or total chars > threshold. Original messages are never deleted.
- `context-assembly.server.ts` — `assembleContext({ userId, conversationId, recentMessages, routerDecision })` returns a bounded payload: system preamble + user profile summary + relevant project/goal/task summaries + conversation summary + last K raw messages + recalled memories + live-data block. Enforces a hard char budget well under the existing 20k Zod cap so validation can never fail on size again.
- `prioritization.server.ts` — pure scoring helpers (goals > preferences > active projects > recent > decisions; demotes small talk / repetition / stale items). Reused by assembly and by memory reinforcement signals.
- `knowledge.server.ts` — extractors that update `project_summaries`, `user_profile_summary`, `goal_summaries`, `task_summaries` from the latest turn. Best-effort, swallowed errors (same pattern as `memory.server.ts`).
- `reinforcement.server.ts` — thin wrapper that feeds outcome signals (confirmed, referenced, ignored) back into existing `memories` reinforcement plus the new summary tables. Reuses `recordMemoryUseOutcome` rather than replacing it.
- `health.server.ts` — `recordHealth(event, payload)` insert into `context_health_events`. Wrapped in `safe()`.

## 3. Integration with existing `/api/chat`

Single surgical insertion point, no behavioral change to the existing pipeline:

1. Just before the current Zod validation, call `assembleContext(...)` to replace the outbound `messages` array with the compressed/bounded version. Raw history stays in the DB; only the model-facing array is trimmed.
2. After the existing `onFinish`/persistence step (untouched), fire-and-forget: `summarizeConversation`, `knowledge.extract`, `reinforcement.update`, `health.record`.

Router, memory recall, live-data (Tavily/SerpAPI), SSE, adaptive learning, and persistence are called exactly as today.

## 4. Frontend — context surfaces + full mobile pass

Additive UI under `src/routes/app/`:

- `app/context.tsx` — read-only panel showing the latest conversation summary, active project/goal/task summaries, and a health strip (size, compression ratio, last assembly latency). Pulls from the new tables via the existing Supabase client.
- Small badge in the chat header showing "Compressed N messages → summary" when a summary is in use, with a popover to view it.

Mobile responsiveness pass across the whole app (no logic changes):

- Audit and fix every page (`chat`, `memory`, `analytics`, `audit`, `admin`, `medical`, `settings`, `uploads`, `workflows`, `index`) for: no horizontal scroll at 320–430px, sidebar collapses to a sheet/drawer below `md`, top bar wraps, tables become stacked cards or horizontally scrollable inside their own container, forms stack, composer sticks to bottom with safe-area padding, 44×44 min tap targets on all icon buttons, inputs use 16px font to prevent iOS zoom.
- Verify portrait + landscape, iOS Safari, Android Chrome.
- Keep all existing tokens from `src/styles.css`; only add responsive Tailwind classes.

## 5. Health monitoring

`context_health_events` feeds a lightweight section on `app/analytics` (existing route): conversation size trend, compression ratio, retrieval hit rate, summary quality (self-rated by the summarizer), validation failure count, p50/p95 assembly latency.

## 6. Safety / non-goals

- No edits to `router.server.ts`, `memory.server.ts` (only called, not modified), `adaptive.server.ts`, `web-search.server.ts`, `model.server.ts`, `safe.server.ts`, auth middleware, or SSE plumbing.
- No deletion of raw messages, memories, or any existing row.
- All new server work is wrapped in `safe()`-style try/catch so the chat path degrades gracefully to today's behavior if any new module fails.
- New tables ship with explicit GRANTs and `auth.uid()` RLS policies.

## Technical notes

- Char budget for assembled `messages`: cap each message at 8k chars and total payload at 12k chars, well under the existing 20k Zod limit. This alone prevents the recurrence of the `messages[N].content too_big` failure.
- Summarizer model: same Lovable AI Gateway, cheap tier (`google/gemini-2.5-flash`), JSON-mode output validated with Zod before insert.
- Triggers for compression: > 24 messages OR > 40k total chars in conversation, debounced per conversation.
- All new server modules read env via `process.env` inside `.handler()` only.

Approve and I'll implement in this order: migrations → server modules → chat handler insertion point → context UI + analytics strip → full mobile responsiveness pass → verification (build, 320/375/430/768 viewports, send "hi", confirm SSE + summary creation).
