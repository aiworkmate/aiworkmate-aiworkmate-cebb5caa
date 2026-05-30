import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Layers, Brain, Sparkles, Target, FolderKanban, CheckSquare,
  Gauge, Activity, TrendingUp, ListChecks,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState, StatusPill } from "@/components/page-primitives";
import { getContextHealth, type ContextHealth } from "@/lib/chat/quality.functions";

export const Route = createFileRoute("/app/context")({
  head: () => ({ meta: [{ title: "Context · AI WorkMate" }] }),
  component: ContextPage,
});

interface MemRow {
  id: string;
  content: string;
  category: string;
  pinned: boolean;
  confidence: number;
  usefulness: number | null;
  frequency: number | null;
  updated_at: string;
}
interface ConvSummary { id: string; title: string; summary: string | null; updated_at: string }

function useMemoriesByCategory(category: string, enabled: boolean) {
  return useQuery<MemRow[]>({
    queryKey: ["memories", category],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("memories")
        .select("id, content, category, pinned, confidence, usefulness, frequency, updated_at")
        .eq("category", category)
        .order("pinned", { ascending: false })
        .order("usefulness", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(30);
      return (data ?? []) as MemRow[];
    },
  });
}

function ContextPage() {
  const { user } = useAuth();
  const fetchHealth = useServerFn(getContextHealth);

  const { data: health } = useQuery<ContextHealth>({
    queryKey: ["context-health", user?.id],
    enabled: !!user,
    queryFn: () => fetchHealth(),
    refetchInterval: 30_000,
  });

  const projects = useMemoriesByCategory("project", !!user);
  const goals = useMemoriesByCategory("goal", !!user);
  const tasks = useMemoriesByCategory("task", !!user);
  const decisions = useMemoriesByCategory("decision", !!user);

  const { data: summaries = [] } = useQuery<ConvSummary[]>({
    queryKey: ["conversation-summaries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, title, summary, updated_at")
        .not("summary", "is", null)
        .order("updated_at", { ascending: false })
        .limit(40);
      return (data ?? []) as ConvSummary[];
    },
  });

  const compressionRatio = health && health.totalMessages > 0
    ? Math.round((health.compressedConversations / Math.max(1, health.totalConversations)) * 100)
    : 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <PageHeader
        eyebrow="Context Intelligence"
        title="Context"
        description="Projects, goals, memory health, and compressed summaries the assistant uses across conversations."
        actions={<StatusPill tone="info">Phase 2 · Knowledge layer</StatusPill>}
      />

      <div className="grid gap-3 p-4 sm:grid-cols-2 md:grid-cols-4 md:p-6">
        <StatCard icon={FolderKanban} label="Active projects" value={projects.data?.length ?? 0} />
        <StatCard icon={Target} label="Active goals" value={goals.data?.length ?? 0} />
        <StatCard icon={CheckSquare} label="Tracked tasks" value={tasks.data?.length ?? 0} />
        <StatCard icon={Brain} label="Memories" value={health?.totalMemories ?? 0} />
      </div>

      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 md:grid-cols-4 md:px-6">
        <MetricCard
          icon={Gauge}
          label="Avg usefulness"
          value={pct(health?.avgUsefulness)}
          hint="Reinforced by outcomes"
        />
        <MetricCard
          icon={Activity}
          label="Retrieval coverage"
          value={pct(health?.retrievalCoverage)}
          hint={`${health?.recentlyReinforced ?? 0} used in last 7d`}
        />
        <MetricCard
          icon={TrendingUp}
          label="Compression"
          value={`${compressionRatio}%`}
          hint={`${health?.compressedConversations ?? 0} / ${health?.totalConversations ?? 0} convos`}
        />
        <MetricCard
          icon={Sparkles}
          label="User feedback"
          value={health?.feedbackCount ? pct(health.feedbackHelpfulRatio ?? 0) : "—"}
          hint={`${health?.feedbackCount ?? 0} signals`}
        />
      </div>

      <div className="grid gap-4 px-4 pb-8 md:grid-cols-2 md:px-6">
        <Section icon={FolderKanban} title="Projects" empty="No projects detected yet. Mention a project by name in chat and it will appear here." rows={projects.data ?? []} />
        <Section icon={Target} title="Goals" empty="No goals tracked yet. Tell the assistant a goal (e.g. revenue, weight, learning) and it will be tracked." rows={goals.data ?? []} />
        <Section icon={ListChecks} title="Open tasks" empty="No tasks captured yet." rows={tasks.data ?? []} />
        <Section icon={Layers} title="Recent decisions" empty="No decisions logged yet." rows={decisions.data ?? []} />
      </div>

      <div className="px-4 pb-4 md:px-6">
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
          <Layers className="h-4 w-4 text-primary-glow" /> Conversation summaries
        </h2>
        {summaries.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No summaries yet"
            description="Long conversations are automatically compressed. Summaries appear once any conversation grows past ~24 messages."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {summaries.map((s) => (
              <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate font-display text-sm font-semibold">{s.title}</div>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {new Date(s.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground line-clamp-6">
                  {s.summary}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {health && health.byCategory.length > 0 && (
        <div className="px-4 pb-10 md:px-6">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
            <Brain className="h-4 w-4 text-primary-glow" /> Memory quality by category
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Count</th>
                  <th className="px-3 py-2">Usefulness</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Avg uses</th>
                </tr>
              </thead>
              <tbody>
                {health.byCategory.map((c) => (
                  <tr key={c.category} className="border-t border-border">
                    <td className="px-3 py-2 font-medium capitalize">{c.category}</td>
                    <td className="px-3 py-2">{c.count}</td>
                    <td className="px-3 py-2">{pct(c.avgUsefulness)}</td>
                    <td className="px-3 py-2">{pct(c.avgConfidence)}</td>
                    <td className="px-3 py-2">{c.avgFrequency.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function pct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, hint }: { icon: typeof Layers; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <div className="mt-2 font-display text-xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Section({ icon: Icon, title, empty, rows }: { icon: typeof Layers; title: string; empty: string; rows: MemRow[] }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Icon className="h-4 w-4 text-primary-glow" /> {title}
        </h3>
        <span className="font-mono text-[10px] text-muted-foreground">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.slice(0, 8).map((r) => (
            <li key={r.id} className="px-4 py-3">
              <p className="text-sm leading-snug break-words">{r.content}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase text-muted-foreground">
                {r.pinned && <span className="rounded bg-primary/20 px-1.5 py-0.5 text-primary-glow">pinned</span>}
                <span>usefulness {pct(Number(r.usefulness ?? 0))}</span>
                <span>conf {pct(Number(r.confidence ?? 0))}</span>
                <span>uses {r.frequency ?? 0}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
