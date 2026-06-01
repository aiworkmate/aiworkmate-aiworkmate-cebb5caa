import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusPill } from "@/components/page-primitives";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings · AI WorkMate" }] }),
  component: SettingsPage,
});

const tabs = ["Profile", "Workspace", "Notifications", "Integrations", "Security", "Billing"] as const;

function SettingsPage() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<typeof tabs[number]>("Profile");
  const [name, setName] = useState(profile?.display_name ?? "");
  const [saving, setSaving] = useState(false);

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Profile updated");
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <PageHeader eyebrow="Configuration" title="Settings" description="Manage your profile, workspace, and security preferences." />

      <div className="flex flex-wrap gap-1.5 border-b border-border bg-background/40 px-6">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`relative -mb-px px-3 py-3 text-sm transition ${tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t}
            {tab === t && <span className="absolute inset-x-2 -bottom-px h-px bg-primary-glow" />}
          </button>
        ))}
      </div>

      <div className="max-w-3xl space-y-6 p-6">
        {tab === "Profile" && (
          <Card title="Profile">
            <Row label="Display name">
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
            </Row>
            <Row label="Email">
              <input value={user?.email ?? ""} disabled className="w-full rounded-md border border-input bg-surface/40 px-3 py-2 text-sm text-muted-foreground" />
            </Row>
            <div className="flex justify-end">
              <button onClick={saveProfile} disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-50">
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </Card>
        )}

        {tab === "Workspace" && (
          <Card title="Workspace">
            <Row label="Workspace name"><input defaultValue="Clinical Ops" className="w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40" /></Row>
            <Row label="Region"><input disabled value="eu-west-1" className="w-full rounded-md border border-input bg-surface/40 px-3 py-2 text-sm text-muted-foreground" /></Row>
            <Row label="Default model"><input defaultValue="google/gemini-2.5-flash" className="w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-ring/40" /></Row>
          </Card>
        )}

        {tab === "Notifications" && (
          <Card title="Notifications">
            {["Workflow failures", "Admin actions", "Weekly digest", "Security alerts"].map((n) => (
              <Row key={n} label={n}>
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input type="checkbox" defaultChecked className="peer sr-only" />
                  <span className="h-5 w-9 rounded-full bg-surface peer-checked:bg-primary transition relative">
                    <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-foreground transition peer-checked:translate-x-4" />
                  </span>
                </label>
              </Row>
            ))}
          </Card>
        )}

        {tab === "Integrations" && (
          <Card title="API & integrations">
            <Row label="API key"><div className="flex items-center gap-2"><code className="flex-1 rounded-md border border-border bg-surface/40 px-3 py-2 font-mono text-xs">wm_live_•••••••••••••••••3a9c</code><button className="rounded-md border border-border bg-surface px-3 py-2 text-xs hover:bg-accent">Rotate</button></div></Row>
            <Row label="Webhook URL"><input placeholder="https://yoursystem.com/hooks/workmate" className="w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40" /></Row>
          </Card>
        )}

        {tab === "Security" && (
          <Card title="Security">
            <Row label="Multi-factor auth"><StatusPill tone="success">Required for admins</StatusPill></Row>
            <Row label="Session length"><input type="number" defaultValue={480} className="w-32 rounded-md border border-input bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40" /></Row>
            <Row label="IP allowlist"><textarea placeholder="0.0.0.0/0" rows={3} className="w-full rounded-md border border-input bg-background/40 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring/40" /></Row>
          </Card>
        )}

        {tab === "Billing" && (
          <Card title="Billing">
            <Row label="Plan"><StatusPill tone="info">Enterprise</StatusPill></Row>
            <Row label="Seats"><span className="font-mono text-sm">26 / 50</span></Row>
            <Row label="Next invoice"><span className="text-sm">$4,820 · June 28, 2026</span></Row>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-3 font-display text-sm font-semibold">{title}</div>
      <div className="space-y-5 p-5">{children}</div>
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid items-center gap-3 md:grid-cols-[200px_1fr]">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}
