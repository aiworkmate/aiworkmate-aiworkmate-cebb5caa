import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, Plus, Send, Sparkles, Loader2, Trash2, ShieldCheck, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/page-primitives";
import { toast } from "sonner";

export const Route = createFileRoute("/app/chat")({
  head: () => ({ meta: [{ title: "Chat · AI WorkMate" }] }),
  component: ChatPage,
});

interface Conversation { id: string; title: string; updated_at: string }
interface Message { id: string; role: "user" | "assistant" | "system"; content: string; created_at: string }

function ChatPage() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations").select("id, title, updated_at")
        .order("updated_at", { ascending: false });
      return (data ?? []) as Conversation[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!activeId && conversations.length > 0) setActiveId(conversations[0].id);
  }, [conversations, activeId]);

  const { data: messages = [] } = useQuery<Message[]>({
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

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

  async function sendMessage() {
    if (!input.trim() || isStreaming || !session) return;
    let convId = activeId;
    if (!convId) {
      if (!user) return;
      const { data, error } = await supabase
        .from("conversations").insert({ user_id: user.id, title: "New conversation" })
        .select("id").single();
      if (error) { toast.error(error.message); return; }
      convId = data.id;
      setActiveId(convId);
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }
    const userMessage = input.trim();
    setInput("");
    setIsStreaming(true);
    setStreamingText("");

    // Optimistic: show user message immediately
    qc.setQueryData<Message[]>(["messages", convId], (old = []) => [
      ...old,
      { id: `temp-${Date.now()}`, role: "user", content: userMessage, created_at: new Date().toISOString() },
    ]);

    try {
      const history = [...messages.map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: userMessage }];
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ conversationId: convId, messages: history }),
      });
      if (!res.ok || !res.body) { toast.error(`Chat error: ${res.status}`); setIsStreaming(false); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let assembled = "";
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
              if (j.delta) { assembled += j.delta; setStreamingText(assembled); }
              if (j.error) toast.error("Stream error");
            } catch {}
          }
        }
      }
    } finally {
      setIsStreaming(false);
      setStreamingText("");
      qc.invalidateQueries({ queryKey: ["messages", convId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }
  }

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
          {conversations.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">No conversations yet.</div>
          ) : (
            conversations.map((c) => (
              <div key={c.id} className={`group flex items-center gap-2 rounded-md px-2 py-2 text-sm ${activeId === c.id ? "bg-accent text-accent-foreground" : "hover:bg-surface"}`}>
                <button onClick={() => setActiveId(c.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{c.title}</span>
                </button>
                <button onClick={() => deleteConversation(c.id)} className="opacity-0 transition group-hover:opacity-100" title="Delete">
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary-glow" />
            <span className="font-display font-semibold">{conversations.find((c) => c.id === activeId)?.title ?? "New conversation"}</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-success" /> e2e audited
            <span className="mx-2 text-border">·</span>
            <Brain className="h-3 w-3 text-primary-glow" /> memory: on
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          {messages.length === 0 && !isStreaming ? (
            <div className="grid h-full place-items-center p-8">
              <EmptyState
                icon={MessageSquare}
                title="Start a secure conversation"
                description="Ask anything. The orchestrator handles memory, tool calls, and policy on the server."
              />
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
              {messages.map((m) => <MessageBubble key={m.id} role={m.role} content={m.content} />)}
              {isStreaming && (
                <MessageBubble role="assistant" content={streamingText || "▍"} streaming />
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-background/60 p-4 backdrop-blur">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-surface/60 p-2 shadow-elevated">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                rows={1}
                placeholder="Message AI WorkMate…"
                className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-gradient-primary text-primary-foreground shadow-glow transition disabled:opacity-40"
              >
                {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Responses are final outputs only. Tool traces are not displayed.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function MessageBubble({ role, content, streaming }: { role: string; content: string; streaming?: boolean }) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gradient-primary text-[10px] font-bold text-primary-foreground shadow-glow">
          W
        </div>
      )}
      <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
        isUser
          ? "bg-primary text-primary-foreground shadow-glow"
          : "border border-border bg-card text-card-foreground"
      }`}>
        <div className="whitespace-pre-wrap">{content}</div>
        {streaming && <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-primary-glow" />}
      </div>
      {isUser && (
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-surface text-[10px] font-bold">
          You
        </div>
      )}
    </div>
  );
}
