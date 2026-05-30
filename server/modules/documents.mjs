import path from 'node:path';
import { clampText, sanitizeText } from '../lib/utils.mjs';

const textExtensions = new Set(['.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm', '.log', '.yaml', '.yml']);

export function isTextLike(name = '', mime = '') {
  const ext = path.extname(name).toLowerCase();
  return textExtensions.has(ext) || String(mime).startsWith('text/') || ['application/json', 'application/xml'].includes(mime);
}

export function extractText(buffer, name = '', mime = '') {
  const ext = path.extname(name).toLowerCase();
  if (isTextLike(name, mime)) {
    return clampText(buffer.toString('utf8').replace(/\r/g, ''), 40_000);
  }
  if (ext === '.pdf' || mime === 'application/pdf') {
    return extractPdfStrings(buffer);
  }
  return '';
}

export function summarizeDocument(text, name = 'document') {
  const clean = sanitizeText(text, 40_000);
  if (!clean) return `Stored ${name}. Text extraction was not available for this file type.`;
  const words = clean.split(/\s+/).filter(Boolean).length;
  const lines = clean.split(/\n+/).filter((line) => line.trim()).length;
  const first = clean.split(/[.!?]\s/).find((line) => line.trim().length > 40) || clean.slice(0, 260);
  return `Extracted ${words} words across ${lines} text blocks. Opening content: ${first.slice(0, 320)}`;
}

function extractPdfStrings(buffer) {
  const latin = buffer.toString('latin1');
  const matches = [];
  const regex = /\(([^()]{4,500})\)/g;
  for (const match of latin.matchAll(regex)) {
    const value = match[1]
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, ' ')
      .replace(/\\([()\\])/g, '$1')
      .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (value.length > 3 && /[a-zA-Z]/.test(value)) matches.push(value);
  }
  return clampText(matches.join('\n'), 40_000);
}

export function documentFacts(upload) {
  const facts = [];
  if (upload.extractedText) {
    facts.push(`File ${upload.name} has extracted text available for retrieval.`);
    facts.push(upload.summary);
  } else {
    facts.push(`File ${upload.name} was stored as ${upload.mime || 'unknown type'} with no local text layer.`);
  }
  return facts;
}
