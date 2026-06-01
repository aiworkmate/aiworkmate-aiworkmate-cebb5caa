import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="group relative my-3 overflow-hidden rounded-md border border-border bg-[#1e1e1e]">
      <div className="flex items-center justify-between border-b border-border/60 bg-black/30 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{language || "text"}</span>
        <button onClick={copy} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={vscDarkPlus}
        customStyle={{ margin: 0, padding: "12px 14px", background: "transparent", fontSize: 12.5 }}
        PreTag="div"
      >
        {value.replace(/\n$/, "")}
      </SyntaxHighlighter>
    </div>
  );
}

export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-workmate text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const value = String(children ?? "");
            const isInline = !match && !value.includes("\n");
            if (isInline) {
              return <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[12px]" {...props}>{children}</code>;
            }
            return <CodeBlock language={match?.[1] ?? ""} value={value} />;
          },
          a({ children, ...props }) {
            return <a {...props} className="text-primary-glow underline underline-offset-2" target="_blank" rel="noreferrer">{children}</a>;
          },
          ul({ children }) { return <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>; },
          ol({ children }) { return <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>; },
          h1({ children }) { return <h1 className="mt-3 mb-2 font-display text-lg font-semibold">{children}</h1>; },
          h2({ children }) { return <h2 className="mt-3 mb-2 font-display text-base font-semibold">{children}</h2>; },
          h3({ children }) { return <h3 className="mt-3 mb-2 font-display text-sm font-semibold">{children}</h3>; },
          p({ children }) { return <p className="my-2 whitespace-pre-wrap">{children}</p>; },
          blockquote({ children }) {
            return <blockquote className="my-2 border-l-2 border-primary/50 bg-muted/30 px-3 py-1 italic">{children}</blockquote>;
          },
          table({ children }) {
            return <div className="my-3 overflow-x-auto"><table className="min-w-full text-xs">{children}</table></div>;
          },
          th({ children }) { return <th className="border border-border bg-muted/40 px-2 py-1 text-left font-medium">{children}</th>; },
          td({ children }) { return <td className="border border-border px-2 py-1 align-top">{children}</td>; },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
