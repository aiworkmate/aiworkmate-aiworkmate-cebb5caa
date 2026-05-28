import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { PageHeader, StatusPill } from "@/components/page-primitives";
import { endpoints, type AuditEvent } from "@/lib/api/endpoints";
import { ApiNotConfiguredError } from "@/lib/api/client";
import { ApiNotConfigured } from "@/components/empty-states";


export const Route = createFileRoute("/app/audit")({
  head: () => ({ meta: [{ title: "Audit logs · AI WorkMate" }] }),
  component: AuditPage,
});

function AuditPage() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  const q = useQuery({
    queryKey: ["audit", { search, action, resource, page }],
    queryFn: () => endpoints.audit.list({ search, action, resource_type: resource, page, page_size: 25 }),
    retry: false,
  });

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <PageHeader
        eyebrow="Compliance"
        title="Audit logs"
        description="Tamper-evident trail of every privileged action across this workspace."
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 pb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search actor, resource…"
            className="w-64 rounded-md border border-input bg-surface/60 py-1.5 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <input
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          placeholder="Action e.g. workflow.run"
          className="rounded-md border border-input bg-surface/60 py-1.5 px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
        />
        <input
          value={resource}
          onChange={(e) => { setResource(e.target.value); setPage(1); }}
          placeholder="Resource type"
          className="rounded-md border border-input bg-surface/60 py-1.5 px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>

      <div className="p-6">
        {q.error instanceof ApiNotConfiguredError ? (
          <ApiNotConfigured feature="Audit logs" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Actor</th>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Resource</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {q.isLoading && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">Loading…</td></tr>
                )}
                {!q.isLoading && (q.data?.items.length ?? 0) === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">No events.</td></tr>
                )}
                {q.data?.items.map((e) => (
                  <tr key={e.id} className="cursor-pointer hover:bg-accent/30" onClick={() => setSelected(e)}>
                    <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">{new Date(e.ts).toLocaleString()}</td>
                    <td className="px-4 py-2"><div className="font-medium">{e.actor.display_name ?? e.actor.email}</div><div className="text-[11px] text-muted-foreground">{e.actor.email}</div></td>
                    <td className="px-4 py-2"><span className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[11px]">{e.action}</span></td>
                    <td className="px-4 py-2 text-xs">{e.resource_type}{e.resource_id ? <span className="text-muted-foreground"> · {e.resource_id.slice(0, 8)}</span> : null}</td>
                    <td className="px-4 py-2 text-right"><StatusPill tone="neutral">view</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {q.data && q.data.total > q.data.page_size && (
              <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <span>Page {q.data.page} of {Math.ceil(q.data.total / q.data.page_size)}</span>
                <div className="flex gap-1">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Prev</button>
                  <button disabled={page >= Math.ceil(q.data.total / q.data.page_size)} onClick={() => setPage((p) => p + 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selected && <EventModal event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function EventModal({ event, onClose }: { event: AuditEvent; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-elevated">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="font-display text-sm font-semibold">Event detail</div>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5 text-sm">
          <Row label="Action" value={<code className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs">{event.action}</code>} />
          <Row label="When" value={new Date(event.ts).toLocaleString()} />
          <Row label="Actor" value={`${event.actor.display_name ?? event.actor.email} (${event.actor.email})`} />
          <Row label="Resource" value={`${event.resource_type}${event.resource_id ? " · " + event.resource_id : ""}`} />
          <Row label="Workspace" value={event.workspace_id ?? "—"} />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Metadata</div>
            <pre className="mt-1 max-h-60 overflow-auto rounded-md border border-border bg-surface p-3 font-mono text-[11px]">
              {JSON.stringify(event.metadata ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-baseline gap-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}
