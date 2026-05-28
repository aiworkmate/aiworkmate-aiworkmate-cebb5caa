import { type LucideIcon, AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

export function ApiNotConfigured({ feature }: { feature: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md rounded-xl border border-warning/30 bg-warning/5 p-6 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-warning" />
        <h3 className="mt-3 font-display text-base font-semibold">Backend not connected</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {feature} is served by the AI WorkMate Node.js backend. Set{" "}
          <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px]">VITE_API_BASE_URL</code>{" "}
          to point at your backend and reload.
        </p>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon, title, description, action,
}: {
  icon: LucideIcon; title: string; description: string; action?: ReactNode;
}) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-md border border-border bg-surface">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="mt-3 font-display text-base font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}
