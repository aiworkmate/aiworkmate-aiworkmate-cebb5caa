import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Activity, Zap, Brain, AlertTriangle } from "lucide-react";
import { PageHeader, StatusPill } from "@/components/page-primitives";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/analytics")({
  head: () => ({ meta: [{ title: "Analytics · AI WorkMate" }] }),
  component: AnalyticsPage,
});

const ranges = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 } as const;
type Range = keyof typeof ranges;

interface Outcome {
  id: string;
  intent: string;
  live_used: boolean;
  memory_hits: number;
  latency_ms: number;
  chars: number;
  was_fallback: boolean;
  created_at: string;
}
interface RoutingStat {
  intent: string;
  live_used: boolean;
  success_count: number;
  failure_count: number;
  avg_latency_ms: number;
  last_used_at: string;
}

function AnalyticsPage() {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>("7d");

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - ranges[range]);
    return d.toISOString();
  }, [range]);

  const outcomesQ = useQuery<Outcome[]>({
    queryKey: ["response_outcomes", user?.id, range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("response_outcomes")
        .select("id, intent, live_used, memory_hits, latency_ms, chars, was_fallback, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Outcome[];
    },
    enabled: !!user,
  });

  const statsQ = useQuery<RoutingStat[]>({
    queryKey: ["routing_stats", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routing_stats")
        .select("intent, live_used, success_count, failure_count, avg_latency_ms, last_used_at")
        .order("last_used_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as RoutingStat[];
    },
    enabled: !!user,
  });

  const outcomes = outcomesQ.data ?? [];
  const stats = statsQ.data ?? [];

  const kpis = useMemo(() => {
    const n = outcomes.length;
    if (!n) return { total: 0, avgLatency: 0, fallbackRate: 0, liveRate: 0, avgMemHits: 0 };
    const sumL = outcomes.reduce((s, o) => s + o.latency_ms, 0);
    const fb = outcomes.filter((o) => o.was_fallback).length;
    const live = outcomes.filter((o) => o.live_used).length;
    const mem = outcomes.reduce((s, o) => s + o.memory_hits, 0);
    return {
      total: n,
      avgLatency: Math.round(sumL / n),
      fallbackRate: (fb / n) * 100,
      liveRate: (live / n) * 100,
      avgMemHits: +(mem / n).toFixed(1),
    };
  }, [outcomes]);

  // Bucket latency over time for chart (~24 buckets)
  const series = useMemo(() => {
    if (!outcomes.length) return [];
    const buckets = 24;
    const first = new Date(outcomes[0].created_at).getTime();
    const last = new Date(outcomes[outcomes.length - 1].created_at).getTime();
    const span = Math.max(last - first, 1);
    const acc: { sum: number; count: number }[] = Array.from({ length: buckets }, () => ({ sum: 0, count: 0 }));
    for (const o of outcomes) {
      const idx = Math.min(buckets - 1, Math.floor(((new Date(o.created_at).getTime() - first) / span) * buckets));
      acc[idx].sum += o.latency_ms;
      acc[idx].count += 1;
    }
    return acc.map((b) => (b.count ? Math.round(b.sum / b.count) : 0));
  }, [outcomes]);
  const maxSeries = Math.max(1, ...series);

  const intentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of outcomes) map.set(o.intent, (map.get(o.intent) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [outcomes]);
  const maxIntent = Math.max(1, ...intentBreakdown.map(([, v]) => v));

  function exportCsv() {
    const rows = [
      ["created_at", "intent", "latency_ms", "memory_hits", "live_used", "was_fallback", "chars"],
      ...outcomes.map((o) => [o.created_at, o.intent, o.latency_ms, o.memory_hits, o.live_used, o.was_fallback, o.chars]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `aiworkmate-analytics-${range}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const loading = outcomesQ.isLoading || statsQ.isLoading;

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <PageHeader
        eyebrow="Self-improvement telemetry"
        title="Analytics"
        description="Live signal from the adaptive routing + memory pipeline."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border bg-surface p-0.5">
              {(Object.keys(ranges) as Range[]).map((r) => (
                <button key={r} onClick={() => setRange(r)}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {r}
                </button>
              ))}
            </div>
            <button onClick={exportCsv} disabled={!outcomes.length}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        }
      />

      <div className="grid gap-4 p-6 md:grid-cols-4">
        <KpiCard icon={Activity} label="Responses" value={kpis.total.toLocaleString()} hint={loading ? "loading…" : `last ${range}`} />
        <KpiCard icon={Zap} label="Avg latency" value={`${kpis.avgLatency}ms`} hint="end-to-end" tone={kpis.avgLatency < 1500 ? "success" : "warning"} />
        <KpiCard icon={Brain} label="Memory hits / resp" value={kpis.avgMemHits.toString()} hint={`${kpis.liveRate.toFixed(0)}% live data`} />
        <KpiCard icon={AlertTriangle} label="Fallback rate" value={`${kpis.fallbackRate.toFixed(2)}%`} hint="graceful errors" tone={kpis.fallbackRate < 2 ? "success" : "warning"} />
      </div>

      <div className="grid gap-4 px-6 pb-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-display text-sm font-semibold">Latency over time</div>
            <StatusPill tone="info">{range}</StatusPill>
          </div>
          {series.length === 0 ? (
            <EmptyChart loading={loading} />
          ) : (
            <>
              <div className="flex h-48 items-end gap-1.5">
                {series.map((v, i) => (
                  <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary/30 to-primary-glow transition hover:opacity-80"
                    style={{ height: `${Math.max(4, (v / maxSeries) * 100)}%` }} title={`${v}ms`} />
                ))}
              </div>
              <div className="mt-3 flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>oldest</span><span>median</span><span>newest</span>
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 font-display text-sm font-semibold">Intent distribution</div>
          {intentBreakdown.length === 0 ? (
            <EmptyChart loading={loading} />
          ) : (
            <div className="space-y-3">
              {intentBreakdown.map(([name, count]) => (
                <div key={name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono truncate">{name}</span>
                    <span className="text-muted-foreground tabular-nums">{count}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-surface">
                    <div className="h-full bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${(count / maxIntent) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-3">
          <div className="mb-4 font-display text-sm font-semibold">Routing performance by intent</div>
          {stats.length === 0 ? (
            <EmptyChart loading={loading} compact />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Intent</th>
                    <th className="py-2 pr-4">Live</th>
                    <th className="py-2 pr-4">Success</th>
                    <th className="py-2 pr-4">Failure</th>
                    <th className="py-2 pr-4">Success rate</th>
                    <th className="py-2 pr-4">Avg latency</th>
                    <th className="py-2">Last used</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s, i) => {
                    const total = s.success_count + s.failure_count;
                    const rate = total ? (s.success_count / total) * 100 : 0;
                    return (
                      <tr key={i} className="border-t border-border/50">
                        <td className="py-2 pr-4 font-mono">{s.intent}</td>
                        <td className="py-2 pr-4">{s.live_used ? <StatusPill tone="success">on</StatusPill> : <span className="text-muted-foreground">off</span>}</td>
                        <td className="py-2 pr-4 tabular-nums">{s.success_count}</td>
                        <td className="py-2 pr-4 tabular-nums text-muted-foreground">{s.failure_count}</td>
                        <td className="py-2 pr-4 tabular-nums">{rate.toFixed(1)}%</td>
                        <td className="py-2 pr-4 tabular-nums">{s.avg_latency_ms}ms</td>
                        <td className="py-2 text-muted-foreground">{new Date(s.last_used_at).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, hint, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string; tone?: "success" | "warning" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-muted-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className={`mt-1 text-xs ${toneClass}`}>{hint}</div>}
    </div>
  );
}

function EmptyChart({ loading, compact }: { loading: boolean; compact?: boolean }) {
  return (
    <div className={`grid place-items-center rounded-lg border border-dashed border-border/60 ${compact ? "h-20" : "h-48"}`}>
      <div className="text-center text-xs text-muted-foreground">
        {loading ? "Loading telemetry…" : "No data yet. Send a few messages in chat to populate this view."}
      </div>
    </div>
  );
}
