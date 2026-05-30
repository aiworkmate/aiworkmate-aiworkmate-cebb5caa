-- AI WorkMate RLS policies and private Storage buckets.
-- Versioned migration only. Review before applying to any production project.

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.settings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_citations enable row level security;
alter table public.memories enable row level security;
alter table public.uploads enable row level security;
alter table public.workflows enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.tool_invocations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.analytics enable row level security;

drop policy if exists profiles_select_own_org_or_admin on public.profiles;
create policy profiles_select_own_org_or_admin
on public.profiles for select
using (id = auth.uid() or app_private.shares_org_with_user(id));

drop policy if exists profiles_insert_service_or_self on public.profiles;
create policy profiles_insert_service_or_self
on public.profiles for insert
with check (id = auth.uid() or app_private.is_platform_admin());

drop policy if exists profiles_update_self_or_platform_admin on public.profiles;
create policy profiles_update_self_or_platform_admin
on public.profiles for update
using (id = auth.uid() or app_private.is_platform_admin())
with check (id = auth.uid() or app_private.is_platform_admin());

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member
on public.organizations for select
using (app_private.is_org_member(id));

drop policy if exists organizations_insert_owner on public.organizations;
create policy organizations_insert_owner
on public.organizations for insert
with check (owner_id = auth.uid() or app_private.is_platform_admin());

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin
on public.organizations for update
using (app_private.is_org_admin(id))
with check (app_private.is_org_admin(id));

drop policy if exists organizations_delete_platform_admin on public.organizations;
create policy organizations_delete_platform_admin
on public.organizations for delete
using (app_private.is_platform_admin());

drop policy if exists organization_members_select_member on public.organization_members;
create policy organization_members_select_member
on public.organization_members for select
using (app_private.is_org_member(organization_id));

drop policy if exists organization_members_insert_admin on public.organization_members;
create policy organization_members_insert_admin
on public.organization_members for insert
with check (app_private.is_org_admin(organization_id));

drop policy if exists organization_members_update_admin on public.organization_members;
create policy organization_members_update_admin
on public.organization_members for update
using (app_private.is_org_admin(organization_id))
with check (app_private.is_org_admin(organization_id));

drop policy if exists organization_members_delete_admin on public.organization_members;
create policy organization_members_delete_admin
on public.organization_members for delete
using (app_private.is_org_admin(organization_id));

drop policy if exists workspaces_select_reader on public.workspaces;
create policy workspaces_select_reader
on public.workspaces for select
using (app_private.can_read_workspace(id));

drop policy if exists workspaces_insert_org_admin on public.workspaces;
create policy workspaces_insert_org_admin
on public.workspaces for insert
with check (created_by = auth.uid() and app_private.is_org_member(organization_id));

drop policy if exists workspaces_update_admin on public.workspaces;
create policy workspaces_update_admin
on public.workspaces for update
using (app_private.is_org_admin(organization_id) or app_private.workspace_role(id) in ('owner', 'admin'))
with check (app_private.is_org_admin(organization_id) or app_private.workspace_role(id) in ('owner', 'admin'));

drop policy if exists workspaces_delete_org_admin on public.workspaces;
create policy workspaces_delete_org_admin
on public.workspaces for delete
using (app_private.is_org_admin(organization_id));

drop policy if exists workspace_members_select_reader on public.workspace_members;
create policy workspace_members_select_reader
on public.workspace_members for select
using (app_private.can_read_workspace(workspace_id));

drop policy if exists workspace_members_insert_admin on public.workspace_members;
create policy workspace_members_insert_admin
on public.workspace_members for insert
with check (app_private.is_org_admin(organization_id) or app_private.workspace_role(workspace_id) in ('owner', 'admin'));

drop policy if exists workspace_members_update_admin on public.workspace_members;
create policy workspace_members_update_admin
on public.workspace_members for update
using (app_private.is_org_admin(organization_id) or app_private.workspace_role(workspace_id) in ('owner', 'admin'))
with check (app_private.is_org_admin(organization_id) or app_private.workspace_role(workspace_id) in ('owner', 'admin'));

drop policy if exists workspace_members_delete_admin on public.workspace_members;
create policy workspace_members_delete_admin
on public.workspace_members for delete
using (app_private.is_org_admin(organization_id) or app_private.workspace_role(workspace_id) in ('owner', 'admin'));

drop policy if exists settings_select_scope on public.settings;
create policy settings_select_scope
on public.settings for select
using (
  (scope = 'user' and user_id = auth.uid())
  or (scope = 'organization' and app_private.is_org_member(organization_id))
  or (scope = 'workspace' and app_private.can_read_workspace(workspace_id))
);

drop policy if exists settings_write_scope on public.settings;
create policy settings_write_scope
on public.settings for all
using (
  (scope = 'user' and user_id = auth.uid())
  or (scope = 'organization' and app_private.is_org_admin(organization_id))
  or (scope = 'workspace' and app_private.can_write_workspace(workspace_id))
)
with check (
  (scope = 'user' and user_id = auth.uid())
  or (scope = 'organization' and app_private.is_org_admin(organization_id))
  or (scope = 'workspace' and app_private.can_write_workspace(workspace_id))
);

drop policy if exists conversations_select_workspace_reader on public.conversations;
create policy conversations_select_workspace_reader
on public.conversations for select
using (app_private.can_read_workspace(workspace_id));

drop policy if exists conversations_insert_workspace_writer on public.conversations;
create policy conversations_insert_workspace_writer
on public.conversations for insert
with check (user_id = auth.uid() and app_private.can_write_workspace(workspace_id));

drop policy if exists conversations_update_workspace_writer on public.conversations;
create policy conversations_update_workspace_writer
on public.conversations for update
using (app_private.can_write_workspace(workspace_id))
with check (app_private.can_write_workspace(workspace_id));

drop policy if exists conversations_delete_workspace_admin on public.conversations;
create policy conversations_delete_workspace_admin
on public.conversations for delete
using (app_private.workspace_role(workspace_id) in ('owner', 'admin') or app_private.is_org_admin(organization_id));

drop policy if exists messages_select_workspace_reader on public.messages;
create policy messages_select_workspace_reader
on public.messages for select
using (app_private.can_read_workspace(workspace_id));

drop policy if exists messages_insert_workspace_writer on public.messages;
create policy messages_insert_workspace_writer
on public.messages for insert
with check (app_private.can_write_workspace(workspace_id));

drop policy if exists messages_update_workspace_admin on public.messages;
create policy messages_update_workspace_admin
on public.messages for update
using (app_private.workspace_role(workspace_id) in ('owner', 'admin') or app_private.is_org_admin(organization_id))
with check (app_private.workspace_role(workspace_id) in ('owner', 'admin') or app_private.is_org_admin(organization_id));

drop policy if exists citations_select_workspace_reader on public.message_citations;
create policy citations_select_workspace_reader
on public.message_citations for select
using (app_private.can_read_workspace(workspace_id));

drop policy if exists citations_write_workspace_writer on public.message_citations;
create policy citations_write_workspace_writer
on public.message_citations for all
using (app_private.can_write_workspace(workspace_id))
with check (app_private.can_write_workspace(workspace_id));

drop policy if exists memories_select_owner_or_workspace_reader on public.memories;
create policy memories_select_owner_or_workspace_reader
on public.memories for select
using (user_id = auth.uid() or (workspace_id is not null and app_private.can_read_workspace(workspace_id)));

drop policy if exists memories_insert_owner on public.memories;
create policy memories_insert_owner
on public.memories for insert
with check (user_id = auth.uid() and app_private.is_org_member(organization_id) and (workspace_id is null or app_private.can_write_workspace(workspace_id)));

drop policy if exists memories_update_owner on public.memories;
create policy memories_update_owner
on public.memories for update
using (user_id = auth.uid() or app_private.is_org_admin(organization_id))
with check (user_id = auth.uid() or app_private.is_org_admin(organization_id));

drop policy if exists memories_delete_owner on public.memories;
create policy memories_delete_owner
on public.memories for delete
using (user_id = auth.uid() or app_private.is_org_admin(organization_id));

drop policy if exists uploads_select_workspace_reader on public.uploads;
create policy uploads_select_workspace_reader
on public.uploads for select
using (app_private.can_read_workspace(workspace_id));

drop policy if exists uploads_insert_owner_writer on public.uploads;
create policy uploads_insert_owner_writer
on public.uploads for insert
with check (user_id = auth.uid() and app_private.can_write_workspace(workspace_id));

drop policy if exists uploads_update_owner_writer on public.uploads;
create policy uploads_update_owner_writer
on public.uploads for update
using ((user_id = auth.uid() and app_private.can_write_workspace(workspace_id)) or app_private.is_org_admin(organization_id))
with check ((user_id = auth.uid() and app_private.can_write_workspace(workspace_id)) or app_private.is_org_admin(organization_id));

drop policy if exists uploads_delete_owner_admin on public.uploads;
create policy uploads_delete_owner_admin
on public.uploads for delete
using (user_id = auth.uid() or app_private.is_org_admin(organization_id));

drop policy if exists workflows_select_workspace_reader on public.workflows;
create policy workflows_select_workspace_reader
on public.workflows for select
using (app_private.can_read_workspace(workspace_id));

drop policy if exists workflows_write_workspace_writer on public.workflows;
create policy workflows_write_workspace_writer
on public.workflows for all
using (app_private.can_write_workspace(workspace_id))
with check (app_private.can_write_workspace(workspace_id));

drop policy if exists workflow_runs_select_workspace_reader on public.workflow_runs;
create policy workflow_runs_select_workspace_reader
on public.workflow_runs for select
using (app_private.can_read_workspace(workspace_id));

drop policy if exists workflow_runs_write_workspace_writer on public.workflow_runs;
create policy workflow_runs_write_workspace_writer
on public.workflow_runs for all
using (app_private.can_write_workspace(workspace_id))
with check (app_private.can_write_workspace(workspace_id));

drop policy if exists tool_invocations_select_workspace_reader on public.tool_invocations;
create policy tool_invocations_select_workspace_reader
on public.tool_invocations for select
using (app_private.can_read_workspace(workspace_id));

drop policy if exists tool_invocations_insert_workspace_writer on public.tool_invocations;
create policy tool_invocations_insert_workspace_writer
on public.tool_invocations for insert
with check (app_private.can_write_workspace(workspace_id));

drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin
on public.audit_logs for select
using (
  app_private.is_platform_admin()
  or (organization_id is not null and app_private.is_org_admin(organization_id))
  or (workspace_id is not null and app_private.workspace_role(workspace_id) in ('owner', 'admin'))
);

drop policy if exists audit_logs_insert_authenticated on public.audit_logs;
create policy audit_logs_insert_authenticated
on public.audit_logs for insert
with check (auth.uid() is not null);

drop policy if exists analytics_select_admin on public.analytics;
create policy analytics_select_admin
on public.analytics for select
using (
  app_private.is_platform_admin()
  or (organization_id is not null and app_private.is_org_admin(organization_id))
  or (workspace_id is not null and app_private.workspace_role(workspace_id) in ('owner', 'admin'))
);

drop policy if exists analytics_insert_authenticated on public.analytics;
create policy analytics_insert_authenticated
on public.analytics for insert
with check (auth.uid() is not null);

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('uploads', 'uploads', false, 52428800),
  ('documents', 'documents', false, 52428800),
  ('avatars', 'avatars', false, 10485760),
  ('workflow-assets', 'workflow-assets', false, 52428800),
  ('temporary-files', 'temporary-files', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

drop policy if exists ai_workmate_storage_workspace_read on storage.objects;
create policy ai_workmate_storage_workspace_read
on storage.objects for select
using (
  bucket_id in ('uploads', 'documents', 'workflow-assets', 'temporary-files')
  and app_private.can_read_workspace(app_private.safe_uuid(split_part(name, '/', 2)))
);

drop policy if exists ai_workmate_storage_workspace_insert on storage.objects;
create policy ai_workmate_storage_workspace_insert
on storage.objects for insert
with check (
  bucket_id in ('uploads', 'documents', 'workflow-assets', 'temporary-files')
  and auth.uid() = app_private.safe_uuid(split_part(name, '/', 3))
  and app_private.can_write_workspace(app_private.safe_uuid(split_part(name, '/', 2)))
);

drop policy if exists ai_workmate_storage_workspace_update on storage.objects;
create policy ai_workmate_storage_workspace_update
on storage.objects for update
using (
  bucket_id in ('uploads', 'documents', 'workflow-assets', 'temporary-files')
  and app_private.can_write_workspace(app_private.safe_uuid(split_part(name, '/', 2)))
)
with check (
  bucket_id in ('uploads', 'documents', 'workflow-assets', 'temporary-files')
  and app_private.can_write_workspace(app_private.safe_uuid(split_part(name, '/', 2)))
);

drop policy if exists ai_workmate_storage_workspace_delete on storage.objects;
create policy ai_workmate_storage_workspace_delete
on storage.objects for delete
using (
  bucket_id in ('uploads', 'documents', 'workflow-assets', 'temporary-files')
  and app_private.can_write_workspace(app_private.safe_uuid(split_part(name, '/', 2)))
);

drop policy if exists ai_workmate_avatars_read on storage.objects;
create policy ai_workmate_avatars_read
on storage.objects for select
using (
  bucket_id = 'avatars'
  and app_private.shares_org_with_user(app_private.safe_uuid(split_part(name, '/', 1)))
);

drop policy if exists ai_workmate_avatars_insert on storage.objects;
create policy ai_workmate_avatars_insert
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.uid() = app_private.safe_uuid(split_part(name, '/', 1))
);

drop policy if exists ai_workmate_avatars_update on storage.objects;
create policy ai_workmate_avatars_update
on storage.objects for update
using (
  bucket_id = 'avatars'
  and auth.uid() = app_private.safe_uuid(split_part(name, '/', 1))
)
with check (
  bucket_id = 'avatars'
  and auth.uid() = app_private.safe_uuid(split_part(name, '/', 1))
);

drop policy if exists ai_workmate_avatars_delete on storage.objects;
create policy ai_workmate_avatars_delete
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and (auth.uid() = app_private.safe_uuid(split_part(name, '/', 1)) or app_private.is_platform_admin())
);
