// Thin REST client for the AI WorkMate backend (Node.js service).
// All business CRUD goes through here. Supabase client is reserved for auth/session only.
import { supabase } from "@/integrations/supabase/client";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export class ApiNotConfiguredError extends ApiError {
  constructor() {
    super("Backend API not configured — set VITE_API_BASE_URL.", 0, null);
  }
}

type TenantHeaders = { organizationId?: string | null; workspaceId?: string | null };

let tenantHeaders: TenantHeaders = {};
export function setTenantHeaders(h: TenantHeaders) {
  tenantHeaders = h;
}

interface RequestOptions extends Omit<RequestInit, "body" | "headers"> {
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
}

async function buildHeaders(extra?: Record<string, string>): Promise<Headers> {
  const h = new Headers({ accept: "application/json", ...extra });
  if (!h.has("content-type") && extra && !("content-type" in extra)) {
    h.set("content-type", "application/json");
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) h.set("authorization", `Bearer ${token}`);
  if (tenantHeaders.organizationId) h.set("x-organization-id", tenantHeaders.organizationId);
  if (tenantHeaders.workspaceId) h.set("x-workspace-id", tenantHeaders.workspaceId);
  return h;
}

export async function apiRequest<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!BASE_URL) throw new ApiNotConfiguredError();

  const url = new URL(BASE_URL + (path.startsWith("/") ? path : `/${path}`));
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers = await buildHeaders(opts.headers);
  const { body: _b, query: _q, headers: _h, ...rest } = opts;
  const init: RequestInit = { ...rest, headers };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }


  const res = await fetch(url.toString(), init);
  const ctype = res.headers.get("content-type") ?? "";
  const payload: unknown = ctype.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const msg =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : res.statusText;
    throw new ApiError(msg, res.status, payload);
  }
  return payload as T;
}

export const api = {
  get: <T,>(path: string, query?: RequestOptions["query"]) =>
    apiRequest<T>(path, { method: "GET", query }),
  post: <T,>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: "POST", body }),
  patch: <T,>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: "PATCH", body }),
  put: <T,>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: "PUT", body }),
  delete: <T,>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
};

export const apiConfigured = () => Boolean(BASE_URL);
