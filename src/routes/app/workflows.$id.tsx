import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Workflow as WorkflowIcon, ChevronLeft, CheckCircle2, XCircle, Loader2,
  CircleDashed, Play, Pause, RotateCw, ArrowRight, Terminal,
} from "lucide-react";
import { PageHeader, StatusPill } from "@/components/page-primitives";
import { endpoints, type WorkflowRun, type WorkflowStep } from "@/lib/api/endpoints";
import { ApiNotConfiguredError } from "@/lib/api/client";
import { ApiNotConfigured } from "@/components/empty-states";
import { useState } from "react";

export const Route = createFileRoute("/app/workflows/$id")({
  head: () => ({ meta: [{ title: "Workflow · AI WorkMate" }] }),
  component: WorkflowDetail,
});

function WorkflowDetail() {
  const { id } = Route.useParams();
  const wf = useQuery({
    queryKey: ["workflow", id],
    queryFn: () => endpoints.workflows.get(id),
    retry: false,
  });
  const runs = useQuery({
    queryKey: ["workflow", id, "runs"],
    queryFn: () => endpoints.workflows.runs(id, { page: 1, page_size: 20 }),
    retry: false,
  });
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);

  if (wf.error instanceof ApiNotConfiguredError) return <ApiNotConfigured feature="Workflows" />;

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <div className="border-b border-border px-6 pt-4">
        <Link to="/app/workflows" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> All workflows
        </Link>
      </div>
      <PageHeader
        eyebrow="Workflow"
        title={wf.data?.name ?? (wf.isLoading ? "Loading…" : "Workflow")}
        description={wf.data?.description ?? ""}
        actions={
          wf.data && (
            <div className="flex items-center gap-2">
              <StatusPill tone={wf.data.status === "active" ? "success" : "neutral"}>{wf.data.status}</StatusPill>
              <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-accent">
                {wf.data.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {wf.data.status === "active" ? "Pause" : "Activate"}
              </button>
            </div>
          )
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-display text-sm font-semibold">Pipeline</h3>
          <div className="mt-4 flex flex-wrap items-stretch gap-2">
            {(wf.data?.steps ?? placeholderSteps).map((s, i, arr) => (
              <div key={s.id} className="flex items-center gap-2">
                <StepChip step={s} />
                {i < arr.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Workflow steps are defined and executed by the backend orchestrator. This panel is read-only in v1.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h3 className="font-display text-sm font-semibold">Execution history</h3>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {runs.data?.total ?? 0} total
            </span>
          </div>
          <div className="max-h-[420px] divide-y divide-border overflow-y-auto scrollbar-thin">
            {runs.isLoading && <div className="p-5 text-xs text-muted-foreground">Loading runs…</div>}
            {!runs.isLoading && (runs.data?.items.length ?? 0) === 0 && (
              <div className="p-5 text-xs text-muted-foreground">No runs yet.</div>
            )}
            {runs.data?.items.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRun(r)}
                className={`flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition hover:bg-accent/40 ${
                  selectedRun?.id === r.id ? "bg-accent/30" : ""
                }`}
              >
                <RunIcon status={r.status} />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs">{r.id}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(r.started_at).toLocaleString()}
                    {r.duration_ms ? ` · ${Math.round(r.duration_ms)}ms` : ""}
                  </div>
                </div>
                <StatusPill tone={runTone(r.status)}>{r.status}</StatusPill>
              </button>
            ))}
          </div>
        </section>

        {selectedRun && (
          <section className="lg:col-span-2 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-primary-glow" />
                <h3 className="font-display text-sm font-semibold">Run logs · {selectedRun.id}</h3>
              </div>
              {selectedRun.status === "failed" && (
                <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs hover:bg-accent">
                  <RotateCw className="h-3 w-3" /> Retry
                </button>
              )}
            </div>
            <pre className="max-h-80 overflow-auto scrollbar-thin p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
{(selectedRun.logs ?? []).map((l) => `[${l.ts}] ${l.level.toUpperCase().padEnd(5)} ${l.message}`).join("\n")
  || "No logs available for this run."}
            </pre>
          </section>
        )}
      </div>
    </div>
  );
}

const placeholderSteps: WorkflowStep[] = [
  { id: "1", type: "trigger", name: "Trigger" },
  { id: "2", type: "action", name: "Action" },
];

function StepChip({ step }: { step: WorkflowStep }) {
  const tone = step.type === "trigger" ? "bg-primary/15 text-primary-glow border-primary/30"
    : step.type === "condition" ? "bg-warning/15 text-warning border-warning/30"
    : "bg-surface-elevated text-foreground border-border";
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${tone}`}>
      <WorkflowIcon className="h-3 w-3" />
      <span className="font-medium">{step.name}</span>
      <span className="font-mono text-[10px] uppercase opacity-70">{step.type}</span>
    </div>
  );
}

function RunIcon({ status }: { status: WorkflowRun["status"] }) {
  switch (status) {
    case "succeeded": return <CheckCircle2 className="h-4 w-4 text-success" />;
    case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
    case "running": return <Loader2 className="h-4 w-4 animate-spin text-primary-glow" />;
    default: return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
  }
}

function runTone(s: WorkflowRun["status"]) {
  if (s === "succeeded") return "success" as const;
  if (s === "failed") return "danger" as const;
  if (s === "running") return "info" as const;
  return "neutral" as const;
}
