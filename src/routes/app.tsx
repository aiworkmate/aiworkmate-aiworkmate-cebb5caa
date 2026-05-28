import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { TenantProvider } from "@/lib/tenant";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { Loader2 } from "lucide-react";


export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login", replace: true, search: { redirect: pathname } as never });
    }
  }, [loading, session, navigate, pathname]);

  if (loading || !session) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="font-mono text-xs uppercase tracking-widest">Authenticating session</span>
        </div>
      </div>
    );
  }

  return (
    <TenantProvider>
      <div className="flex min-h-dvh w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar />
          <div className="min-h-0 flex-1 overflow-hidden">
            <Outlet />
          </div>
        </div>
      </div>
    </TenantProvider>

  );
}

export { Link };
