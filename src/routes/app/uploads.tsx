import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { FileText, Upload, Trash2, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState, StatusPill } from "@/components/page-primitives";
import { toast } from "sonner";

export const Route = createFileRoute("/app/uploads")({
  head: () => ({ meta: [{ title: "Documents · AI WorkMate" }] }),
  component: UploadsPage,
});

interface UploadRow { id: string; file_name: string; file_size: number; mime_type: string | null; status: string; created_at: string; storage_path: string }

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function UploadsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [q, setQ] = useState("");

  const { data: uploads = [] } = useQuery<UploadRow[]>({
    queryKey: ["uploads", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("uploads").select("id, file_name, file_size, mime_type, status, created_at, storage_path").order("created_at", { ascending: false });
      return (data ?? []) as UploadRow[];
    },
    enabled: !!user,
  });

  const filtered = uploads.filter((u) => !q || u.file_name.toLowerCase().includes(q.toLowerCase()));

  async function handleFiles(files: FileList | null) {
    if (!files || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `${user.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("uploads").upload(path, file);
        if (upErr) { toast.error(`${file.name}: ${upErr.message}`); continue; }
        const { error: insErr } = await supabase.from("uploads").insert({
          user_id: user.id, file_name: file.name, file_size: file.size,
          mime_type: file.type || null, storage_path: path, status: "ready",
        });
        if (insErr) { toast.error(insErr.message); continue; }
      }
      qc.invalidateQueries({ queryKey: ["uploads"] });
      toast.success("Upload complete");
    } finally {
      setUploading(false);
    }
  }

  async function remove(row: UploadRow) {
    await supabase.storage.from("uploads").remove([row.storage_path]);
    await supabase.from("uploads").delete().eq("id", row.id);
    qc.invalidateQueries({ queryKey: ["uploads"] });
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <PageHeader
        eyebrow="Document intelligence"
        title="Documents"
        description="Files are stored in your tenant, indexed by the backend, and gated by RLS."
        actions={<StatusPill tone="success">RLS enforced</StatusPill>}
      />

      <div className="space-y-6 p-6">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition ${
            dragging ? "border-primary bg-primary/5" : "border-border bg-surface/40 hover:border-primary/40"
          }`}
        >
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary-glow" />
          ) : (
            <Upload className="h-6 w-6 text-primary-glow" />
          )}
          <div className="mt-3 font-display text-base font-semibold">Drop files or click to upload</div>
          <div className="mt-1 text-sm text-muted-foreground">PDF, DOCX, TXT, images. Up to 50 MB each.</div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents…"
            className="w-full rounded-md border border-input bg-surface/60 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No documents yet" description="Upload a file to begin. Extraction and indexing happen on the backend." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface/50 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">File</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Size</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Uploaded</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-surface/40">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><span className="truncate font-medium">{u.file_name}</span></div></td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{fmtBytes(u.file_size)}</td>
                    <td className="px-4 py-3"><StatusPill tone={u.status === "ready" ? "success" : u.status === "failed" ? "danger" : "warning"}>{u.status}</StatusPill></td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => remove(u)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
