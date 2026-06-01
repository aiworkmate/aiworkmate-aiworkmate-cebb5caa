import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { AuthShell, Field } from "./login";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account · AI WorkMate" }] }),
  component: SignupPage,
});

function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (session) navigate({ to: "/app", replace: true }); }, [session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { display_name: name },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account created — you're signed in.");
    navigate({ to: "/app", replace: true });
  }

  return <AuthShell title="Create your workspace" subtitle="Provision a tenant in seconds.">
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Full name">
        <input required value={name} onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-input bg-background/40 px-3 py-2.5 text-sm outline-none ring-ring/30 transition focus:ring-2" />
      </Field>
      <Field label="Work email">
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-input bg-background/40 px-3 py-2.5 text-sm outline-none ring-ring/30 transition focus:ring-2" />
      </Field>
      <Field label="Password">
        <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-input bg-background/40 px-3 py-2.5 text-sm outline-none ring-ring/30 transition focus:ring-2" />
        <span className="mt-1 block text-[11px] text-muted-foreground">Minimum 8 characters.</span>
      </Field>
      <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Create account
      </button>
      <p className="text-center text-xs text-muted-foreground">
        Have an account? <Link to="/login" className="text-primary-glow hover:underline">Sign in</Link>
      </p>
    </form>
  </AuthShell>;
}
