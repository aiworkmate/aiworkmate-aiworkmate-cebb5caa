import { useCallback, useRef, useState } from "react";
import { Loader2, Paperclip, Send } from "lucide-react";
import { createPending, releasePending, uploadAttachment, toMessageAttachment, type PendingAttachment } from "@/services/attachments";
import type { MessageAttachment } from "@/lib/api/endpoints";
import { PendingAttachmentCard } from "./attachment-card";

interface ComposerProps {
  disabled?: boolean;
  isStreaming?: boolean;
  onSend: (text: string, attachments: MessageAttachment[]) => void | Promise<void>;
}

/**
 * Chat composer with drag/drop attachment support. Storage is delegated to
 * `services/attachments` — this component only manages local UI state.
 */
export function Composer({ disabled, isStreaming, onSend }: ComposerProps) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = Boolean(text.trim() || pending.some((p) => p.status === "uploaded"))
    && !isStreaming
    && !pending.some((p) => p.status === "uploading" || p.status === "processing");

  const addFiles = useCallback((files: FileList | File[]) => {
    const next: PendingAttachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 25 * 1024 * 1024) continue; // 25 MB client guard
      next.push(createPending(file));
    }
    if (!next.length) return;
    setPending((curr) => [...curr, ...next]);
    for (const p of next) {
      uploadAttachment(p, (update) => {
        setPending((curr) => curr.map((c) => (c.clientId === update.clientId ? update : c)));
      });
    }
  }, []);

  const removePending = (clientId: string) => {
    setPending((curr) => {
      const target = curr.find((c) => c.clientId === clientId);
      if (target) releasePending(target);
      return curr.filter((c) => c.clientId !== clientId);
    });
  };

  const handleSubmit = async () => {
    if (!canSend) return;
    const attachments = pending
      .map(toMessageAttachment)
      .filter((a): a is MessageAttachment => a !== null);
    const value = text.trim();
    setText("");
    pending.forEach(releasePending);
    setPending([]);
    await onSend(value, attachments);
  };

  return (
    <div
      onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      }}
      className={`mx-auto max-w-3xl rounded-xl border bg-surface/60 shadow-elevated transition ${
        dragOver ? "border-primary/60 ring-2 ring-primary/30" : "border-border"
      }`}
    >
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-border/60 p-2">
          {pending.map((p) => (
            <PendingAttachmentCard
              key={p.clientId}
              attachment={p}
              onRemove={() => removePending(p.clientId)}
            />
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 p-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Attach files"
          type="button"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) { addFiles(e.target.files); e.target.value = ""; } }}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          rows={1}
          placeholder={dragOver ? "Drop files to attach…" : "Message AI WorkMate…"}
          disabled={disabled}
          className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-gradient-primary text-primary-foreground shadow-glow transition disabled:opacity-40"
          aria-label="Send message"
        >
          {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
