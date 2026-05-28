import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare, Brain, FileText, Workflow, ArrowUpRight,
  Sparkles, Activity, ShieldCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatusPill } from "@/components/page-primitives";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Overview · AI WorkMate" }] }),
  component: OverviewPage,
});

function OverviewPage() {
  const { user, profile } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["overview", user?.id],
    queryFn: async () => {
      const [c, m, u] = await Promise.all([
        supabase.from("conversations").select("id", { count: "exact", head: true }),
        supabase.from("memories").select("id", { count: "exact", head: true }),
        supabase.from("uploads").select("id", { count: "exact", head: true }),
      ]);
      return {
        conversations: c.count ?? 0,
        memories: m.count ?? 0,
        uploads: u.count ?? 0,
      };
    },
    enabled: !!user,
  });

  const cards = [
    { label: "Conversations", value: stats?.conversations ?? 0, icon: MessageSquare, to: "/app/chat", trend: "+12% vs last week" },
    { label: "Memories", value: stats?.memories ?? 0, icon: Brain, to: "/app/memory", trend: "Pinned: 3" },
    { label: "Documents", value: stats?.uploads ?? 0, icon: FileText, to: "/app/uploads", trend: "Ready to retrieve" },
    { label: "Active workflows", value: 4, icon: Workflow, to: "/app/workflows", trend: "2 ran today" },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <PageHeader
        eyebrow="Operator console"
        title={`Welcome back, ${profile?.display_name?.split(" ")[0] ?? "there"}.`}
        description="Your secure AI operating system at a glance."
        actions={<StatusPill tone="success">All systems nominal</StatusPill>}
      />

      <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="group rounded-xl border border-border bg-card p-5 shadow-elevated transition hover:border-primary/40">
            <div className="flex items-center justify-between">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-surface-elevated text-primary-glow">
                <c.icon className="h-4 w-4" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary-glow" />
            </div>
            <div className="mt-4 font-display text-3xl font-semibold tabular-nums">{c.value}</div>
            <div className="mt-1 text-sm font-medium text-muted-foreground">{c.label}</div>
            <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">{c.trend}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 px-6 pb-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Quickstart</div>
              <h2 className="mt-1 font-display text-lg font-semibold">Spin up your first secure conversation</h2>
            </div>
            <Sparkles className="h-5 w-5 text-primary-glow" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Conversations are persisted with row-level security. Memory and tool calls run through the backend orchestrator — never in the browser.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/app/chat" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90">
              <MessageSquare className="h-4 w-4" /> Start a chat
            </Link>
            <Link to="/app/uploads" className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-accent">
              <FileText className="h-4 w-4" /> Upload a document
            </Link>
            <Link to="/app/workflows" className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-accent">
              <Workflow className="h-4 w-4" /> Browse workflows
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            <span className="font-display text-sm font-semibold">Security posture</span>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center justify-between"><span className="text-muted-foreground">Row-level security</span><StatusPill tone="success">Enforced</StatusPill></li>
            <li className="flex items-center justify-between"><span className="text-muted-foreground">Audit log streaming</span><StatusPill tone="success">Live</StatusPill></li>
            <li className="flex items-center justify-between"><span className="text-muted-foreground">Tenant isolation</span><StatusPill tone="success">Per-org</StatusPill></li>
            <li className="flex items-center justify-between"><span className="text-muted-foreground">PII redaction</span><StatusPill tone="info">Adaptive</StatusPill></li>
          </ul>
        </div>
      </div>

      <div className="px-6 pb-10">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary-glow" />
            <span className="font-display text-sm font-semibold">Recent activity</span>
          </div>
          <div className="divide-y divide-border text-sm">
            {[
              { t: "2m ago", e: "Memory promoted to pinned", d: "Q3 OKR — clinical ops" },
              { t: "14m ago", e: "Workflow run completed", d: "intake-triage · 312ms" },
              { t: "1h ago", e: "Document indexed", d: "policy-v3.pdf · 24 chunks" },
              { t: "3h ago", e: "Role updated", d: "j.lopez → admin" },
            ].map((row) => (
              <div key={row.t} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{row.e}</div>
                  <div className="truncate text-xs text-muted-foreground">{row.d}</div>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">{row.t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
