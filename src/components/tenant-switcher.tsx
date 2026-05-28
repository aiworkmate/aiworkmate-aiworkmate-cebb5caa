import { Building2, ChevronsUpDown, Check, FolderKanban } from "lucide-react";
import { useTenant } from "@/lib/tenant";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TenantSwitcher() {
  const { organizations, workspaces, organization, workspace, setOrganization, setWorkspace, error, loading } = useTenant();

  const orgLabel = organization?.name ?? (loading ? "Loading…" : error ? "No organization" : "Select organization");
  const wsLabel = workspace?.name ?? (loading ? "" : "Select workspace");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs hover:bg-accent">
        <Building2 className="h-3.5 w-3.5 text-primary-glow" />
        <span className="font-medium max-w-[120px] truncate">{orgLabel}</span>
        {workspace && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="max-w-[140px] truncate">{wsLabel}</span>
          </>
        )}
        <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Organizations
        </DropdownMenuLabel>
        {organizations.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            {error ?? "No organizations available."}
          </div>
        )}
        {organizations.map((o) => (
          <DropdownMenuItem key={o.id} onClick={() => setOrganization(o)} className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">{o.name}</span>
            {organization?.id === o.id && <Check className="h-3.5 w-3.5 text-primary-glow" />}
          </DropdownMenuItem>
        ))}
        {organization && workspaces.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Workspaces in {organization.name}
            </DropdownMenuLabel>
            {workspaces.map((w) => (
              <DropdownMenuItem key={w.id} onClick={() => setWorkspace(w)} className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{w.name}</span>
                {workspace?.id === w.id && <Check className="h-3.5 w-3.5 text-primary-glow" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
