// Live data fetch — DuckDuckGo Instant Answer (no API key required).
// Returns a small, plain-text context block to inject into the LLM prompt.
// Graceful by design: any failure returns null, never throws.

export interface WebSearchResult {
  query: string;
  summary: string;
  sources: string[];
}

export async function webSearch(query: string, timeoutMs = 5000): Promise<WebSearchResult | null> {
  const q = query.trim().slice(0, 300);
  if (!q) return null;
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "AIWorkMate/1.0" } });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json() as {
      AbstractText?: string;
      AbstractURL?: string;
      Heading?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
      Answer?: string;
    };

    const bits: string[] = [];
    const sources: string[] = [];
    if (data.Answer) bits.push(data.Answer);
    if (data.AbstractText) bits.push(data.AbstractText);
    if (data.AbstractURL) sources.push(data.AbstractURL);

    const flatTopics: Array<{ Text?: string; FirstURL?: string }> = [];
    for (const t of data.RelatedTopics ?? []) {
      if (t.Text) flatTopics.push(t);
      if (t.Topics) flatTopics.push(...t.Topics);
    }
    for (const t of flatTopics.slice(0, 4)) {
      if (t.Text) bits.push(`• ${t.Text}`);
      if (t.FirstURL) sources.push(t.FirstURL);
    }

    const summary = bits.join("\n").trim();
    if (!summary) return null;
    return { query: q, summary: summary.slice(0, 2000), sources: sources.slice(0, 5) };
  } catch {
    return null;
  }
}
