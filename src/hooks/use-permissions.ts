/**
 * Permission + tenancy hooks.
 *
 * Thin placeholders that read from the TenantProvider today. The backend will
 * eventually return memberships with roles and a permissions matrix on session
 * bootstrap; feature code should consume these hooks instead of inspecting
 * role strings directly so that swap is transparent.
 *
 * IMPORTANT: never enforce security here. The backend (RLS + scoped APIs) is
 * the source of truth. These hooks only drive UI affordances.
 */
import { useMemo } from "react";
import { useTenant } from "@/lib/tenant";
import type { Organization, Workspace } from "@/lib/api/endpoints";

export type Role = "owner" | "admin" | "member" | "viewer";

export type Permission =
  | "workspace.read"
  | "workspace.write"
  | "members.manage"
  | "workflows.read"
  | "workflows.write"
  | "workflows.run"
  | "uploads.read"
  | "uploads.write"
  | "memory.read"
  | "memory.write"
  | "audit.read"
  | "admin.access";

/** Current organization (or null while bootstrapping). */
export function useOrganization(): {
  organization: Organization | null;
  organizations: Organization[];
  setOrganization: (org: Organization) => void;
  loading: boolean;
} {
  const t = useTenant();
  return {
    organization: t.organization,
    organizations: t.organizations,
    setOrganization: t.setOrganization,
    loading: t.loading,
  };
}

/** Current workspace (or null while bootstrapping). */
export function useWorkspace(): {
  workspace: Workspace | null;
  workspaces: Workspace[];
  setWorkspace: (ws: Workspace) => void;
  loading: boolean;
} {
  const t = useTenant();
  return {
    workspace: t.workspace,
    workspaces: t.workspaces,
    setWorkspace: t.setWorkspace,
    loading: t.loading,
  };
}

/**
 * Placeholder permission resolver. Until the backend ships membership +
 * permissions on session bootstrap, every authenticated session is treated as
 * a member with read access. The signature is stable, so call sites won't
 * need to change when real data arrives.
 */
export function usePermissions(): {
  role: Role | null;
  can: (permission: Permission) => boolean;
  isOwner: boolean;
  isAdmin: boolean;
  ready: boolean;
} {
  const { workspace } = useWorkspace();

  return useMemo(() => {
    const role: Role | null = workspace ? "member" : null;
    return {
      role,
      can: (_permission: Permission) => Boolean(workspace),
      isOwner: false,
      isAdmin: false,
      ready: Boolean(workspace),
    };
  }, [workspace]);
}
