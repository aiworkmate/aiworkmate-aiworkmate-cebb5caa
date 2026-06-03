import { sanitizeText } from './utils.mjs';

/**
 * Shared regex that determines whether a user message needs live/real-time data.
 * Previously duplicated in tools.mjs (needsLiveData) and orchestrator.mjs (routeRequest).
 */
const LIVE_DATA_RE =
  /\b(today|now|current|latest|recent|live|near me|hours|open|weather|forecast|news|price|stock|event|travel|map|location|research|pubmed|clinical trial|business|restaurant|flight)\b/i;

export function needsLiveData(text) {
  return LIVE_DATA_RE.test(text);
}

/**
 * Derive a short conversation title from user text.
 * Previously duplicated in orchestrator.mjs (titleFrom) and public/app.js (titleFromMessage).
 */
export function titleFromText(text, { sanitize = false, maxScan = 80, maxLen = 58 } = {}) {
  const clean = sanitize ? sanitizeText(text, maxScan) : String(text || '');
  return clean.length > maxLen ? `${clean.slice(0, maxLen)}...` : clean || 'New conversation';
}

/**
 * Fetch JSON with an AbortController timeout.
 * Unifies the duplicated patterns in aiProvider.mjs (providerFetch) and tools.mjs (fetchJson).
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}${text ? `: ${text.slice(0, 300)}` : ''}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Push an item to a store array, capping at maxLength to avoid unbounded growth.
 * Previously duplicated in analytics.mjs for both metrics and audit logs.
 */
export function cappedPush(array, item, maxLength = 5000) {
  array.push(item);
  if (array.length > maxLength) {
    const excess = array.length - maxLength;
    array.splice(0, excess);
  }
}

/**
 * Parse and normalize the request body for chat endpoints.
 * Previously duplicated identically in app.mjs for both chat() and chatStream().
 */
export function parseChatOptions(body) {
  return {
    message: body.message,
    conversationId: body.conversationId,
    mode: body.mode === 'medical' ? 'medical' : 'general',
    uploadIds: Array.isArray(body.uploadIds) ? body.uploadIds : [],
    enableLive: body.enableLive !== false,
    enableMemory: body.enableMemory !== false,
  };
}

/**
 * Build a structured medical-assistive response from sections.
 * Unifies the near-identical templates in medical.mjs (localMedicalResponse)
 * and aiProvider.mjs (localMedicalFinalAnswer).
 */
export function buildMedicalTemplate({
  title = 'Medical assistive summary',
  observations = '- No clinical file was attached.',
  interpretation = '',
  uncertainty = 'Clinical conclusions require qualified review, complete history, original source data, and comparison with prior studies when relevant.',
  references = 'No external medical reference was available in this response.',
  clinicianSteps = [
    'Confirm identifiers, study date, clinical question, source quality, urgent findings, and recommended follow-up before using this in care.'
  ],
}) {
  return [
    title,
    '',
    'Observations',
    observations,
    '',
    'Interpretation',
    interpretation,
    '',
    'Uncertainty',
    uncertainty,
    '',
    references.startsWith('Reference') ? '' : 'Relevant references',
    references,
    '',
    'Clinician review',
    ...(Array.isArray(clinicianSteps) ? clinicianSteps.map((s) => `- ${s}`) : [clinicianSteps]),
  ].filter((line) => line !== '').join('\n');
}

/**
 * Format a byte count into a human-readable string.
 * Previously duplicated in public/app.js (formatBytes) and packages/gpt-module uploads.tsx (fmtBytes).
 */
export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
