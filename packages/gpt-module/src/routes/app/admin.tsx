import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrainCircuit, Globe2, Lock, RotateCcw, Save, Shield, SlidersHorizontal } from "lucide-react";
import { PageHeader, StatusPill } from "@/components/page-primitives";
import { getAdminControlPanel, saveAdminAiControl } from "@/lib/admin/ai-control.server";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin")({
  head: () => ({ meta: [{ title: "Admin · AI WorkMate" }] }),
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const controlQ = useQuery({
    queryKey: ["admin-ai-control"],
    queryFn: () => getAdminControlPanel(),
    retry: false,
  });
  const panel = controlQ.data;
  const [modelOverride, setModelOverride] = useState("");
  const [systemOverride, setSystemOverride] = useState("");
  const [forceLiveData, setForceLiveData] = useState(false);
  const [forceMemory, setForceMemory] = useState(false);

  useEffect(() => {
    if (!panel?.settings) return;
    setModelOverride(panel.settings.modelOverride ?? "");
    setSystemOverride(panel.settings.systemOverride ?? "");
    setForceLiveData(panel.settings.forceLiveData);
    setForceMemory(panel.settings.forceMemory);
  }, [panel?.settings]);

  const saveMutation = useMutation({
    mutationFn: () => saveAdminAiControl({
      data: {
        modelOverride: modelOverride.trim() || null,
        systemOverride: systemOverride.trim() || null,
        forceLiveData,
        forceMemory,
      },
    }),
    onSuccess: () => {
      toast.success("AI controls saved");
      qc.invalidateQueries({ queryKey: ["admin-ai-control"] });
    },
    onError: (err) => toast.error((err as Error).message || "Could not save AI controls"),
  });

  const resetControls = () => {
    setModelOverride("");
    setSystemOverride("");
    setForceLiveData(false);
    setForceMemory(false);
  };

  const admin = panel?.admin === true;

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <PageHeader
        eyebrow="Owner administration"
        title="Admin"
        description="Control the AI runtime, model preference, memory behavior, and live-data behavior from a server-gated owner panel."
        actions={
          admin ? <StatusPill tone="success">owner admin</StatusPill> : <StatusPill tone="warning">restricted</StatusPill>
        }
      />

      <div className="space-y-6 p-6">
        {controlQ.isLoading ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading admin controls...</div>
        ) : !admin ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-surface-elevated text-warning">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display text-base font-semibold">Admin role required</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  This panel is available only to the configured owner email or users with the backend admin role.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Shield className="h-4 w-4 text-success" /> Access
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Signed in as</span>
                    <span className="truncate font-mono text-xs">{panel.email ?? "verified user"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Role</span>
                    <StatusPill tone="success">admin</StatusPill>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <BrainCircuit className="h-4 w-4 text-primary-glow" /> Model
                </div>
                <p className="mt-3 font-mono text-xs text-muted-foreground">
                  {modelOverride.trim() || "GPT-first automatic fallback"}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Globe2 className="h-4 w-4 text-primary-glow" /> Orchestration
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusPill tone={forceLiveData ? "info" : "neutral"}>live {forceLiveData ? "forced" : "auto"}</StatusPill>
                  <StatusPill tone={forceMemory ? "info" : "neutral"}>memory {forceMemory ? "forced" : "auto"}</StatusPill>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-display text-base font-semibold">
                    <SlidersHorizontal className="h-4 w-4 text-primary-glow" /> AI Runtime Controls
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Changes apply to your authenticated chat sessions and are enforced by the backend before the LLM request.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={resetControls}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-accent"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-60"
                  >
                    <Save className="h-3.5 w-3.5" /> {saveMutation.isPending ? "Saving" : "Save"}
                  </button>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="space-y-4">
                  <label className="block">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Model override</span>
                    <input
                      value={modelOverride}
                      onChange={(e) => setModelOverride(e.target.value)}
                      placeholder="openai/gpt-5.5"
                      className="mt-2 w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </label>

                  <label className="block">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">System instruction override</span>
                    <textarea
                      value={systemOverride}
                      onChange={(e) => setSystemOverride(e.target.value)}
                      placeholder="Leave empty to use the stable AI WorkMate system prompt."
                      rows={8}
                      className="mt-2 w-full resize-y rounded-md border border-input bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </label>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 rounded-md border border-border bg-surface/50 p-3">
                    <input
                      type="checkbox"
                      checked={forceLiveData}
                      onChange={(e) => setForceLiveData(e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium">Force live data</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Always attempts Tavily then SerpAPI for chat requests.</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 rounded-md border border-border bg-surface/50 p-3">
                    <input
                      type="checkbox"
                      checked={forceMemory}
                      onChange={(e) => setForceMemory(e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium">Force memory</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Always retrieves ranked memory even when routing would skip it.</span>
                    </span>
                  </label>

                  {panel.settings.updatedAt ? (
                    <div className="rounded-md border border-border bg-surface/40 p-3 font-mono text-[11px] text-muted-foreground">
                      Updated {new Date(panel.settings.updatedAt).toLocaleString()}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
