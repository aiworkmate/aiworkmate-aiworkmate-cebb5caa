import crypto from 'node:crypto';

export function nowISO() {
  return new Date().toISOString();
}

export function uid(prefix = 'id') {
  return `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function clampText(value, max = 12_000) {
  const text = typeof value === 'string' ? value : '';
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function sanitizeText(value, max = 12_000) {
  return clampText(String(value ?? '').replace(/\u0000/g, '').trim(), max);
}

export function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function readBody(req, maxBytes = 1_000_000) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('Request body is too large.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function readJson(req, maxBytes) {
  const raw = await readBody(req, maxBytes);
  if (!raw) return {};
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const error = new Error('Expected a JSON object.');
    error.status = 400;
    throw error;
  }
  return parsed;
}

export function json(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers
  });
  res.end(payload);
}

export function sseStart(res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no'
  });
}

export function sseEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function splitForStreaming(text, size = 28) {
  const parts = [];
  let current = '';
  for (const token of String(text).split(/(\s+)/)) {
    if ((current + token).length > size && current) {
      parts.push(current);
      current = token;
    } else {
      current += token;
    }
  }
  if (current) parts.push(current);
  return parts;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function originFromReq(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  return `${proto}://${host}`;
}

export function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}
