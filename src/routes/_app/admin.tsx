import { createFileRoute } from "@tanstack/react-router";
import { Shield, UserPlus, MoreHorizontal, Search } from "lucide-react";
import { PageHeader, StatusPill } from "@/components/page-primitives";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [{ title: "Admin · AI WorkMate" }] }),
  component: AdminPage,
});

const users = [
  { name: "Jane Lopez", email: "j.lopez@acme.health", role: "admin", status: "active", last: "2m ago" },
  { name: "Aarav Patel", email: "a.patel@acme.health", role: "member", status: "active", last: "12m ago" },
  { name: "Maria Costa", email: "m.costa@acme.health", role: "member", status: "active", last: "1h ago" },
  { name: "Tomas Becker", email: "t.becker@acme.health", role: "member", status: "suspended", last: "3d ago" },
];

const audit = [
  { actor: "j.lopez", action: "role.grant", target: "a.patel → admin", at: "2m ago" },
  { actor: "system", action: "workflow.run", target: "intake-triage", at: "9m ago" },
  { actor: "m.costa", action: "memory.pin", target: "mem_3812", at: "23m ago" },
  { actor: "j.lopez", action: "user.suspend", target: "t.becker", at: "3d ago" },
];

function AdminPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <PageHeader
        eyebrow="Tenant administration"
        title="Admin"
        description="Users, roles, and audit trail. Admin-only operations are gated by backend permissions."
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90">
            <UserPlus className="h-3.5 w-3.5" /> Invite user
          </button>
        }
      />

      <div className="grid gap-4 p-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="font-display text-sm font-semibold">Users</span>
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input placeholder="Search users…" className="w-full rounded-md border border-input bg-surface/60 py-1.5 pl-8 pr-2 text-xs outline-none focus:ring-2 focus:ring-ring/40" />
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-surface/50 text-left">
              <tr>
                <th className="px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">User</th>
                <th className="px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Role</th>
                <th className="px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Last seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.email} className="hover:bg-surface/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-primary text-[10px] font-bold text-primary-foreground">
                        {u.name.split(" ").map((s) => s[0]).join("")}
                      </div>
                      <div>
                        <div className="font-medium">{u.name}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3"><StatusPill tone={u.role === "admin" ? "info" : "neutral"}>{u.role}</StatusPill></td>
                  <td className="px-5 py-3"><StatusPill tone={u.status === "active" ? "success" : "warning"}>{u.status}</StatusPill></td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{u.last}</td>
                  <td className="px-5 py-3"><button className="text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-success" />
              <span className="font-display text-sm font-semibold">Security overview</span>
            </div>
            <ul className="space-y-2.5 text-sm">
              <li className="flex justify-between"><span className="text-muted-foreground">SSO</span><StatusPill tone="info">SAML ready</StatusPill></li>
              <li className="flex justify-between"><span className="text-muted-foreground">MFA</span><StatusPill tone="success">Required</StatusPill></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Session TTL</span><span className="font-mono text-xs">8h</span></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Data residency</span><span className="font-mono text-xs">eu-west-1</span></li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 font-display text-sm font-semibold">Audit log</div>
            <div className="space-y-3 text-xs">
              {audit.map((a, i) => (
                <div key={i} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate"><span className="font-mono text-muted-foreground">{a.actor}</span> · <span className="font-medium">{a.action}</span></div>
                    <div className="truncate text-muted-foreground">{a.target}</div>
                  </div>
                  <span className="shrink-0 font-mono text-muted-foreground">{a.at}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
