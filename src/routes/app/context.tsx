import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layers, Brain, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState, StatusPill } from "@/components/page-primitives";

export const Route = createFileRoute("/app/context")({
  head: () => ({ meta: [{ title: "Context · AI WorkMate" }] }),
  component: ContextPage,
});

interface ConvSummary { id: string; title: string; summary: string | null; updated_at: string }

function ContextPage() {
  const { user } = useAuth();

  const { data: summaries = [] } = useQuery<ConvSummary[]>({
    queryKey: ["conversation-summaries", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, title, summary, updated_at")
        .not("summary", "is", null)
        .order("updated_at", { ascending: false })
        .limit(40);
      return (data ?? []) as ConvSummary[];
    },
    enabled: !!user,
  });

  const { data: memoryStats } = useQuery({
    queryKey: ["memory-stats", user?.id],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("memories")
        .select("*", { count: "exact", head: true });
      const { count: pinned } = await supabase
        .from("memories")
        .select("*", { count: "exact", head: true })
        .eq("pinned", true);
      return { total: total ?? 0, pinned: pinned ?? 0 };
    },
    enabled: !!user,
  });

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <PageHeader
        eyebrow="Context Intelligence"
        title="Context"
        description="Compressed summaries and long-term knowledge the assistant uses across conversations."
        actions={<StatusPill tone="info">Bounded payload · 14k chars</StatusPill>}
      />

      <div className="grid gap-4 p-4 md:grid-cols-3 md:p-6">
        <StatCard icon={Layers} label="Compressed conversations" value={summaries.length} />
        <StatCard icon={Brain} label="Active memories" value={memoryStats?.total ?? 0} />
        <StatCard icon={Sparkles} label="Pinned facts" value={memoryStats?.pinned ?? 0} />
      </div>

      <div className="px-4 pb-8 md:px-6">
        <h2 className="mb-3 font-display text-sm font-semibold">Conversation summaries</h2>
        {summaries.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No summaries yet"
            description="Long conversations are automatically compressed. Summaries will appear here once any conversation grows past ~24 messages."
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
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {s.summary}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
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
