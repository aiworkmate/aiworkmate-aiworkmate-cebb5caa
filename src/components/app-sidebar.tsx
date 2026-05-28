import { Link, useRouterState } from "@tanstack/react-router";
import {
  MessageSquare, Brain, FileText, Workflow, BarChart3,
  Shield, Settings, Stethoscope, LayoutDashboard, Plus, ScrollText,
} from "lucide-react";

const groups = [
  {
    label: "Workspace",
    items: [
      { to: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
      { to: "/app/chat", label: "Chat", icon: MessageSquare },
      { to: "/app/memory", label: "Memory", icon: Brain },
      { to: "/app/uploads", label: "Documents", icon: FileText },
      { to: "/app/workflows", label: "Workflows", icon: Workflow },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/app/medical", label: "Medical assistive", icon: Stethoscope },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/app/admin", label: "Admin", icon: Shield },
      { to: "/app/audit", label: "Audit logs", icon: ScrollText },
      { to: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];


export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string, exact?: boolean) => exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-primary shadow-glow">
          <span className="font-display text-xs font-bold text-primary-foreground">W</span>
        </div>
        <div className="min-w-0">
          <div className="truncate font-display text-sm font-semibold leading-none">AI WorkMate</div>
          <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Acme · Production</div>
        </div>
      </div>

      <div className="px-3 pt-4">
        <Link
          to="/app/chat"
          className="flex items-center justify-center gap-2 rounded-md bg-gradient-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New chat
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        {groups.map((g) => (
          <div key={g.label} className="mb-5">
            <div className="mb-1.5 px-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">{g.label}</div>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = isActive(item.to, item.exact);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={`group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition ${
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_1px_0_0_oklch(1_0_0/0.04)]"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      <item.icon className={`h-4 w-4 ${active ? "text-primary-glow" : "text-muted-foreground group-hover:text-foreground"}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-lg border border-border bg-surface/60 p-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            <span className="font-medium">All systems nominal</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Audit log streaming · RLS active</p>
        </div>
      </div>
    </aside>
  );
}
