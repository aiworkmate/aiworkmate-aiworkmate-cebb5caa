import { useState } from "react";
import { useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { Search, Bell, ChevronDown, LogOut, User as UserIcon, Menu, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { TenantSwitcher } from "@/components/tenant-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  MessageSquare, Brain, FileText, Workflow, BarChart3,
  Shield, Settings as SettingsIcon, Stethoscope, LayoutDashboard, ScrollText, Layers,
} from "lucide-react";

const mobileGroups = [
  { label: "Workspace", items: [
    { to: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/app/chat", label: "Chat", icon: MessageSquare },
    { to: "/app/memory", label: "Memory", icon: Brain },
    { to: "/app/context", label: "Context", icon: Layers },
    { to: "/app/uploads", label: "Documents", icon: FileText },
    { to: "/app/workflows", label: "Workflows", icon: Workflow },
  ]},
  { label: "Insights", items: [
    { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/app/medical", label: "Medical assistive", icon: Stethoscope },
  ]},
  { label: "Administration", items: [
    { to: "/app/admin", label: "Admin", icon: Shield },
    { to: "/app/audit", label: "Audit logs", icon: ScrollText },
    { to: "/app/settings", label: "Settings", icon: SettingsIcon },
  ]},
];

export function AppTopbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const initials = (profile?.display_name || user?.email || "U")
    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/60 px-3 backdrop-blur md:gap-3 md:px-6">
      {/* Mobile menu */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger asChild>
          <button
            className="grid h-10 w-10 place-items-center rounded-md border border-border bg-surface text-muted-foreground hover:text-foreground md:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <div className="flex h-14 items-center gap-2.5 border-b border-border px-5">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-primary shadow-glow">
              <span className="font-display text-xs font-bold text-primary-foreground">W</span>
            </div>
            <div className="font-display text-sm font-semibold">AI WorkMate</div>
          </div>
          <div className="px-3 pt-4">
            <Link
              to="/app/chat"
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center justify-center gap-2 rounded-md bg-gradient-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-glow"
            >
              <Plus className="h-4 w-4" /> New chat
            </Link>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {mobileGroups.map((g) => (
              <div key={g.label} className="mb-5">
                <div className="mb-1.5 px-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">{g.label}</div>
                <ul className="space-y-0.5">
                  {g.items.map((item) => {
                    const active = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");
                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          onClick={() => setMobileNavOpen(false)}
                          className={`flex min-h-[44px] items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm transition ${
                            active ? "bg-accent text-accent-foreground" : "text-foreground/80 hover:bg-accent/60"
                          }`}
                        >
                          <item.icon className="h-4 w-4" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <TenantSwitcher />

      <div className="relative ml-2 hidden flex-1 max-w-md md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search conversations, memories, documents…"
          className="w-full rounded-md border border-input bg-surface/60 py-1.5 pl-9 pr-16 text-sm outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring/40"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
      </div>

      <div className="ml-auto flex items-center gap-1.5 md:gap-2">
        <ThemeToggle />
        <button className="relative hidden h-10 w-10 place-items-center rounded-md border border-border bg-surface text-muted-foreground hover:text-foreground sm:grid md:h-8 md:w-8">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex min-h-[40px] items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 hover:bg-accent md:min-h-0">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-primary text-[10px] font-bold text-primary-foreground md:h-6 md:w-6">
              {initials}
            </div>
            <span className="hidden text-xs font-medium md:inline">{profile?.display_name || user?.email}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="text-sm font-medium">{profile?.display_name || "Operator"}</div>
              <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/app/settings" })}>
              <UserIcon className="mr-2 h-4 w-4" /> Profile & settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/login" }); }} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
