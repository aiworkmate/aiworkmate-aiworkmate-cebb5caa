-- AI WorkMate Supabase core schema.
-- Versioned migration only. Review before applying to any production project.

create schema if not exists extensions;
create schema if not exists app_private;

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

set search_path = public, extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'profile_role') then
    create type public.profile_role as enum ('user', 'admin', 'clinician', 'platform_admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'organization_role') then
    create type public.organization_role as enum ('owner', 'admin', 'member', 'viewer');
  end if;
  if not exists (select 1 from pg_type where typname = 'workspace_role') then
    create type public.workspace_role as enum ('owner', 'admin', 'editor', 'viewer');
  end if;
  if not exists (select 1 from pg_type where typname = 'ai_mode') then
    create type public.ai_mode as enum ('general', 'medical');
  end if;
  if not exists (select 1 from pg_type where typname = 'message_role') then
    create type public.message_role as enum ('user', 'assistant', 'system');
  end if;
  if not exists (select 1 from pg_type where typname = 'workflow_status') then
    create type public.workflow_status as enum ('draft', 'active', 'paused', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'workflow_run_status') then
    create type public.workflow_run_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'upload_status') then
    create type public.upload_status as enum ('uploaded', 'processing', 'ready', 'failed', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'setting_scope') then
    create type public.setting_scope as enum ('user', 'organization', 'workspace');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role public.profile_role not null default 'user',
  default_organization_id uuid,
  default_workspace_id uuid,
  settings jsonb not null default '{"theme":"system","defaultMode":"general","liveData":true,"memory":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_id uuid not null references auth.users(id) on delete restrict,
  plan text not null default 'free',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'member',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text,
  created_by uuid not null references auth.users(id) on delete restrict,
  default_mode public.ai_mode not null default 'general',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  unique (id, organization_id)
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id),
  foreign key (workspace_id, organization_id)
    references public.workspaces(id, organization_id)
    on delete cascade
);

alter table public.profiles
  add constraint profiles_default_org_fk
  foreign key (default_organization_id)
  references public.organizations(id)
  on delete set null;

alter table public.profiles
  add constraint profiles_default_workspace_fk
  foreign key (default_workspace_id)
  references public.workspaces(id)
  on delete set null;

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  scope public.setting_scope not null,
  user_id uuid references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settings_scope_owner_check check (
    (scope = 'user' and user_id is not null and organization_id is null and workspace_id is null)
    or (scope = 'organization' and organization_id is not null and user_id is null and workspace_id is null)
    or (scope = 'workspace' and workspace_id is not null and user_id is null)
  )
);

create unique index if not exists settings_scope_unique_idx
on public.settings (
  scope,
  coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid),
  key
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  mode public.ai_mode not null default 'general',
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, organization_id)
    references public.workspaces(id, organization_id)
    on delete cascade
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  role public.message_role not null,
  content text not null,
  upload_ids uuid[] not null default '{}',
  tool_names text[] not null default '{}',
  token_estimate integer not null default 0,
  model text,
  is_final_response boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, organization_id)
    references public.workspaces(id, organization_id)
    on delete cascade
);

create table if not exists public.message_citations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  message_id uuid not null references public.messages(id) on delete cascade,
  source_type text not null,
  title text,
  url text,
  upload_id uuid,
  snippet text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, organization_id)
    references public.workspaces(id, organization_id)
    on delete cascade
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  kind text not null default 'semantic',
  tags text[] not null default '{}',
  importance numeric not null default 0.5 check (importance >= 0 and importance <= 1),
  embedding extensions.vector(1536),
  source_message_id uuid references public.messages(id) on delete set null,
  archived boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, organization_id)
    references public.workspaces(id, organization_id)
    on delete cascade
);

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null,
  storage_path text not null,
  name text not null,
  mime text not null,
  size_bytes bigint not null default 0,
  status public.upload_status not null default 'uploaded',
  extracted_text text,
  summary text,
  embedding extensions.vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, storage_path),
  foreign key (workspace_id, organization_id)
    references public.workspaces(id, organization_id)
    on delete cascade
);

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null,
  description text,
  status public.workflow_status not null default 'draft',
  definition jsonb not null default '{}'::jsonb,
  trigger_config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, organization_id)
    references public.workspaces(id, organization_id)
    on delete cascade
);

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  workflow_id uuid references public.workflows(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  started_by uuid references auth.users(id) on delete set null,
  status public.workflow_run_status not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  foreign key (workspace_id, organization_id)
    references public.workspaces(id, organization_id)
    on delete cascade
);

create table if not exists public.tool_invocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  tool_name text not null,
  status text not null default 'ok',
  latency_ms integer not null default 0,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, organization_id)
    references public.workspaces(id, organization_id)
    on delete cascade
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  workspace_id uuid,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  target_table text,
  target_id text,
  status text not null default 'ok',
  ip_address inet,
  user_agent text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  workspace_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  event_type text not null,
  mode public.ai_mode not null default 'general',
  model text,
  latency_ms integer not null default 0,
  tokens_estimated integer not null default 0,
  tool_names text[] not null default '{}',
  status text not null default 'ok',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists organization_members_user_idx on public.organization_members (user_id, organization_id);
create index if not exists workspace_members_user_idx on public.workspace_members (user_id, workspace_id);
create index if not exists workspaces_org_idx on public.workspaces (organization_id);
create index if not exists conversations_workspace_idx on public.conversations (workspace_id, updated_at desc);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create index if not exists memories_user_workspace_idx on public.memories (user_id, workspace_id, archived);
create index if not exists uploads_workspace_idx on public.uploads (workspace_id, created_at desc);
create index if not exists workflows_workspace_idx on public.workflows (workspace_id, status);
create index if not exists workflow_runs_workspace_idx on public.workflow_runs (workspace_id, started_at desc);
create index if not exists audit_logs_scope_idx on public.audit_logs (organization_id, workspace_id, created_at desc);
create index if not exists analytics_scope_idx on public.analytics (organization_id, workspace_id, created_at desc);
create index if not exists analytics_event_idx on public.analytics (event_type, created_at desc);

create index if not exists memories_embedding_hnsw_idx
on public.memories
using hnsw (embedding vector_cosine_ops)
where embedding is not null and archived = false;

create index if not exists uploads_embedding_hnsw_idx
on public.uploads
using hnsw (embedding vector_cosine_ops)
where embedding is not null and status = 'ready';

create or replace function app_private.safe_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function app_private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'platform_admin'
  );
$$;

create or replace function app_private.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select app_private.is_platform_admin()
  or exists (
    select 1 from public.organization_members
    where organization_id = org_id
    and user_id = auth.uid()
  );
$$;

create or replace function app_private.is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select app_private.is_platform_admin()
  or exists (
    select 1 from public.organization_members
    where organization_id = org_id
    and user_id = auth.uid()
    and role in ('owner', 'admin')
  );
$$;

create or replace function app_private.workspace_role(workspace_id_arg uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = public, app_private
as $$
  select wm.role
  from public.workspace_members wm
  where wm.workspace_id = workspace_id_arg
  and wm.user_id = auth.uid()
  limit 1;
$$;

create or replace function app_private.can_read_workspace(workspace_id_arg uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select app_private.is_platform_admin()
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_id_arg
    and wm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.workspaces w
    where w.id = workspace_id_arg
    and app_private.is_org_admin(w.organization_id)
  );
$$;

create or replace function app_private.can_write_workspace(workspace_id_arg uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select app_private.is_platform_admin()
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_id_arg
    and wm.user_id = auth.uid()
    and wm.role in ('owner', 'admin', 'editor')
  )
  or exists (
    select 1
    from public.workspaces w
    where w.id = workspace_id_arg
    and app_private.is_org_admin(w.organization_id)
  );
$$;

create or replace function app_private.shares_org_with_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select target_user_id = auth.uid()
  or app_private.is_platform_admin()
  or exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
    and theirs.user_id = target_user_id
  );
$$;

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    case when not exists (select 1 from public.profiles) then 'platform_admin'::public.profile_role else 'user'::public.profile_role end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function app_private.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if old.role is distinct from new.role and not app_private.is_platform_admin() then
    raise exception 'Only platform admins can change profile roles';
  end if;
  return new;
end;
$$;

create or replace function app_private.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (organization_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

create or replace function app_private.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  insert into public.workspace_members (organization_id, workspace_id, user_id, role)
  values (new.organization_id, new.id, new.created_by, 'owner')
  on conflict (workspace_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_ai_workmate on auth.users;
create trigger on_auth_user_created_ai_workmate
after insert on auth.users
for each row execute function app_private.handle_new_user();

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
before update on public.profiles
for each row execute function app_private.prevent_profile_role_escalation();

drop trigger if exists organizations_create_owner_member on public.organizations;
create trigger organizations_create_owner_member
after insert on public.organizations
for each row execute function app_private.handle_new_organization();

drop trigger if exists workspaces_create_owner_member on public.workspaces;
create trigger workspaces_create_owner_member
after insert on public.workspaces
for each row execute function app_private.handle_new_workspace();

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','organizations','organization_members','workspaces','workspace_members',
    'settings','conversations','messages','message_citations','memories','uploads',
    'workflows','workflow_runs','tool_invocations','audit_logs','analytics'
  ]
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
      and table_name = t
      and column_name = 'updated_at'
    ) then
      execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function app_private.set_updated_at()', t, t);
    end if;
  end loop;
end $$;

create or replace function public.match_memories(
  query_embedding extensions.vector(1536),
  match_count int default 8,
  match_threshold float default 0.72,
  p_workspace_id uuid default null,
  p_organization_id uuid default null
)
returns table (
  id uuid,
  organization_id uuid,
  workspace_id uuid,
  user_id uuid,
  content text,
  kind text,
  tags text[],
  importance numeric,
  similarity float,
  metadata jsonb,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    m.id,
    m.organization_id,
    m.workspace_id,
    m.user_id,
    m.content,
    m.kind,
    m.tags,
    m.importance,
    1 - (m.embedding <=> query_embedding) as similarity,
    m.metadata,
    m.created_at
  from public.memories m
  where m.archived = false
    and m.embedding is not null
    and (p_workspace_id is null or m.workspace_id = p_workspace_id)
    and (p_organization_id is null or m.organization_id = p_organization_id)
    and 1 - (m.embedding <=> query_embedding) >= match_threshold
  order by m.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;

grant usage on schema app_private to anon, authenticated, service_role;
grant execute on all functions in schema app_private to anon, authenticated, service_role;
grant execute on function public.match_memories(extensions.vector, int, float, uuid, uuid) to authenticated, service_role;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
