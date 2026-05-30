# Lovable + Supabase Integration Guide

## Apply Migrations

Review first, then apply in order to a Supabase branch or staging project:

1. `supabase/migrations/202605280001_ai_workmate_core.sql`
2. `supabase/migrations/202605280002_ai_workmate_rls_storage.sql`

Do not apply directly to production until the migration plan is approved.

## Environment Mapping

Frontend / Lovable:

```env
VITE_SUPABASE_URL=https://zcgohpaocqolykadgsha.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_anon_key
```

Supabase Edge Function secrets only:

```env
SUPABASE_URL=https://zcgohpaocqolykadgsha.supabase.co
SUPABASE_ANON_KEY=your_publishable_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4.1
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `OPENAI_API_KEY` to the frontend.

## Frontend Client

Use:

- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`

The frontend must authenticate with Supabase Auth and call the `ai-chat` Edge Function.

## Chat Contract

Request:

```ts
const { data, error } = await supabase.functions.invoke('ai-chat', {
  body: {
    organizationId,
    workspaceId,
    conversationId,
    message,
    mode,
    uploadIds
  }
});
```

Render only:

```ts
data.response
```

Never render:

- router output
- route JSON
- tool plans
- hidden memory context
- internal logs
- next-action text

## Storage Path Contract

Workspace files:

```txt
{organization_id}/{workspace_id}/{user_id}/{file_id}-{filename}
```

Avatar files:

```txt
{user_id}/avatar-{timestamp}.{ext}
```

Storage buckets are private:

- `uploads`
- `documents`
- `avatars`
- `workflow-assets`
- `temporary-files`

## Memory Retrieval

Use the RPC:

```ts
const { data } = await supabase.rpc('match_memories', {
  query_embedding: `[${embedding.join(',')}]`,
  match_count: 8,
  match_threshold: 0.72,
  p_workspace_id: workspaceId,
  p_organization_id: organizationId
});
```

Embeddings should be generated server-side in Edge Functions.

## Admin Analytics

Admin screens should read:

- `analytics`
- `audit_logs`
- `tool_invocations`
- `workflow_runs`

RLS restricts these to platform admins, organization admins, and workspace admins.

## Medical Mode

Medical mode is assistive only. The final response should separate:

- Observations
- Interpretation
- Uncertainty
- Recommendations
- Clinician review

No autonomous diagnosis.

