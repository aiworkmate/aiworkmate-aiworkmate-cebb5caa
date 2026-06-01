import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "system" | "light" | "dark";
interface ThemeCtx { theme: Theme; resolved: "light" | "dark"; setTheme: (t: Theme) => void; }

const Ctx = createContext<ThemeCtx | null>(null);
const STORAGE_KEY = "workmate.theme";

function readStored(): Theme {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

function systemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setThemeState(readStored());
  }, []);

  useEffect(() => {
    const apply = () => {
      const next = theme === "system" ? systemTheme() : theme;
      setResolved(next);
      const root = document.documentElement;
      root.classList.toggle("light", next === "light");
      root.classList.toggle("dark", next === "dark");
      root.style.colorScheme = next;
    };
    apply();
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: light)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  const setTheme = (t: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  };

  return <Ctx.Provider value={{ theme, resolved, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme outside ThemeProvider");
  return v;
}
