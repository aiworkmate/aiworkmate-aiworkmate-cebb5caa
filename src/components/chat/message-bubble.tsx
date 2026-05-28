import { useState } from "react";
import { Copy, Check, RotateCw, Pencil, Trash2, Brain, Wrench, Paperclip } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { MessageAttachmentChip } from "./attachment-card";
import type { Message } from "@/lib/api/endpoints";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  attachments?: Message["attachments"];
  tools_used?: Message["tools_used"];
  memories_used?: Message["memories_used"];
}

interface MessageBubbleProps {
  message: ChatMessage;
  streaming?: boolean;
  onCopy?: () => void;
  onRetry?: () => void;
  onEdit?: (newContent: string) => void;
  onDelete?: () => void;
}

/**
 * Single chat message with markdown body, attachments, lightweight
 * tool/memory indicators (no chain-of-thought), and hover actions.
 */
export function MessageBubble({ message, streaming, onCopy, onRetry, onEdit, onDelete }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    onCopy?.();
  };

  return (
    <div className={`group flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gradient-primary text-[10px] font-bold text-primary-foreground shadow-glow">
          W
        </div>
      )}
      <div className={`flex max-w-[80%] flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
        <div className={`relative w-full rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground shadow-glow"
            : "border border-border bg-card text-card-foreground"
        }`}>
          {editing && isUser ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={Math.min(8, Math.max(2, draft.split("\n").length))}
                className="w-full resize-none rounded bg-background/20 p-2 text-sm text-inherit outline-none ring-1 ring-white/20"
                autoFocus
              />
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => { setDraft(message.content); setEditing(false); }}
                  className="rounded px-2 py-1 text-xs opacity-80 hover:opacity-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { onEdit?.(draft); setEditing(false); }}
                  disabled={!draft.trim() || draft === message.content}
                  className="rounded bg-background/20 px-2 py-1 text-xs font-medium ring-1 ring-white/20 disabled:opacity-40"
                >
                  Save & resend
                </button>
              </div>
            </div>
          ) : isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <Markdown content={message.content || (streaming ? "…" : "")} />
          )}
          {streaming && <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-primary-glow align-middle" />}

          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.attachments.map((a) => (
                <MessageAttachmentChip key={a.id} attachment={a} />
              ))}
            </div>
          )}
        </div>

        {/* Tool + memory indicators (assistant only, never chain-of-thought) */}
        {!isUser && !streaming && (message.tools_used?.length || message.memories_used?.length || message.attachments?.length) ? (
          <div className="flex flex-wrap items-center gap-1.5 px-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {message.memories_used && message.memories_used.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface/60 px-1.5 py-0.5">
                <Brain className="h-3 w-3 text-primary-glow" /> {message.memories_used.length} memor{message.memories_used.length === 1 ? "y" : "ies"}
              </span>
            )}
            {message.tools_used?.map((t) => (
              <span key={t.name} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface/60 px-1.5 py-0.5">
                <Wrench className={`h-3 w-3 ${t.status === "error" ? "text-destructive" : "text-muted-foreground"}`} />
                {t.name}
              </span>
            ))}
            {message.attachments && message.attachments.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface/60 px-1.5 py-0.5">
                <Paperclip className="h-3 w-3" /> {message.attachments.length}
              </span>
            )}
          </div>
        ) : null}

        {/* Hover actions */}
        {!editing && !streaming && (
          <div className={`flex gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 ${isUser ? "flex-row-reverse" : ""}`}>
            <ActionButton onClick={handleCopy} label={copied ? "Copied" : "Copy"}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </ActionButton>
            {isUser && onEdit && (
              <ActionButton onClick={() => setEditing(true)} label="Edit">
                <Pencil className="h-3 w-3" />
              </ActionButton>
            )}
            {!isUser && onRetry && (
              <ActionButton onClick={onRetry} label="Regenerate">
                <RotateCw className="h-3 w-3" />
              </ActionButton>
            )}
            {onDelete && (
              <ActionButton onClick={onDelete} label="Delete" danger>
                <Trash2 className="h-3 w-3" />
              </ActionButton>
            )}
          </div>
        )}
      </div>
      {isUser && (
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-surface text-[10px] font-bold">
          You
        </div>
      )}
    </div>
  );
}

function ActionButton({ onClick, label, danger, children }: { onClick: () => void; label: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-accent ${danger ? "hover:text-destructive" : "hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}
