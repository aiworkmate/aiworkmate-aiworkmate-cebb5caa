import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, ShieldCheck, Brain, Workflow, BarChart3, FileText, Stethoscope } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI WorkMate — Secure Enterprise AI Operating System" },
      { name: "description", content: "Chat, memory, uploads, workflows, analytics, and a clinician-grade assistive layer — under one secure, multi-tenant AI OS." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Brain, title: "Persistent memory", desc: "Workspace-scoped, user-scoped, confidence-ranked." },
  { icon: FileText, title: "Documents & uploads", desc: "Parsed, retrievable, and audited end-to-end." },
  { icon: Workflow, title: "Workflow automations", desc: "Triggered actions with permission-aware runs." },
  { icon: BarChart3, title: "Operational analytics", desc: "Conversations, tools, latency, errors." },
  { icon: ShieldCheck, title: "Enterprise security", desc: "RBAC, audit logs, RLS-backed multi-tenancy." },
  { icon: Stethoscope, title: "Medical assistive view", desc: "Structured observations with clinician review." },
];

function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/app", replace: true });
  }, [session, loading, navigate]);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-primary/20 blur-[140px]" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-primary shadow-glow">
            <span className="font-display text-sm font-bold text-primary-foreground">W</span>
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">AI WorkMate</span>
          <span className="ml-2 rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">v1 · enterprise</span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link to="/login" className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">Sign in</Link>
          <Link to="/signup" className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground shadow-glow hover:opacity-90">
            Get started
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-20 pb-32 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> SOC-aligned · Multi-tenant · Auditable
        </div>
        <h1 className="mx-auto mt-6 max-w-4xl text-balance font-display text-5xl font-semibold leading-[1.05] md:text-7xl">
          The secure AI operating system <span className="bg-gradient-to-r from-primary-glow to-primary bg-clip-text text-transparent">for the enterprise.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-muted-foreground md:text-lg">
          AI WorkMate isn't a chatbot. It's a multi-tenant operating layer for chat, persistent memory, document intelligence, workflow execution, and clinician-grade assistive reasoning — governed by enterprise controls.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/signup" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90">
            Launch your workspace <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/login" className="rounded-md border border-border bg-surface/60 px-5 py-3 text-sm hover:bg-accent">
            Sign in
          </Link>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-32">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group flex flex-col gap-3 bg-surface p-7 transition hover:bg-surface-elevated">
              <f.icon className="h-5 w-5 text-primary-glow" />
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} AI WorkMate. All systems audited.</span>
          <span className="font-mono">build · prod · region-eu-w1</span>
        </div>
      </footer>
    </div>
  );
}
