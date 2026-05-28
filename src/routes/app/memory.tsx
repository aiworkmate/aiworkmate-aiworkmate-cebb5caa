import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Brain, Pin, Search, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState, StatusPill } from "@/components/page-primitives";
import { toast } from "sonner";

export const Route = createFileRoute("/app/memory")({
  head: () => ({ meta: [{ title: "Memory · AI WorkMate" }] }),
  component: MemoryPage,
});

interface Memory { id: string; content: string; category: string; pinned: boolean; confidence: number; updated_at: string }

function MemoryPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");

  const { data: memories = [] } = useQuery<Memory[]>({
    queryKey: ["memories", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("memories")
        .select("id, content, category, pinned, confidence, updated_at")
        .order("pinned", { ascending: false }).order("updated_at", { ascending: false });
      return (data ?? []) as Memory[];
    },
    enabled: !!user,
  });

  const filtered = memories.filter((m) => !q || m.content.toLowerCase().includes(q.toLowerCase()));

  async function addMemory() {
    if (!draft.trim() || !user) return;
    const { error } = await supabase.from("memories").insert({ user_id: user.id, content: draft.trim(), category: "general" });
    if (error) { toast.error(error.message); return; }
    setDraft("");
    qc.invalidateQueries({ queryKey: ["memories"] });
  }

  async function togglePin(m: Memory) {
    await supabase.from("memories").update({ pinned: !m.pinned }).eq("id", m.id);
    qc.invalidateQueries({ queryKey: ["memories"] });
  }
  async function removeMemory(id: string) {
    await supabase.from("memories").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["memories"] });
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <PageHeader
        eyebrow="Persistent context"
        title="Memory"
        description="What the orchestrator can recall on your behalf. Workspace-scoped and confidence-ranked."
        actions={<StatusPill tone="info">Encrypted at rest</StatusPill>}
      />

      <div className="space-y-6 p-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Capture</div>
          <div className="mt-2 flex gap-2">
            <input
              value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addMemory(); }}
              placeholder="e.g. Quarterly clinical-ops review is every second Wednesday."
              className="flex-1 rounded-md border border-input bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
            <button onClick={addMemory} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90">
              <Plus className="h-3.5 w-3.5" /> Save
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search memories…"
            className="w-full rounded-md border border-input bg-surface/60 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Brain} title="No memories yet" description="Capture preferences, facts, and recurring context. The orchestrator will retrieve them when relevant." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((m) => (
              <div key={m.id} className="group rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusPill tone={m.pinned ? "info" : "neutral"}>{m.category}</StatusPill>
                    <span className="font-mono text-[10px] text-muted-foreground">conf {(m.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => togglePin(m)} className={`grid h-7 w-7 place-items-center rounded-md hover:bg-accent ${m.pinned ? "text-primary-glow" : "text-muted-foreground"}`}>
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeMemory(m.id)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-accent hover:text-destructive group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-sm">{m.content}</p>
                <div className="mt-3 font-mono text-[10px] text-muted-foreground">updated {new Date(m.updated_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
