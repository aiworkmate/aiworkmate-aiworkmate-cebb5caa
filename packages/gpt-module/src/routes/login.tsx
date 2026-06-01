import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in · AI WorkMate" }] }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (session) navigate({ to: "/app", replace: true }); }, [session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Welcome back");
    navigate({ to: "/app", replace: true });
  }

  return <AuthShell title="Sign in" subtitle="Access your AI WorkMate workspace.">
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Work email">
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-input bg-background/40 px-3 py-2.5 text-sm outline-none ring-ring/30 transition focus:ring-2" />
      </Field>
      <Field label="Password">
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-input bg-background/40 px-3 py-2.5 text-sm outline-none ring-ring/30 transition focus:ring-2" />
      </Field>
      <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Sign in
      </button>
      <p className="text-center text-xs text-muted-foreground">
        New to AI WorkMate?{" "}
        <Link to="/signup" className="text-primary-glow hover:underline">Create an account</Link>
      </p>
    </form>
  </AuthShell>;
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center bg-background px-4 py-12">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
      <div className="pointer-events-none absolute top-0 left-1/2 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="mx-auto mb-8 flex w-fit items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-primary shadow-glow">
            <span className="font-display text-sm font-bold text-primary-foreground">W</span>
          </div>
          <span className="font-display text-lg font-semibold">AI WorkMate</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card/70 p-8 shadow-elevated backdrop-blur">
          <h1 className="font-display text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
