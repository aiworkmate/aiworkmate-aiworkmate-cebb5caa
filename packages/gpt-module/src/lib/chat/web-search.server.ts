// Live data fetch - enterprise stack with graceful degradation.
//   1. Tavily (AI-optimized, primary)
//   2. SerpAPI (Google-grade, fallback)
// Any failure cascades to the next provider. Never throws.

export interface WebSearchResult {
  query: string;
  summary: string;
  sources: string[];
  provider: "tavily" | "serpapi";
}

const DEFAULT_TIMEOUT = 2500;

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<any | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function tavilySearch(query: string, timeoutMs: number): Promise<WebSearchResult | null> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  const data = await fetchJson(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "basic",
        include_answer: true,
        max_results: 5,
      }),
    },
    timeoutMs,
  );
  if (!data) return null;
  const bits: string[] = [];
  const sources: string[] = [];
  if (data.answer) bits.push(data.answer);
  for (const r of (data.results ?? []).slice(0, 5)) {
    if (r.title || r.content) bits.push(`- ${r.title ?? ""}${r.content ? ` - ${r.content}` : ""}`);
    if (r.url) sources.push(r.url);
  }
  const summary = bits.join("\n").trim();
  if (!summary) return null;
  return { query, summary: summary.slice(0, 2000), sources: sources.slice(0, 5), provider: "tavily" };
}

async function serpApiSearch(query: string, timeoutMs: number): Promise<WebSearchResult | null> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return null;
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${key}&num=5`;
  const data = await fetchJson(url, {}, timeoutMs);
  if (!data) return null;
  const bits: string[] = [];
  const sources: string[] = [];
  if (data.answer_box?.answer) bits.push(data.answer_box.answer);
  else if (data.answer_box?.snippet) bits.push(data.answer_box.snippet);
  if (data.knowledge_graph?.description) bits.push(data.knowledge_graph.description);
  for (const r of (data.organic_results ?? []).slice(0, 5)) {
    if (r.title || r.snippet) bits.push(`- ${r.title ?? ""}${r.snippet ? ` - ${r.snippet}` : ""}`);
    if (r.link) sources.push(r.link);
  }
  const summary = bits.join("\n").trim();
  if (!summary) return null;
  return { query, summary: summary.slice(0, 2000), sources: sources.slice(0, 5), provider: "serpapi" };
}

export async function webSearch(query: string, timeoutMs = DEFAULT_TIMEOUT): Promise<WebSearchResult | null> {
  const q = query.trim().slice(0, 300);
  if (!q) return null;
  const startedAt = Date.now();

  try {
    console.log("[web-search] attempt", { provider: "tavily", query: q, timeoutMs });
    const tavily = await tavilySearch(q, timeoutMs);
    if (tavily?.summary) {
      console.log("[web-search] hit", {
        provider: "tavily",
        sources: tavily.sources.length,
        ms: Date.now() - startedAt,
      });
      return tavily;
    }
    console.warn("[web-search] miss", { provider: "tavily", ms: Date.now() - startedAt });
  } catch (err) {
    console.warn("[web-search] tavily error", { err: String(err), ms: Date.now() - startedAt });
  }

  try {
    console.log("[web-search] attempt", { provider: "serpapi", query: q, timeoutMs });
    const serp = await serpApiSearch(q, timeoutMs);
    if (serp?.summary) {
      console.log("[web-search] hit", {
        provider: "serpapi",
        sources: serp.sources.length,
        ms: Date.now() - startedAt,
      });
      return serp;
    }
    console.warn("[web-search] miss", { provider: "serpapi", ms: Date.now() - startedAt });
  } catch (err) {
    console.warn("[web-search] serpapi error", { err: String(err), ms: Date.now() - startedAt });
  }

  console.warn("[web-search] all providers failed", { query: q, ms: Date.now() - startedAt });
  return null;
}
