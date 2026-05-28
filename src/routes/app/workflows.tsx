import { createFileRoute } from "@tanstack/react-router";
import { Workflow, Play, Pause, RotateCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { PageHeader, StatusPill } from "@/components/page-primitives";

export const Route = createFileRoute("/app/workflows")({
  head: () => ({ meta: [{ title: "Workflows · AI WorkMate" }] }),
  component: WorkflowsPage,
});

const workflows = [
  { id: "wf-1", name: "Intake triage", trigger: "Inbound message", actions: 4, enabled: true, runs: 1284, success: 99.2 },
  { id: "wf-2", name: "Document indexer", trigger: "Upload created", actions: 3, enabled: true, runs: 412, success: 97.8 },
  { id: "wf-3", name: "Daily digest", trigger: "Cron · 09:00", actions: 5, enabled: true, runs: 36, success: 100 },
  { id: "wf-4", name: "Compliance escalation", trigger: "Memory tag: PHI", actions: 6, enabled: false, runs: 8, success: 87.5 },
];

const runs = [
  { id: "r-9821", wf: "Intake triage", status: "success", dur: "312ms", at: "2m ago" },
  { id: "r-9820", wf: "Document indexer", status: "success", dur: "1.4s", at: "9m ago" },
  { id: "r-9819", wf: "Intake triage", status: "success", dur: "298ms", at: "14m ago" },
  { id: "r-9818", wf: "Compliance escalation", status: "failed", dur: "812ms", at: "1h ago" },
  { id: "r-9817", wf: "Daily digest", status: "success", dur: "4.2s", at: "5h ago" },
];

function WorkflowsPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <PageHeader
        eyebrow="Automation"
        title="Workflows"
        description="Triggered actions executed by the backend orchestrator. Permission-aware end to end."
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90">
            <Workflow className="h-3.5 w-3.5" /> New workflow
          </button>
        }
      />

      <div className="grid gap-4 p-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3 font-display text-sm font-semibold">All workflows</div>
          <div className="divide-y divide-border">
            {workflows.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-surface-elevated text-primary-glow">
                  <Workflow className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{w.name}</span>
                    <StatusPill tone={w.enabled ? "success" : "neutral"}>{w.enabled ? "Active" : "Paused"}</StatusPill>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">trigger: {w.trigger} · {w.actions} actions · {w.runs.toLocaleString()} runs · {w.success}% success</div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface hover:bg-accent" title="Run">
                    <Play className="h-3.5 w-3.5" />
                  </button>
                  <button className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface hover:bg-accent" title={w.enabled ? "Disable" : "Enable"}>
                    {w.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 text-success" />}
                  </button>
                  <button className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface hover:bg-accent" title="Retry">
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3 font-display text-sm font-semibold">Recent runs</div>
          <div className="divide-y divide-border">
            {runs.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                {r.status === "success" ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.wf}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{r.id} · {r.dur}</div>
                </div>
                <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground"><Clock className="h-3 w-3" /> {r.at}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
