/**
 * Attachment service abstraction.
 *
 * Frontend NEVER talks to storage directly. This module wraps the upload
 * lifecycle so feature code only sees a clean `uploadAttachment(file, cb)`
 * surface. The real backend will swap in once `VITE_API_BASE_URL` is set;
 * until then we fall back to local blob URLs so the UX flow is testable.
 */
import { endpoints, type MessageAttachment, type Upload } from "@/lib/api/endpoints";
import { ApiNotConfiguredError } from "@/lib/api/client";

export type AttachmentStatus = "uploading" | "processing" | "uploaded" | "failed";

export interface PendingAttachment {
  /** Stable client id used for optimistic UI before the server returns one. */
  clientId: string;
  file: File;
  /** Local preview URL (object URL) for images. */
  previewUrl: string | null;
  status: AttachmentStatus;
  progress: number; // 0..1
  error?: string;
  /** Server-side upload record once finalized. */
  upload?: Upload;
}

export function createPending(file: File): PendingAttachment {
  return {
    clientId: crypto.randomUUID(),
    file,
    previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    status: "uploading",
    progress: 0,
  };
}

export function releasePending(p: PendingAttachment) {
  if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
}

/**
 * Uploads a file via the backend's signed-URL flow.
 * Falls back to a simulated local upload when the backend isn't configured
 * yet — this keeps the chat UX exercisable in preview.
 */
export async function uploadAttachment(
  pending: PendingAttachment,
  onProgress: (p: PendingAttachment) => void,
): Promise<PendingAttachment> {
  try {
    const initiated = await endpoints.uploads.initiate({
      file_name: pending.file.name,
      mime_type: pending.file.type || null,
      size: pending.file.size,
    });

    await putWithProgress(initiated.upload_url, pending.file, (pct) => {
      onProgress({ ...pending, status: "uploading", progress: pct });
    });

    onProgress({ ...pending, status: "processing", progress: 1 });
    const finalized = await endpoints.uploads.finalize(initiated.upload.id);
    const done: PendingAttachment = { ...pending, status: "uploaded", progress: 1, upload: finalized };
    onProgress(done);
    return done;
  } catch (err) {
    if (err instanceof ApiNotConfiguredError) {
      // Preview-mode simulation so the chat flow stays usable without a backend.
      return simulate(pending, onProgress);
    }
    const failed: PendingAttachment = {
      ...pending,
      status: "failed",
      error: err instanceof Error ? err.message : "Upload failed",
    };
    onProgress(failed);
    return failed;
  }
}

async function simulate(
  pending: PendingAttachment,
  onProgress: (p: PendingAttachment) => void,
): Promise<PendingAttachment> {
  for (let i = 1; i <= 5; i++) {
    await new Promise((r) => setTimeout(r, 80));
    onProgress({ ...pending, status: "uploading", progress: i / 5 });
  }
  const fake: Upload = {
    id: pending.clientId,
    workspace_id: "preview",
    file_name: pending.file.name,
    mime_type: pending.file.type || null,
    size: pending.file.size,
    status: "ready",
    thumbnail_url: pending.previewUrl,
    created_at: new Date().toISOString(),
  };
  const done: PendingAttachment = { ...pending, status: "uploaded", progress: 1, upload: fake };
  onProgress(done);
  return done;
}

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(file);
  });
}

/** Convert a finalized pending attachment to the wire shape sent with a message. */
export function toMessageAttachment(p: PendingAttachment): MessageAttachment | null {
  if (!p.upload) return null;
  return {
    id: p.upload.id,
    upload_id: p.upload.id,
    file_name: p.upload.file_name,
    mime_type: p.upload.mime_type,
    size: p.upload.size,
    thumbnail_url: p.upload.thumbnail_url ?? p.previewUrl,
  };
}
