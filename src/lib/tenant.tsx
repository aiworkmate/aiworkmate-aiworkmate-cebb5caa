import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { endpoints, type Organization, type Workspace } from "@/lib/api/endpoints";
import { setTenantHeaders, ApiNotConfiguredError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

interface TenantCtx {
  organizations: Organization[];
  workspaces: Workspace[];
  organization: Organization | null;
  workspace: Workspace | null;
  setOrganization: (org: Organization) => void;
  setWorkspace: (ws: Workspace) => void;
  loading: boolean;
  error: string | null;
  /** True only when the backend API is reachable and tenancy data has loaded. */
  ready: boolean;
}

const Ctx = createContext<TenantCtx | null>(null);
const ORG_KEY = "workmate.org_id";
const WS_KEY = "workmate.workspace_id";

export function TenantProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  const orgsQ = useQuery({
    queryKey: ["organizations"],
    queryFn: () => endpoints.organizations.list(),
    enabled: Boolean(session),
    retry: false,
    staleTime: 60_000,
  });

  const organizations = orgsQ.data ?? [];
  const [orgId, setOrgId] = useState<string | null>(() => (typeof window !== "undefined" ? localStorage.getItem(ORG_KEY) : null));
  const [wsId, setWsId] = useState<string | null>(() => (typeof window !== "undefined" ? localStorage.getItem(WS_KEY) : null));

  useEffect(() => {
    if (!orgId && organizations[0]) setOrgId(organizations[0].id);
  }, [orgId, organizations]);

  const wsQ = useQuery({
    queryKey: ["workspaces", orgId],
    queryFn: () => endpoints.workspaces.list(orgId!),
    enabled: Boolean(session && orgId),
    retry: false,
    staleTime: 60_000,
  });

  const workspaces = wsQ.data ?? [];
  useEffect(() => {
    if (orgId && (!wsId || !workspaces.some((w) => w.id === wsId)) && workspaces[0]) {
      setWsId(workspaces[0].id);
    }
  }, [orgId, wsId, workspaces]);

  // Persist + propagate as request headers
  useEffect(() => {
    if (orgId) localStorage.setItem(ORG_KEY, orgId); else localStorage.removeItem(ORG_KEY);
    if (wsId) localStorage.setItem(WS_KEY, wsId); else localStorage.removeItem(WS_KEY);
    setTenantHeaders({ organizationId: orgId, workspaceId: wsId });
  }, [orgId, wsId]);

  const organization = useMemo(() => organizations.find((o) => o.id === orgId) ?? null, [organizations, orgId]);
  const workspace = useMemo(() => workspaces.find((w) => w.id === wsId) ?? null, [workspaces, wsId]);

  const setOrganization = useCallback((org: Organization) => {
    setOrgId(org.id);
    setWsId(null);
  }, []);
  const setWorkspace = useCallback((ws: Workspace) => setWsId(ws.id), []);

  const apiError = orgsQ.error;
  const notConfigured = apiError instanceof ApiNotConfiguredError;
  const error = apiError ? (notConfigured ? "Backend API not configured" : (apiError as Error).message) : null;

  return (
    <Ctx.Provider
      value={{
        organizations,
        workspaces,
        organization,
        workspace,
        setOrganization,
        setWorkspace,
        loading: orgsQ.isLoading || wsQ.isLoading,
        error,
        ready: Boolean(organization && workspace),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useTenant() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTenant outside TenantProvider");
  return v;
}
