// Live data fetch — enterprise stack with graceful degradation.
//   1. Tavily (AI-optimized, primary)
//   2. SerpAPI (Google-grade, fallback)
//   3. DuckDuckGo Instant Answer (last-resort, no key required)
// Any failure cascades to the next provider. Never throws.

export interface WebSearchResult {
  query: string;
  summary: string;
  sources: string[];
  provider: "tavily" | "serpapi" | "duckduckgo";
}

const DEFAULT_TIMEOUT = 5000;

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<any | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
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
    if (r.title || r.content) bits.push(`• ${r.title ?? ""}${r.content ? ` — ${r.content}` : ""}`);
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
    if (r.title || r.snippet) bits.push(`• ${r.title ?? ""}${r.snippet ? ` — ${r.snippet}` : ""}`);
    if (r.link) sources.push(r.link);
  }
  const summary = bits.join("\n").trim();
  if (!summary) return null;
  return { query, summary: summary.slice(0, 2000), sources: sources.slice(0, 5), provider: "serpapi" };
}

async function duckDuckGoSearch(query: string, timeoutMs: number): Promise<WebSearchResult | null> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const data = await fetchJson(url, { headers: { "User-Agent": "AIWorkMate/1.0" } }, timeoutMs);
  if (!data) return null;
  const bits: string[] = [];
  const sources: string[] = [];
  if (data.Answer) bits.push(data.Answer);
  if (data.AbstractText) bits.push(data.AbstractText);
  if (data.AbstractURL) sources.push(data.AbstractURL);
  const flat: Array<{ Text?: string; FirstURL?: string }> = [];
  for (const t of data.RelatedTopics ?? []) {
    if (t.Text) flat.push(t);
    if (t.Topics) flat.push(...t.Topics);
  }
  for (const t of flat.slice(0, 4)) {
    if (t.Text) bits.push(`• ${t.Text}`);
    if (t.FirstURL) sources.push(t.FirstURL);
  }
  const summary = bits.join("\n").trim();
  if (!summary) return null;
  return { query, summary: summary.slice(0, 2000), sources: sources.slice(0, 5), provider: "duckduckgo" };
}

export async function webSearch(query: string, timeoutMs = DEFAULT_TIMEOUT): Promise<WebSearchResult | null> {
  const q = query.trim().slice(0, 300);
  if (!q) return null;

  // 1. Tavily (primary)
  try {
    const tavily = await tavilySearch(q, timeoutMs);
    if (tavily?.summary) {
      console.log("[web-search] hit", { provider: "tavily", sources: tavily.sources.length });
      return tavily;
    }
  } catch (err) {
    console.warn("[web-search] tavily error", { err: String(err) });
  }

  // 2. SerpAPI (fallback)
  try {
    const serp = await serpApiSearch(q, timeoutMs);
    if (serp?.summary) {
      console.log("[web-search] hit", { provider: "serpapi", sources: serp.sources.length });
      return serp;
    }
  } catch (err) {
    console.warn("[web-search] serpapi error", { err: String(err) });
  }

  // 3. DuckDuckGo (last resort)
  try {
    const ddg = await duckDuckGoSearch(q, timeoutMs);
    if (ddg?.summary) {
      console.log("[web-search] hit", { provider: "duckduckgo", sources: ddg.sources.length });
      return ddg;
    }
  } catch (err) {
    console.warn("[web-search] duckduckgo error", { err: String(err) });
  }

  console.warn("[web-search] all providers failed", { query: q });
  return null;
}
