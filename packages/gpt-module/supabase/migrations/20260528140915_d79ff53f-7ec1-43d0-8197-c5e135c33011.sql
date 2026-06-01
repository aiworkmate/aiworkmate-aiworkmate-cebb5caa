CREATE OR REPLACE FUNCTION app_private.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
declare
  v_org_id uuid;
  v_workspace_id uuid;
  display text;
begin
  display := coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'AI WorkMate User');

  insert into public.profiles (id, user_id, email, display_name)
  values (new.id, new.id, new.email, display)
  on conflict (id) do update
    set user_id = excluded.user_id,
        email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        updated_at = now();

  insert into public.user_roles (user_id, role)
  values (new.id, 'member')
  on conflict (user_id, role) do nothing;

  insert into public.organizations (name, slug, owner_id, metadata)
  values (
    display || '''s Organization',
    lower(regexp_replace(display, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || left(new.id::text, 8),
    new.id,
    jsonb_build_object('bootstrap', true)
  )
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, new.id, 'owner')
  on conflict (organization_id, user_id) do update set role = excluded.role;

  insert into public.workspaces (organization_id, name, slug, created_by, metadata)
  values (v_org_id, 'Personal Workspace', 'personal', new.id, jsonb_build_object('bootstrap', true))
  returning id into v_workspace_id;

  insert into public.workspace_members (organization_id, workspace_id, user_id, role)
  values (v_org_id, v_workspace_id, new.id, 'owner')
  on conflict (workspace_id, user_id) do update set role = excluded.role;

  update public.profiles
  set default_organization_id = v_org_id,
      default_workspace_id = v_workspace_id,
      updated_at = now()
  where user_id = new.id;

  return new;
end;
$function$;