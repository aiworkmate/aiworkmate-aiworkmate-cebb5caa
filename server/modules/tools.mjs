import { config } from '../config.mjs';
import { sanitizeText } from '../lib/utils.mjs';
import { isMedicalQuery } from './medical.mjs';
import { needsLiveData, fetchWithTimeout } from '../lib/patterns.mjs';

function extractLocation(text) {
  const match = text.match(/\b(?:in|near|around|for)\s+([a-zA-Z][a-zA-Z\s,.-]{2,80})/i);
  return match ? match[1].replace(/[?.!]+$/, '').trim() : '';
}

function mathExpression(text) {
  const match = text.match(/(?:calculate|compute|what is|solve)\s+([0-9+\-*/().\s%^]{3,120})/i);
  return match ? match[1].replace(/\^/g, '**') : '';
}

export function planTools({ message, mode = 'general', enableLive = true }) {
  const text = sanitizeText(message, 2000);
  const plan = [];
  const expression = mathExpression(text);
  if (expression) plan.push({ name: 'calculator', input: { expression } });

  if (enableLive && /\b(weather|forecast|temperature|rain|snow|humidity)\b/i.test(text)) {
    plan.push({ name: 'weather', input: { location: extractLocation(text) || 'New York' } });
  }

  if (enableLive && /\b(news|latest|recent|today|current|event|business hours|open now|near me|price|product|travel|map|location)\b/i.test(text)) {
    plan.push({ name: 'web_search', input: { query: text } });
  }

  if (enableLive && /\b(news|headline|breaking)\b/i.test(text)) {
    plan.push({ name: 'news', input: { query: text } });
  }

  if (enableLive && (mode === 'medical' || isMedicalQuery(text) || /\b(pubmed|clinical trial|medical research|radiology research)\b/i.test(text))) {
    plan.push({ name: 'medical_research', input: { query: text } });
  }

  if (enableLive && needsLiveData(String(text)) && !plan.some((item) => item.name === 'web_search')) {
    plan.push({ name: 'web_search', input: { query: text } });
  }

  return plan.slice(0, 5);
}

export async function runToolPlan(plan) {
  const started = Date.now();
  const results = await Promise.all(plan.map(async (item) => {
    try {
      const result = await runTool(item.name, item.input || {});
      return { name: item.name, ok: true, latencyMs: Date.now() - started, result };
    } catch (error) {
      return { name: item.name, ok: false, latencyMs: Date.now() - started, error: error.message };
    }
  }));
  return results;
}

export async function runTool(name, input) {
  if (name === 'calculator') return calculator(input.expression);
  if (name === 'weather') return weather(input.location);
  if (name === 'web_search') return webSearch(input.query);
  if (name === 'news') return news(input.query);
  if (name === 'medical_research') return medicalResearch(input.query);
  throw new Error(`Unknown tool: ${name}`);
}

function calculator(expression) {
  const safe = String(expression || '').trim();
  if (!/^[0-9+\-*/().\s%*]+$/.test(safe)) throw new Error('Unsafe calculation expression.');
  const value = Function(`"use strict"; return (${safe});`)();
  if (!Number.isFinite(value)) throw new Error('Calculation did not produce a finite number.');
  return { expression: safe, value };
}

const fetchJson = fetchWithTimeout;

async function weather(location) {
  const query = encodeURIComponent(sanitizeText(location, 100) || 'New York');
  const geo = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=1&language=en&format=json`);
  const place = geo.results?.[0];
  if (!place) throw new Error('Location was not found.');
  const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`);
  return {
    location: `${place.name}, ${place.admin1 || place.country || ''}`.replace(/,\s*$/, ''),
    current: data.current,
    daily: data.daily
  };
}

async function webSearch(query) {
  const q = sanitizeText(query, 500);
  if (config.tools.tavilyApiKey) {
    const data = await fetchJson('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: config.tools.tavilyApiKey, query: q, search_depth: 'advanced', max_results: 6 })
    });
    return { provider: 'tavily', items: (data.results || []).map((item) => ({ title: item.title, url: item.url, snippet: item.content })) };
  }
  if (config.tools.braveSearchApiKey) {
    const data = await fetchJson(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=6`, {
      headers: { accept: 'application/json', 'x-subscription-token': config.tools.braveSearchApiKey }
    });
    return { provider: 'brave', items: (data.web?.results || []).map((item) => ({ title: item.title, url: item.url, snippet: item.description })) };
  }
  const data = await fetchJson(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=6&namespace=0&format=json&origin=*`);
  const titles = data[1] || [];
  const snippets = data[2] || [];
  const urls = data[3] || [];
  return {
    provider: 'wikipedia-opensearch',
    items: titles.map((title, index) => ({ title, snippet: snippets[index], url: urls[index] }))
  };
}

async function news(query) {
  const q = sanitizeText(query, 300).replace(/\b(news|headlines|latest|breaking)\b/gi, '').trim() || 'technology';
  if (config.tools.newsApiKey) {
    const data = await fetchJson(`https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&pageSize=6`, {
      headers: { 'x-api-key': config.tools.newsApiKey }
    });
    return { provider: 'newsapi', items: (data.articles || []).map((item) => ({ title: item.title, url: item.url, source: item.source?.name, publishedAt: item.publishedAt, snippet: item.description })) };
  }
  const data = await fetchJson(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&format=json&maxrecords=6&sort=hybridrel`);
  return { provider: 'gdelt', items: (data.articles || []).map((item) => ({ title: item.title, url: item.url, source: item.sourcecountry, publishedAt: item.seendate, snippet: item.domain })) };
}

async function medicalResearch(query) {
  const q = sanitizeText(query, 500) || 'radiology artificial intelligence';
  const search = await fetchJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=6&term=${encodeURIComponent(q)}`);
  const ids = search.esearchresult?.idlist || [];
  if (!ids.length) return { provider: 'pubmed', items: [] };
  const summary = await fetchJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`);
  const items = ids.map((id) => summary.result?.[id]).filter(Boolean).map((item) => ({
    title: item.title,
    source: item.source,
    publishedAt: item.pubdate,
    url: `https://pubmed.ncbi.nlm.nih.gov/${item.uid}/`,
    snippet: (item.authors || []).slice(0, 3).map((author) => author.name).join(', ')
  }));
  return { provider: 'pubmed', items };
}
