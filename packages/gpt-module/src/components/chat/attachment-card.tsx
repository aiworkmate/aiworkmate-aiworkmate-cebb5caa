import { FileText, Image as ImageIcon, X, Loader2, AlertCircle, Check } from "lucide-react";
import type { PendingAttachment } from "@/services/attachments";
import type { MessageAttachment } from "@/lib/api/endpoints";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Card shown in the composer while an attachment is uploading or staged. */
export function PendingAttachmentCard({
  attachment,
  onRemove,
}: {
  attachment: PendingAttachment;
  onRemove: () => void;
}) {
  const { file, previewUrl, status, progress, error } = attachment;
  const isImage = previewUrl !== null;

  return (
    <div className="group relative flex items-center gap-2 overflow-hidden rounded-md border border-border bg-surface/60 p-1.5 pr-2 text-xs">
      <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded bg-muted">
        {isImage ? (
          <img src={previewUrl ?? undefined} alt={file.name} className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
        {status === "uploading" && (
          <div className="absolute inset-0 grid place-items-center bg-background/70">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-glow" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate font-medium" title={file.name}>{file.name}</div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {status === "uploading" && <span>{Math.round(progress * 100)}%</span>}
          {status === "processing" && <span>processing…</span>}
          {status === "uploaded" && <><Check className="h-3 w-3 text-success" /><span>ready</span></>}
          {status === "failed" && <><AlertCircle className="h-3 w-3 text-destructive" /><span>{error ?? "failed"}</span></>}
          <span className="text-border">·</span>
          <span>{formatBytes(file.size)}</span>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="ml-1 grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/** Compact attachment chip rendered inside an existing message. */
export function MessageAttachmentChip({ attachment }: { attachment: MessageAttachment }) {
  const isImage = attachment.mime_type?.startsWith("image/");
  if (isImage && attachment.thumbnail_url) {
    return (
      <a
        href={attachment.thumbnail_url}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-md border border-border"
      >
        <img src={attachment.thumbnail_url} alt={attachment.file_name} className="max-h-60 w-auto object-cover" />
      </a>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-border bg-surface/70 px-2 py-1.5 text-xs">
      {isImage ? <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
      <span className="font-medium">{attachment.file_name}</span>
      <span className="text-[10px] text-muted-foreground">{formatBytes(attachment.size)}</span>
    </div>
  );
}
