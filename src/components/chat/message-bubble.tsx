import { useState } from "react";
import { Copy, Check, RotateCw, Pencil, Trash2, Brain, Wrench, Paperclip, Globe, ThumbsUp, ThumbsDown } from "lucide-react";
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

export interface ToolEvent {
  name: string;
  status: "start" | "running" | "stream" | "done" | "error" | "skipped";
}

interface MessageBubbleProps {
  message: ChatMessage;


  streaming?: boolean;
  statusLabel?: string;
  tools?: ToolEvent[];
  sources?: string[];
  feedback?: "up" | "down" | null;
  onFeedback?: (helpful: boolean) => void;
  onCopy?: () => void;
  onRetry?: () => void;
  onEdit?: (newContent: string) => void;
  onDelete?: () => void;
}

/**
 * Single chat message with markdown body, attachments, lightweight
 * tool/memory indicators (no chain-of-thought), and hover actions.
 */
export function MessageBubble({
  message, streaming, statusLabel, tools, sources, feedback, onFeedback,
  onCopy, onRetry, onEdit, onDelete,
}: MessageBubbleProps) {


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
          ) : streaming && !message.content ? (
            <div className="flex items-center gap-2 py-0.5 text-muted-foreground">
              <span className="flex gap-1" aria-hidden>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-glow [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-glow [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-glow" />
              </span>
              <span className="text-xs italic">{statusLabel ?? "Thinking…"}</span>
            </div>
          ) : (
            <div className="animate-in fade-in duration-200">

              <Markdown content={message.content} />
            </div>
          )}
          {streaming && message.content && (
            <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-primary-glow align-middle" />
          )}


          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.attachments.map((a) => (
                <MessageAttachmentChip key={a.id} attachment={a} />
              ))}
            </div>
          )}

          {/* Live tool indicators (streaming only) */}
          {!isUser && streaming && tools && tools.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 animate-in fade-in duration-200">
              {tools.map((t) => (
                <span
                  key={t.name}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  {t.name === "web_search" ? <Globe className="h-3 w-3 text-primary-glow" /> : <Wrench className="h-3 w-3" />}
                  {t.name.replace(/_/g, " ")}
                  <span className={`ml-1 h-1.5 w-1.5 rounded-full ${
                    t.status === "running" ? "animate-pulse bg-primary-glow"
                    : t.status === "done" ? "bg-success"
                    : t.status === "error" ? "bg-destructive"
                    : "bg-muted-foreground/40"
                  }`} />
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Source citations (assistant) */}
        {!isUser && sources && sources.length > 0 && (
          <div className="flex flex-col gap-1 px-1 animate-in fade-in duration-300">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
              Updated with live sources
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sources.slice(0, 6).map((src, i) => {
                let host = src;
                try { host = new URL(src).hostname.replace(/^www\./, ""); } catch { /* keep raw */ }
                return (
                  <a
                    key={`${src}-${i}`}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-surface/60 px-2 py-0.5 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    title={src}
                  >
                    <Globe className="h-3 w-3" /> {host}
                  </a>
                );
              })}
            </div>
          </div>
        )}


        {/* Tool + memory indicators (persisted assistant messages) */}
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

        {/* Hover actions + feedback */}
        {!editing && !streaming && (
          <div className={`flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 ${isUser ? "flex-row-reverse" : ""}`}>
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
            {!isUser && onFeedback && (
              <>
                <ActionButton
                  onClick={() => onFeedback(true)}
                  label="Helpful"
                  active={feedback === "up"}
                >
                  <ThumbsUp className="h-3 w-3" />
                </ActionButton>
                <ActionButton
                  onClick={() => onFeedback(false)}
                  label="Not helpful"
                  active={feedback === "down"}
                >
                  <ThumbsDown className="h-3 w-3" />
                </ActionButton>
              </>
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

function ActionButton({ onClick, label, danger, active, children }: { onClick: () => void; label: string; danger?: boolean; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`grid h-6 w-6 place-items-center rounded transition ${
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent"
      } ${danger ? "hover:text-destructive" : "hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

