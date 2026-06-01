// Typed REST endpoints — single source of truth for backend URLs.
// Backend implementation may evolve; only this file changes.
import { api } from "./client";

// ----- Domain types -----
export interface Organization { id: string; name: string; slug: string; logo_url?: string | null; }
export interface Workspace { id: string; organization_id: string; name: string; slug: string; }
export interface Membership { id: string; user_id: string; organization_id: string; workspace_id: string | null; role: "owner" | "admin" | "member" | "viewer"; }

export interface Conversation { id: string; workspace_id: string; title: string; created_at: string; updated_at: string; }
export interface MessageAttachment { id: string; upload_id: string; file_name: string; mime_type: string | null; size: number; thumbnail_url?: string | null; }
export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  created_at: string;
  tools_used?: { name: string; status: "running" | "ok" | "error" }[];
  memories_used?: { id: string; label: string }[];
  attachments?: MessageAttachment[];
}

export interface Memory { id: string; workspace_id: string; content: string; category: string; pinned: boolean; confidence: number; updated_at: string; }
export interface Upload {
  id: string; workspace_id: string; file_name: string; mime_type: string | null;
  size: number; status: "uploading" | "processing" | "ready" | "failed";
  thumbnail_url?: string | null; created_at: string;
}

export interface Workflow { id: string; workspace_id: string; name: string; description: string | null; trigger: string; status: "active" | "paused" | "draft"; updated_at: string; runs_total?: number; runs_failed?: number; }
export interface WorkflowStep { id: string; type: "trigger" | "action" | "condition"; name: string; config?: Record<string, unknown>; }
export interface WorkflowDetail extends Workflow { steps: WorkflowStep[]; }
export interface WorkflowRun {
  id: string; workflow_id: string; status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  started_at: string; finished_at?: string | null; duration_ms?: number | null;
  logs?: { ts: string; level: "info" | "warn" | "error"; message: string }[];
}

export interface AuditEvent {
  id: string; ts: string;
  actor: { id: string; email: string; display_name?: string | null };
  action: string;
  resource_type: string;
  resource_id?: string | null;
  organization_id: string;
  workspace_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface Paginated<T> { items: T[]; total: number; page: number; page_size: number; }

// ----- Endpoints -----
export const endpoints = {
  // Tenancy
  organizations: {
    list: () => api.get<Organization[]>("/v1/organizations"),
  },
  workspaces: {
    list: (orgId: string) => api.get<Workspace[]>(`/v1/organizations/${orgId}/workspaces`),
  },
  memberships: {
    me: () => api.get<Membership[]>("/v1/me/memberships"),
  },

  // Conversations / messages
  conversations: {
    list: () => api.get<Conversation[]>("/v1/conversations"),
    create: (input: { title?: string }) => api.post<Conversation>("/v1/conversations", input),
    rename: (id: string, title: string) => api.patch<Conversation>(`/v1/conversations/${id}`, { title }),
    remove: (id: string) => api.delete<void>(`/v1/conversations/${id}`),
    messages: (id: string) => api.get<Message[]>(`/v1/conversations/${id}/messages`),
  },

  // Memories
  memories: {
    list: (q?: { search?: string; category?: string }) => api.get<Memory[]>("/v1/memories", q),
    create: (input: { content: string; category?: string; pinned?: boolean }) => api.post<Memory>("/v1/memories", input),
    update: (id: string, patch: Partial<Memory>) => api.patch<Memory>(`/v1/memories/${id}`, patch),
    remove: (id: string) => api.delete<void>(`/v1/memories/${id}`),
  },

  // Uploads
  uploads: {
    list: () => api.get<Upload[]>("/v1/uploads"),
    initiate: (input: { file_name: string; mime_type: string | null; size: number }) =>
      api.post<{ upload: Upload; upload_url: string }>("/v1/uploads/initiate", input),
    finalize: (id: string) => api.post<Upload>(`/v1/uploads/${id}/finalize`),
    remove: (id: string) => api.delete<void>(`/v1/uploads/${id}`),
  },

  // Workflows
  workflows: {
    list: () => api.get<Workflow[]>("/v1/workflows"),
    get: (id: string) => api.get<WorkflowDetail>(`/v1/workflows/${id}`),
    create: (input: { name: string; description?: string; trigger?: string }) => api.post<Workflow>("/v1/workflows", input),
    setStatus: (id: string, status: Workflow["status"]) => api.patch<Workflow>(`/v1/workflows/${id}`, { status }),
    runs: (id: string, q?: { page?: number; page_size?: number }) =>
      api.get<Paginated<WorkflowRun>>(`/v1/workflows/${id}/runs`, q),
    retry: (id: string, runId: string) => api.post<WorkflowRun>(`/v1/workflows/${id}/runs/${runId}/retry`),
  },

  // Audit
  audit: {
    list: (q?: { search?: string; action?: string; resource_type?: string; page?: number; page_size?: number }) =>
      api.get<Paginated<AuditEvent>>("/v1/audit", q),
  },

  // Analytics
  analytics: {
    overview: () => api.get<{ conversations: number; messages: number; tokens: number; users_active: number; series: { day: string; messages: number }[] }>("/v1/analytics/overview"),
  },
};
