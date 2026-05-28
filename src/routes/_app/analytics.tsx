import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download } from "lucide-react";
import { PageHeader, StatusPill } from "@/components/page-primitives";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({ meta: [{ title: "Analytics · AI WorkMate" }] }),
  component: AnalyticsPage,
});

const ranges = ["24h", "7d", "30d", "90d"] as const;

function AnalyticsPage() {
  const [range, setRange] = useState<typeof ranges[number]>("7d");

  const series = Array.from({ length: 24 }, (_, i) => 30 + Math.round(Math.sin(i / 3) * 18 + Math.random() * 22));
  const max = Math.max(...series);

  const tools = [
    { name: "memory.retrieve", calls: 8420, p95: 142 },
    { name: "documents.search", calls: 5210, p95: 198 },
    { name: "workflows.trigger", calls: 1820, p95: 92 },
    { name: "policy.check", calls: 1290, p95: 38 },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <PageHeader
        eyebrow="Operational telemetry"
        title="Analytics"
        description="Usage, latency, and reliability across your tenant."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border bg-surface p-0.5">
              {ranges.map((r) => (
                <button key={r} onClick={() => setRange(r)}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {r}
                </button>
              ))}
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-accent">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        }
      />

      <div className="grid gap-4 p-6 md:grid-cols-4">
        {[
          { l: "Conversations", v: "1,284", d: "+12.4%" },
          { l: "Active users", v: "326", d: "+4.1%" },
          { l: "Avg latency", v: "412ms", d: "−18ms" },
          { l: "Error rate", v: "0.32%", d: "−0.04%" },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-border bg-card p-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k.l}</div>
            <div className="mt-2 font-display text-2xl font-semibold tabular-nums">{k.v}</div>
            <div className="mt-1 text-xs text-success">{k.d}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 px-6 pb-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-display text-sm font-semibold">Conversation volume</div>
            <StatusPill tone="info">{range}</StatusPill>
          </div>
          <div className="flex h-48 items-end gap-1.5">
            {series.map((v, i) => (
              <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary/30 to-primary-glow transition hover:opacity-80"
                style={{ height: `${(v / max) * 100}%` }} title={`${v}`} />
            ))}
          </div>
          <div className="mt-3 flex justify-between font-mono text-[10px] text-muted-foreground"><span>00:00</span><span>12:00</span><span>23:00</span></div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 font-display text-sm font-semibold">Tool usage</div>
          <div className="space-y-3">
            {tools.map((t) => (
              <div key={t.name}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono">{t.name}</span>
                  <span className="text-muted-foreground">{t.calls.toLocaleString()} · p95 {t.p95}ms</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-surface">
                  <div className="h-full bg-gradient-primary" style={{ width: `${(t.calls / tools[0].calls) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
