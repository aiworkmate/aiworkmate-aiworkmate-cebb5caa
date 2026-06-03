
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ============ TABLES ============
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  name text not null,
  description text,
  color text,
  status text not null default 'active',
  goals jsonb not null default '[]'::jsonb,
  milestones jsonb not null default '[]'::jsonb,
  decisions jsonb not null default '[]'::jsonb,
  notes text,
  sources jsonb not null default '[]'::jsonb
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  title text not null,
  project_id uuid references public.projects(id) on delete set null,
  agent_type text not null default 'general',
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  last_message_preview text,
  message_count integer not null default 0
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  agent_type text,
  sources jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  title text not null,
  description text,
  project_id uuid references public.projects(id) on delete set null,
  goal_id text,
  status text not null default 'todo',
  priority text not null default 'medium',
  due_date timestamptz,
  assigned_agent text not null default 'general',
  plan jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  result_summary text,
  verification_status text not null default 'unverified',
  retry_count integer not null default 0,
  requires_approval boolean not null default false,
  approved boolean not null default false
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  content text not null,
  layer text not null,
  source text,
  importance text not null default 'medium',
  confidence numeric(4,3) not null default 0.500 check (confidence >= 0 and confidence <= 1),
  verified boolean not null default false,
  project_id uuid references public.projects(id) on delete set null,
  tags text[] not null default '{}',
  is_pinned boolean not null default false,
  is_archived boolean not null default false
);

create table public.operational_knowledge (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  title text not null,
  content text not null,
  category text not null,
  source text,
  project_id uuid references public.projects(id) on delete set null,
  agent_type text,
  confidence numeric(4,3) not null default 0.750 check (confidence >= 0 and confidence <= 1),
  applied_count integer not null default 0,
  is_active boolean not null default true
);

create table public.agent_definitions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  agent_id text not null unique,
  label text not null,
  description text,
  status text not null default 'active',
  routing_keywords text[] not null default '{}',
  total_invocations integer not null default 0,
  avg_latency_ms integer,
  success_rate numeric(5,2),
  last_used timestamptz
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  title text not null,
  url text,
  type text,
  project_id uuid references public.projects(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  snippet text,
  fetched_at timestamptz,
  freshness_score numeric(4,3) check (freshness_score >= 0 and freshness_score <= 1),
  is_verified boolean not null default false,
  tags text[] not null default '{}'
);

create table public.health_metrics (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  metric_name text not null,
  category text not null,
  value numeric not null,
  unit text,
  status text,
  recorded_at timestamptz not null default now(),
  notes text
);

create table public.verification_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  claim text not null,
  verdict text not null,
  confidence numeric(4,3) not null default 0.750 check (confidence >= 0 and confidence <= 1),
  source text,
  evidence jsonb not null default '[]'::jsonb,
  agent_type text,
  conversation_id uuid references public.conversations(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  verified_at timestamptz not null default now()
);

create table public.tool_connections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  name text not null,
  tool_type text not null,
  status text not null default 'disconnected',
  description text,
  last_used timestamptz,
  invocation_count integer not null default 0,
  config jsonb not null default '{}'::jsonb
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  title text not null,
  type text,
  content text,
  file_url text,
  project_id uuid references public.projects(id) on delete set null,
  tags text[] not null default '{}',
  is_pinned boolean not null default false
);

-- ============ GRANTS ============
do $$
declare t text;
begin
  for t in select unnest(array['projects','conversations','messages','tasks','memories','operational_knowledge','agent_definitions','sources','health_metrics','verification_logs','tool_connections','documents'])
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- ============ INDEXES ============
create index idx_projects_created_by on public.projects(created_by);
create index idx_projects_status on public.projects(status);
create index idx_conversations_project_id on public.conversations(project_id);
create index idx_conversations_created_by on public.conversations(created_by);
create index idx_messages_conversation_id on public.messages(conversation_id);
create index idx_messages_created_by on public.messages(created_by);
create index idx_tasks_project_id on public.tasks(project_id);
create index idx_tasks_status on public.tasks(status);
create index idx_tasks_assigned_agent on public.tasks(assigned_agent);
create index idx_memories_project_id on public.memories(project_id);
create index idx_memories_layer on public.memories(layer);
create index idx_memories_verified on public.memories(verified);
create index idx_memories_tags on public.memories using gin(tags);
create index idx_ok_project_id on public.operational_knowledge(project_id);
create index idx_agent_definitions_agent_id on public.agent_definitions(agent_id);
create index idx_sources_project_id on public.sources(project_id);
create index idx_sources_conversation_id on public.sources(conversation_id);
create index idx_verification_logs_project_id on public.verification_logs(project_id);
create index idx_verification_logs_conversation_id on public.verification_logs(conversation_id);
create index idx_documents_project_id on public.documents(project_id);

-- ============ TRIGGERS ============
create trigger trg_projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger trg_conversations_updated_at before update on public.conversations for each row execute function public.set_updated_at();
create trigger trg_messages_updated_at before update on public.messages for each row execute function public.set_updated_at();
create trigger trg_tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger trg_memories_updated_at before update on public.memories for each row execute function public.set_updated_at();
create trigger trg_operational_knowledge_updated_at before update on public.operational_knowledge for each row execute function public.set_updated_at();
create trigger trg_agent_definitions_updated_at before update on public.agent_definitions for each row execute function public.set_updated_at();
create trigger trg_sources_updated_at before update on public.sources for each row execute function public.set_updated_at();
create trigger trg_health_metrics_updated_at before update on public.health_metrics for each row execute function public.set_updated_at();
create trigger trg_verification_logs_updated_at before update on public.verification_logs for each row execute function public.set_updated_at();
create trigger trg_tool_connections_updated_at before update on public.tool_connections for each row execute function public.set_updated_at();
create trigger trg_documents_updated_at before update on public.documents for each row execute function public.set_updated_at();

-- ============ RLS ============
alter table public.projects enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.tasks enable row level security;
alter table public.memories enable row level security;
alter table public.operational_knowledge enable row level security;
alter table public.agent_definitions enable row level security;
alter table public.sources enable row level security;
alter table public.health_metrics enable row level security;
alter table public.verification_logs enable row level security;
alter table public.tool_connections enable row level security;
alter table public.documents enable row level security;

create policy "projects_owner_all" on public.projects for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "conversations_owner_all" on public.conversations for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "messages_owner_all" on public.messages for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "tasks_owner_all" on public.tasks for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "memories_owner_all" on public.memories for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "operational_knowledge_owner_all" on public.operational_knowledge for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "agent_definitions_owner_all" on public.agent_definitions for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "sources_owner_all" on public.sources for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "health_metrics_owner_all" on public.health_metrics for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "verification_logs_owner_all" on public.verification_logs for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "tool_connections_owner_all" on public.tool_connections for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "documents_owner_all" on public.documents for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
