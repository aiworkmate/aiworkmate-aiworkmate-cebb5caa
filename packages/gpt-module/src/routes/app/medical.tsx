import { createFileRoute } from "@tanstack/react-router";
import { Stethoscope, AlertTriangle, FileSearch, UserCheck } from "lucide-react";
import { PageHeader, StatusPill } from "@/components/page-primitives";

export const Route = createFileRoute("/app/medical")({
  head: () => ({ meta: [{ title: "Medical assistive · AI WorkMate" }] }),
  component: MedicalPage,
});

const sample = {
  caseId: "case-2026-05-2839",
  observations: [
    "Patient reports persistent headache (7 days), localized frontotemporal, intensity 6/10.",
    "BP 138/86 (elevated vs. 12-month baseline 122/78).",
    "No reported visual disturbance, nausea, or photophobia.",
    "Recent travel: domestic only; no febrile contacts.",
  ],
  interpretation:
    "Pattern is consistent with tension-type or stress-related headache against a backdrop of mildly elevated blood pressure. Migraine and intracranial pathology are lower probability given absence of focal neuro signs.",
  uncertainty: 0.42,
  recommendations: [
    "Verify BP trend across at least 3 separate readings.",
    "Screen for sleep disruption and caffeine intake in the last 14 days.",
    "Consider migraine questionnaire (MIDAS) if pattern persists > 14 days.",
  ],
  sources: [
    { ref: "Internal · headache-triage-policy-v4.pdf", chunk: "§3.2 Differential triggers" },
    { ref: "Internal · htn-screening-2025.pdf", chunk: "§1.1 Confirmation criteria" },
  ],
};

function MedicalPage() {
  const uncertaintyPct = Math.round(sample.uncertainty * 100);
  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <PageHeader
        eyebrow="Clinician-assistive only"
        title="Medical assistive view"
        description="Structured assistive output. Not a diagnosis. Requires clinician review before any decision."
        actions={<StatusPill tone="warning">Assistive · review required</StatusPill>}
      />

      <div className="space-y-4 p-6">
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <div className="font-medium">This output is assistive, not diagnostic.</div>
            <div className="mt-1 text-muted-foreground">A licensed clinician must review and confirm before any care decision. All interactions are audit-logged.</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary-glow" />
              <span className="font-display text-sm font-semibold">{sample.caseId}</span>
            </div>

            <Section title="Observations">
              <ul className="list-inside list-disc space-y-1.5 text-sm">
                {sample.observations.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </Section>

            <Section title="Interpretation">
              <p className="text-sm leading-relaxed">{sample.interpretation}</p>
            </Section>

            <Section title="Recommendations (assistive)">
              <ol className="list-inside list-decimal space-y-1.5 text-sm">
                {sample.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ol>
            </Section>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 font-display text-sm font-semibold">Uncertainty</div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Model uncertainty</span>
                <span className="font-mono">{uncertaintyPct}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
                <div className="h-full bg-gradient-to-r from-success via-warning to-destructive" style={{ width: `${uncertaintyPct}%` }} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Above 30%: corroborate with additional data before acting.</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <FileSearch className="h-4 w-4 text-primary-glow" />
                <span className="font-display text-sm font-semibold">Evidence sources</span>
              </div>
              <ul className="space-y-2 text-xs">
                {sample.sources.map((s, i) => (
                  <li key={i} className="rounded-md border border-border bg-surface/40 p-2">
                    <div className="font-mono">{s.ref}</div>
                    <div className="mt-0.5 text-muted-foreground">{s.chunk}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-success" />
                <span className="font-display text-sm font-semibold">Clinician review</span>
              </div>
              <button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90">
                Mark reviewed
              </button>
              <button className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-accent">
                Request escalation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
