import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Workflow as WorkflowIcon, Play, Pause, ArrowUpRight, AlertTriangle } from "lucide-react";
import { PageHeader, StatusPill } from "@/components/page-primitives";
import { endpoints, type Workflow } from "@/lib/api/endpoints";
import { ApiNotConfiguredError } from "@/lib/api/client";
import { ApiNotConfigured, EmptyState } from "@/components/empty-states";
import { useTenant } from "@/lib/tenant";

export const Route = createFileRoute("/app/workflows")({
  head: () => ({ meta: [{ title: "Workflows · AI WorkMate" }] }),
  component: WorkflowsPage,
});

function WorkflowsPage() {
  const { ready } = useTenant();
  const q = useQuery({
    queryKey: ["workflows"],
    queryFn: () => endpoints.workflows.list(),
    enabled: ready,
    retry: false,
  });

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <PageHeader
        eyebrow="Automation"
        title="Workflows"
        description="Triggers + actions executed by the backend orchestrator. Permission- and workspace-aware end to end."
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90">
            <WorkflowIcon className="h-3.5 w-3.5" /> New workflow
          </button>
        }
      />

      <div className="p-6">
        {q.error instanceof ApiNotConfiguredError ? (
          <ApiNotConfigured feature="Workflows" />
        ) : q.isLoading ? (
          <SkeletonGrid />
        ) : (q.data ?? []).length === 0 ? (
          <EmptyState
            icon={WorkflowIcon}
            title="No workflows yet"
            description="Create a workflow to trigger actions on conversations, uploads, or schedules."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {q.data!.map((w) => <WorkflowCard key={w.id} w={w} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowCard({ w }: { w: Workflow }) {
  const failureRate = w.runs_total ? Math.round(((w.runs_failed ?? 0) / w.runs_total) * 1000) / 10 : 0;
  return (
    <Link
      to="/app/workflows/$id"
      params={{ id: w.id }}
      className="group flex flex-col rounded-xl border border-border bg-card p-5 transition hover:border-primary/40 hover:bg-card/80"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-surface-elevated text-primary-glow">
          <WorkflowIcon className="h-4 w-4" />
        </div>
        <StatusPill tone={w.status === "active" ? "success" : w.status === "paused" ? "neutral" : "warning"}>
          {w.status}
        </StatusPill>
      </div>
      <div className="mt-4 font-display text-base font-semibold leading-tight">{w.name}</div>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{w.description || "No description"}</p>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-xs">
        <Stat label="Trigger" value={w.trigger} mono />
        <Stat label="Runs" value={(w.runs_total ?? 0).toLocaleString()} />
        <Stat label="Failures" value={`${failureRate}%`} tone={failureRate > 5 ? "warn" : "ok"} />
      </div>

      <div className="mt-4 flex items-center gap-1">
        <button type="button" onClick={(e) => e.preventDefault()} className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface hover:bg-accent" title={w.status === "active" ? "Pause" : "Activate"}>
          {w.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 text-success" />}
        </button>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
          View runs <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}

function Stat({ label, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: "ok" | "warn" }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 truncate ${mono ? "font-mono text-[11px]" : "text-sm"} ${tone === "warn" ? "text-warning" : ""}`}>
        {tone === "warn" && <AlertTriangle className="mr-1 inline h-3 w-3" />}
        {value}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-44 animate-pulse rounded-xl border border-border bg-card/40" />
      ))}
    </div>
  );
}
