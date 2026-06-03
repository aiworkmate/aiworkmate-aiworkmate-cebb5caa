## Goal

Rebuild the app as **WorkMate X** — a project/memory/agent-oriented AI workspace — on the new Supabase schema you provided, replacing the current Express + JSON-store backend wiring with Lovable Cloud (Supabase) as the source of truth.

## What I need to confirm before starting

The current project is unusual: it's a Node/Express server (`server/app.mjs`) serving a vanilla `public/index.html`, plus a separate TanStack Start app under `packages/gpt-module/` that already has its own Supabase migrations. Full rebuild requires picking one frontend to be "the app". I'll proceed with:

- **Frontend**: `packages/gpt-module/` (TanStack Start, shadcn, already Supabase-wired) as the canonical UI. The legacy `public/` + `server/` Express app will be left in place but no longer the main surface.
- **Backend**: Lovable Cloud (Supabase). Your `workmate-supabase-schema.sql` becomes a new migration.

If you'd rather the legacy `public/index.html` Express app become the WorkMate UI, tell me and I'll re-scope.

## Steps

### 1. Backend — Lovable Cloud + schema
- Enable Lovable Cloud on the root project.
- Add `supabase/migrations/<ts>_workmate_schema.sql` containing your schema (projects, conversations, messages, tasks, agent_definitions, memories, documents, sources, health, verifications, etc.) — adapted for Lovable Cloud conventions:
  - Add explicit `GRANT`s for `authenticated` / `service_role` on every public table (Lovable Cloud requirement).
  - Keep your `created_by = auth.uid()` RLS model.
  - Keep `set_updated_at()` triggers.
- Add `supabase/migrations/<ts>_workmate_seed.sql` adapted so seed rows attach to the current signed-in user via a safe lookup (your seed already does this).

### 2. Frontend — 3-panel AI OS shell
In `packages/gpt-module/src/routes/_authenticated/`:
- **Left rail**: projects list, agents directory, memory center, health, settings.
- **Center**: conversation thread (messages table) with agent routing badge.
- **Right operating panel**: contextual — tasks, sources, decisions, verifications for the active project/conversation.

Pages:
- `/projects`, `/projects/$id` (workspace: goals, milestones, decisions, tasks, sources, conversations)
- `/chat`, `/chat/$conversationId` (with project linkage)
- `/agents` (agent_definitions directory + stats)
- `/memory` (memories center)
- `/health` (agent latency / success-rate dashboard from seed metrics)
- `/verifications` (verification surfaces)

### 3. Data layer
- Generate updated Supabase types.
- Add typed `createServerFn` wrappers for: list/create project, list/create conversation, append message, list tasks, list agents, list memories — all protected with `requireSupabaseAuth`.
- Components read via `useSuspenseQuery` + loaders per the TanStack Query pattern.

### 4. Visual direction
Keep the Midnight Indigo palette + Space Grotesk / DM Sans you already picked. Calm, high-trust, mobile-native, dense-but-quiet — not chatbot-styled. Project context is always visible in the right panel.

### 5. Out of scope (for this pass)
- Wiring real LLM calls into the new agents (UI + schema + stubs only; you can plug `aiProvider.mjs` or Lovable AI Gateway in a follow-up).
- Migrating data from the existing JSON store.
- Deleting the legacy Express server.

## Technical notes
- New schema tables that overlap existing gpt-module migrations (`profiles`, `user_roles`, `conversations`, `messages`, `memories`) will be reconciled by namespacing the WorkMate schema or dropping the conflicting older tables — I'll choose per-table during migration authoring and call it out in the migration file.
- Auth stays on the existing `_authenticated/` gate (Supabase session, client-rendered).
- Seed runs only after you've signed in once (matches your README).

## Deliverable at end of this pass
- Lovable Cloud enabled, schema + seed migrations committed.
- New WorkMate routes rendering real Supabase data.
- 3-panel shell live behind auth, with project linkage visible across tasks/conversations/memories/sources.
