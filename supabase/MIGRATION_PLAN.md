# AI WorkMate Supabase Migration Plan

## Current Local Architecture

- Auth logic: `server/lib/security.mjs` implements PBKDF2 password hashes, HTTP-only sessions, CSRF tokens, role checks, rate limiting, and security headers.
- Database models: `server/lib/storage.mjs` stores JSON collections for users, sessions, conversations, messages, memories, uploads, audit logs, and analytics.
- Memory storage: `server/modules/memory.mjs` implements local token hashing vectors and semantic-like retrieval.
- Uploads: `server/modules/uploads.mjs`, `documents.mjs`, and `vision.mjs` store private files locally and extract text/image metadata.
- Workflows/orchestration: `server/modules/orchestrator.mjs` routes intent, retrieves memory, loads upload context, runs tools, then forces `generateFinalResponse()`.
- AI provider: `server/modules/aiProvider.mjs` keeps provider keys server-side and returns only final user-facing answers.
- Analytics/audit: `server/modules/analytics.mjs` records metrics and audit events.
- API routes: `server/app.mjs` exposes auth, chat, streaming chat, conversations, uploads, memory, account, admin metrics, and audit routes.
- Frontend contract: `public/app.js` renders only `data.response` for `/api/chat`.

## Supabase Target

Use Supabase Auth, Postgres, RLS, private Storage, and Edge Functions.

Schema migrations:

1. `202605280001_ai_workmate_core.sql`
   - Enables `vector`, `pgcrypto`, and `uuid-ossp`.
   - Creates profiles, organizations, organization members, workspaces, workspace members, conversations, messages, memories, uploads, workflows, workflow runs, audit logs, analytics, settings, citations, and tool invocations.
   - Adds `match_memories()` pgvector RPC.
   - Adds private helper functions and bootstrap triggers.

2. `202605280002_ai_workmate_rls_storage.sql`
   - Enables RLS on all AI WorkMate tables.
   - Adds user, organization, admin, and workspace-level isolation policies.
   - Creates private Storage buckets: `uploads`, `documents`, `avatars`, `workflow-assets`, and `temporary-files`.
   - Adds private Storage object policies.

## Apply Order

Do not apply automatically to production. Recommended flow:

1. Review both migration SQL files.
2. Apply to a Supabase branch or staging project first.
3. Generate TypeScript types after applying.
4. Run Supabase advisors again.
5. Fix any project-specific advisor findings.
6. Connect Lovable frontend with anon key only.
7. Store `SERVICE_ROLE_KEY` and AI/API keys only in Edge Function secrets.

## Existing Supabase Project State

- Public app tables: none detected.
- Storage buckets: none detected.
- Security advisor warning: existing `public.rls_auto_enable()` is a `SECURITY DEFINER` function executable by anon/authenticated roles.
- Suggested separate hardening action: revoke direct execute on that function if it is not intentionally public. Do not bundle this with AI WorkMate schema without approval.

## Non-Destructive Promise

These files are migration artifacts only. They do not drop application tables or modify production data. Storage buckets are created private by default.

