import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";


function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">Error · 404</p>
        <h1 className="mt-3 text-5xl font-semibold text-foreground">Lost in the index</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This route isn't part of the workspace. Head back to the console.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-90"
        >
          Return home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-destructive">Runtime exception</p>
        <h1 className="mt-3 text-3xl font-semibold">Something derailed.</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >Try again</button>
          <a href="/" className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-accent">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AI WorkMate — Secure Enterprise AI Operating System" },
      { name: "description", content: "AI WorkMate is a secure, multi-tenant AI operating system for enterprise workflows — chat, memory, uploads, automations, and analytics." },
      { name: "theme-color", content: "#141432" },
      { property: "og:title", content: "AI WorkMate — Secure Enterprise AI Operating System" },
      { property: "og:description", content: "AI WorkMate is a secure, multi-tenant AI operating system for enterprise workflows — chat, memory, uploads, automations, and analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AI WorkMate — Secure Enterprise AI Operating System" },
      { name: "twitter:description", content: "AI WorkMate is a secure, multi-tenant AI operating system for enterprise workflows — chat, memory, uploads, automations, and analytics." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/27e9f801-c539-439c-8830-8533bf3935ef" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/27e9f801-c539-439c-8830-8533bf3935ef" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    // Re-validate routes when auth changes
    import("@/integrations/supabase/client").then(({ supabase }) => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
        router.invalidate();
        queryClient.invalidateQueries();
      });
      return () => subscription.unsubscribe();
    });
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <main>
            <Outlet />
          </main>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>

  );
}
