import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon, title, description, action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-surface-elevated text-primary-glow shadow-elevated">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title, description, actions, eyebrow,
}: {
  title: string; description?: string; actions?: ReactNode; eyebrow?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border bg-background/60 px-6 py-5 backdrop-blur">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{eyebrow}</div> : null}
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatusPill({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "danger" | "info"; children: ReactNode }) {
  const tones: Record<string, string> = {
    neutral: "bg-surface text-muted-foreground border-border",
    success: "bg-success/10 text-success border-success/30",
    warning: "bg-warning/10 text-warning border-warning/30",
    danger:  "bg-destructive/10 text-destructive border-destructive/30",
    info:    "bg-primary/10 text-primary-glow border-primary/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tones[tone]}`}>
      <span className="h-1 w-1 rounded-full bg-current" />
      {children}
    </span>
  );
}
