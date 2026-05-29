import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Plus, Sparkles, ShieldCheck, Brain, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/page-primitives";
import { toast } from "sonner";
import { Composer } from "@/components/chat/composer";
import { MessageBubble, type ToolEvent } from "@/components/chat/message-bubble";
import { ConversationItem } from "@/components/chat/conversation-item";
import { submitMemoryFeedback } from "@/lib/chat/feedback.functions";
import type { MessageAttachment } from "@/lib/api/endpoints";


export const Route = createFileRoute("/app/chat")({
  head: () => ({ meta: [{ title: "Chat · AI WorkMate" }] }),
  component: ChatPage,
});

interface Conversation { id: string; title: string; updated_at: string }
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  attachments?: MessageAttachment[];
}

type StreamPhase = "idle" | "thinking" | "searching" | "generating" | "streaming";

function ChatPage() {
  const { user, session } = useAuth();
  const qc = useQueryClient();
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [phase, setPhase] = useState<StreamPhase>("idle");
  const [liveTools, setLiveTools] = useState<ToolEvent[]>([]);
  const [liveSources, setLiveSources] = useState<string[]>([]);
  // Map of assistant message id -> {memoryIds, sources} captured from the SSE `done` event.
  // Used to attribute feedback to the memories that were actually surfaced.
  const [responseMeta, setResponseMeta] = useState<Record<string, { memoryIds: string[]; sources: string[] }>>({});
  const [feedbackState, setFeedbackState] = useState<Record<string, "up" | "down">>({});
  // Local message overlay — optimistic user messages + assistant pin until DB persists.
  const [overlay, setOverlay] = useState<Record<string, Message[]>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  // Race-proofing: only events whose envelope.requestId matches the active id
  // AND whose seq is strictly greater than the last accepted seq are applied.
  const activeRequestIdRef = useRef<string | null>(null);
  const lastSeqRef = useRef<number>(-1);
  const abortRef = useRef<AbortController | null>(null);




  const conversationsQ = useQuery<Conversation[]>({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations").select("id, title, updated_at")
        .order("updated_at", { ascending: false });
      return (data ?? []) as Conversation[];
    },
    enabled: !!user,
  });
  const conversations = conversationsQ.data ?? [];

  useEffect(() => {
    if (!activeId && conversations.length > 0) setActiveId(conversations[0].id);
  }, [conversations, activeId]);

  const messagesQ = useQuery<Message[]>({
    queryKey: ["messages", activeId],
    queryFn: async () => {
      if (!activeId) return [];
      const { data } = await supabase
        .from("messages").select("id, role, content, created_at")
        .eq("conversation_id", activeId).order("created_at", { ascending: true });
      return (data ?? []) as Message[];
    },
    enabled: !!activeId,
  });
  const dbMessages = messagesQ.data ?? [];
  const localOverlay = activeId ? overlay[activeId] ?? [] : [];
  // Merge: server messages + overlay entries not yet reflected in DB.
  // Dedupe by id OR by (role + exact content) so a streamed assistant reply
  // stays visible until the DB refetch returns the persisted row.
  const messages: Message[] = [
    ...dbMessages,
    ...localOverlay.filter(
      (o) => !dbMessages.some((d) => d.id === o.id || (d.role === o.role && d.content === o.content)),
    ),
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, streamingText]);

  async function createConversation() {
    if (!user) return;
    const { data, error } = await supabase
      .from("conversations").insert({ user_id: user.id, title: "New conversation" })
      .select("id, title, updated_at").single();
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["conversations"] });
    setActiveId(data.id);
  }

  async function deleteConversation(id: string) {
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["conversations"] });
    if (activeId === id) setActiveId(null);
  }

  async function renameConversation(id: string, title: string) {
    // Optimistic
    qc.setQueryData<Conversation[]>(["conversations", user?.id], (old = []) =>
      old.map((c) => (c.id === id ? { ...c, title } : c)),
    );
    const { error } = await supabase.from("conversations").update({ title }).eq("id", id);
    if (error) { toast.error(error.message); qc.invalidateQueries({ queryKey: ["conversations"] }); }
  }

  async function deleteMessage(id: string) {
    if (!activeId) return;
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["messages", activeId] });
  }

  async function sendMessage(text: string, attachments: MessageAttachment[]) {
    if ((!text && attachments.length === 0) || !session) return;
    // Abort any in-flight stream so its late events are dropped by the seq guard below.
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    // Reset stream-state guards. The real activeRequestId is captured from the
    // server's first envelope; until then we accept events from any id.
    activeRequestIdRef.current = null;
    lastSeqRef.current = -1;

    let convId = activeId;
    if (!convId) {
      if (!user) return;
      const autoTitle = text ? text.slice(0, 60) : "New conversation";
      const { data, error } = await supabase
        .from("conversations").insert({ user_id: user.id, title: autoTitle })
        .select("id").single();
      if (error) { toast.error(error.message); return; }
      convId = data.id;
      setActiveId(convId);
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }

    // Auto-title: if conversation still has the default title, replace with first user message.
    const existing = conversations.find((c) => c.id === convId);
    if (existing && existing.title === "New conversation" && text) {
      renameConversation(convId, text.slice(0, 60));
    }

    setIsStreaming(true);
    setStreamingText("");
    setPhase("thinking");
    setLiveTools([]);
    setLiveSources([]);

    const optimisticUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
      attachments: attachments.length ? attachments : undefined,
    };
    setOverlay((curr) => ({ ...curr, [convId!]: [...(curr[convId!] ?? []), optimisticUserMsg] }));

    let assembled = "";
    let doneMeta: { messageId: string | null; memoryIds: string[] } | null = null;
    try {
      const history = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text },
      ];
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ conversationId: convId, messages: history, attachments }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        console.error("[chat] http error", res.status, errText.slice(0, 300));
        toast.error(`Chat error: ${res.status}`);
        assembled = "Sorry, something went wrong. Please try again.";
        return;
      }

      // Capture server-issued request id from the response header as a backup;
      // the per-event envelope is the source of truth.
      const headerReqId = res.headers.get("X-Request-Id");
      if (headerReqId) activeRequestIdRef.current = headerReqId;
      if (res.headers.get("X-Chat-Live") === "1") setPhase("searching");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const block = buf.slice(0, idx); buf = buf.slice(idx + 2);
          for (const line of block.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const j = JSON.parse(payload);
              // Envelope guard: drop stale or out-of-order events from aborted
              // requests. The first envelope we see locks the activeRequestId.
              if (typeof j.requestId === "string") {
                if (activeRequestIdRef.current && j.requestId !== activeRequestIdRef.current) {
                  continue;
                }
                if (!activeRequestIdRef.current) activeRequestIdRef.current = j.requestId;
              }
              if (typeof j.seq === "number") {
                if (j.seq <= lastSeqRef.current) continue;
                lastSeqRef.current = j.seq;
              }

              // Typed protocol: { type: "state"|"tool"|"sources"|"memory"|"token"|"done" }

              switch (j.type) {
                case "state":
                  if (j.phase) setPhase(j.phase as StreamPhase);
                  break;
                case "tool": {
                  const evt: ToolEvent = { name: j.name, status: j.status };
                  if (evt.name === "web_search" && (evt.status === "running" || evt.status === "start")) setPhase("searching");

                  setLiveTools((curr) => {
                    const next = curr.filter((t) => t.name !== evt.name);
                    next.push(evt);
                    return next;
                  });
                  if (Array.isArray(j.sources) && j.sources.length) {
                    setLiveSources((curr) => Array.from(new Set([...curr, ...j.sources])));
                  }
                  break;
                }
                case "sources":
                  if (Array.isArray(j.sources)) {
                    setLiveSources((curr) => Array.from(new Set([...curr, ...j.sources])));
                  }
                  break;
                case "memory":
                  // surfaced count is informational; ids are also delivered on `done`.
                  break;
                case "token":
                  if (j.delta) {
                    assembled += j.delta;
                    setStreamingText(assembled);
                    setPhase("streaming");
                  }
                  break;
                case "done":
                  doneMeta = {
                    messageId: j.messageId ?? null,
                    memoryIds: Array.isArray(j.memoryIds) ? j.memoryIds : [],
                  };
                  break;
                default:
                  // Legacy { delta } fallback for older builds.
                  if (j.delta) {
                    assembled += j.delta;
                    setStreamingText(assembled);
                    setPhase("streaming");
                  }
                  if (j.error) toast.error("Stream error");
              }
            } catch { /* keepalive */ }
          }
        }
      }


    } catch (err) {
      // Aborts are intentional (user sent a new message); don't show an error.
      if ((err as { name?: string })?.name === "AbortError") return;
      console.error("[chat] stream failure", err);
      toast.error("Connection lost. Please try again.");
      if (!assembled) assembled = "Sorry, something went wrong. Please try again.";

    } finally {
      // Pin the assembled reply into overlay so it remains visible across the
      // brief gap before the DB refetch returns the persisted assistant row.
      if (assembled.trim()) {
        const finalAssistant: Message = {
          id: `temp-asst-${Date.now()}`,
          role: "assistant",
          content: assembled,
          created_at: new Date().toISOString(),
        };
        setOverlay((curr) => ({
          ...curr,
          [convId!]: [...(curr[convId!] ?? []), finalAssistant],
        }));
      }
      // Attribute response meta so feedback knows which memories were used.
      if (doneMeta?.messageId) {
        const meta = doneMeta;
        setResponseMeta((curr) => ({
          ...curr,
          [meta.messageId!]: { memoryIds: meta.memoryIds, sources: liveSources },
        }));
      }
      if (abortRef.current === ac) abortRef.current = null;
      setIsStreaming(false);
      setStreamingText("");
      setPhase("idle");
      setLiveTools([]);

      // keep liveSources momentarily so they animate into the finalized bubble via responseMeta
      qc.invalidateQueries({ queryKey: ["messages", convId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setTimeout(() => {
        setOverlay((curr) => ({ ...curr, [convId!]: [] }));
        setLiveSources([]);
      }, 4000);
    }
  }

  async function handleFeedback(messageId: string, helpful: boolean) {
    // Optimistic UI; server fn records + adjusts memory weights.
    setFeedbackState((curr) => ({ ...curr, [messageId]: helpful ? "up" : "down" }));
    const meta = responseMeta[messageId];
    try {
      await submitMemoryFeedback({
        data: {
          messageId,
          conversationId: activeId,
          memoryIds: meta?.memoryIds ?? [],
          helpful,
        },
      });
      toast.success(helpful ? "Thanks — boosted those memories." : "Got it — we'll use those less.");
    } catch (err) {
      console.error("[feedback] failed", err);
      toast.error("Couldn't save feedback");
      setFeedbackState((curr) => {
        const next = { ...curr };
        delete next[messageId];
        return next;
      });
    }
  }


  async function retryLastAssistant() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    // Strip the last assistant message locally; backend will produce a fresh one.
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAssistant && !lastAssistant.id.startsWith("temp-")) {
      await supabase.from("messages").delete().eq("id", lastAssistant.id);
      qc.invalidateQueries({ queryKey: ["messages", activeId] });
    }
    sendMessage(lastUser.content, lastUser.attachments ?? []);
  }

  async function editAndResend(messageId: string, newContent: string) {
    // Truncate from the edited message onward, then resend.
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    const tail = messages.slice(idx);
    for (const m of tail) {
      if (!m.id.startsWith("temp-")) {
        await supabase.from("messages").delete().eq("id", m.id);
      }
    }
    qc.invalidateQueries({ queryKey: ["messages", activeId] });
    sendMessage(newContent, []);
  }

  const activeConv = conversations.find((c) => c.id === activeId);
  const messagesLoading = messagesQ.isLoading && !!activeId;

  return (
    <div className="flex h-full">
      {/* Conversation list */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-surface/30 lg:flex">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-display text-sm font-semibold">Conversations</span>
          <button onClick={createConversation} className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface hover:bg-accent" title="New chat">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
          {conversationsQ.isLoading ? (
            <ConversationSkeletons />
          ) : conversations.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">No conversations yet.</div>
          ) : (
            conversations.map((c) => (
              <ConversationItem
                key={c.id}
                id={c.id}
                title={c.title}
                active={activeId === c.id}
                onSelect={() => setActiveId(c.id)}
                onRename={(t) => renameConversation(c.id, t)}
                onDelete={() => deleteConversation(c.id)}
              />
            ))
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className="flex min-w-0 flex-1 flex-col">
        <ThreadHeader
          title={activeConv?.title ?? "New conversation"}
          canRename={!!activeConv}
          onRename={(t) => activeConv && renameConversation(activeConv.id, t)}
        />

        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          {messagesLoading ? (
            <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
              <MessageSkeleton />
              <MessageSkeleton align="right" />
              <MessageSkeleton />
            </div>
          ) : messages.length === 0 && !isStreaming ? (
            <div className="grid h-full place-items-center p-8">
              <EmptyState
                icon={MessageSquare}
                title="Start a secure conversation"
                description="Ask anything. The orchestrator handles memory, tool calls, and policy on the server."
              />
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
              {messages.map((m) => {
                const meta = responseMeta[m.id];
                return (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    sources={m.role === "assistant" ? meta?.sources : undefined}
                    feedback={m.role === "assistant" ? feedbackState[m.id] ?? null : undefined}
                    onFeedback={m.role === "assistant" && !m.id.startsWith("temp-")
                      ? (helpful) => handleFeedback(m.id, helpful)
                      : undefined}
                    onEdit={m.role === "user" ? (next) => editAndResend(m.id, next) : undefined}
                    onRetry={m.role === "assistant" ? retryLastAssistant : undefined}
                    onDelete={m.id.startsWith("temp-") ? undefined : () => deleteMessage(m.id)}
                  />
                );
              })}
              {isStreaming && (
                <MessageBubble
                  message={{ id: "streaming", role: "assistant", content: streamingText }}
                  streaming
                  tools={liveTools}
                  sources={liveSources}
                  statusLabel={
                    phase === "searching" ? "Searching the web…"
                    : phase === "generating" ? "Generating answer…"
                    : phase === "thinking" ? "Thinking…"
                    : undefined
                  }
                />
              )}


            </div>
          )}
        </div>

        <div className="border-t border-border bg-background/60 p-4 backdrop-blur">
          <Composer isStreaming={isStreaming} onSend={sendMessage} />
          <p className="mx-auto mt-2 max-w-3xl text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Responses are final outputs only. Tool traces are not displayed.
          </p>
        </div>
      </section>
    </div>
  );
}

function ThreadHeader({ title, canRename, onRename }: { title: string; canRename: boolean; onRename: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  useEffect(() => setDraft(title), [title]);

  return (
    <div className="flex items-center justify-between border-b border-border px-6 py-3">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <Sparkles className="h-4 w-4 shrink-0 text-primary-glow" />
        {editing ? (
          <>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { if (draft.trim() && draft !== title) onRename(draft.trim()); setEditing(false); }
                if (e.key === "Escape") { setDraft(title); setEditing(false); }
              }}
              className="min-w-0 rounded bg-surface px-2 py-0.5 text-sm font-semibold outline-none ring-1 ring-ring/40"
              autoFocus
            />
            <button onClick={() => { if (draft.trim() && draft !== title) onRename(draft.trim()); setEditing(false); }} className="grid h-6 w-6 place-items-center rounded hover:bg-accent">
              <Check className="h-3.5 w-3.5 text-success" />
            </button>
            <button onClick={() => { setDraft(title); setEditing(false); }} className="grid h-6 w-6 place-items-center rounded hover:bg-accent">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </>
        ) : (
          <>
            <span className="truncate font-display font-semibold">{title}</span>
            {canRename && (
              <button onClick={() => setEditing(true)} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground" title="Rename">
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </>
        )}
      </div>
      <div className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:flex">
        <ShieldCheck className="h-3 w-3 text-success" /> e2e audited
        <span className="mx-2 text-border">·</span>
        <Brain className="h-3 w-3 text-primary-glow" /> memory: on
      </div>
    </div>
  );
}

function ConversationSkeletons() {
  return (
    <div className="space-y-1.5 p-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-7 w-full animate-pulse rounded-md bg-surface/80" />
      ))}
    </div>
  );
}

function MessageSkeleton({ align = "left" }: { align?: "left" | "right" }) {
  return (
    <div className={`flex gap-3 ${align === "right" ? "justify-end" : "justify-start"}`}>
      {align === "left" && <div className="h-7 w-7 shrink-0 animate-pulse rounded-md bg-surface" />}
      <div className="w-2/3 space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-surface" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-surface" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-surface" />
      </div>
    </div>
  );
}
