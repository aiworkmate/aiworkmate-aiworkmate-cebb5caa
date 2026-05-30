import { nowISO, sanitizeText, uid } from '../lib/utils.mjs';

const VECTOR_SIZE = 384;
const stopWords = new Set('a an and are as at be by for from has have i in is it my of on or our that the this to was we with you your'.split(' '));

function hashToken(token) {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % VECTOR_SIZE;
}

export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 2 && !stopWords.has(item));
}

export function embedText(text) {
  const vector = new Array(VECTOR_SIZE).fill(0);
  for (const token of tokenize(text)) {
    vector[hashToken(token)] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

export function cosine(a, b) {
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? dot / (Math.sqrt(aa) * Math.sqrt(bb)) : 0;
}

export async function saveMemory(store, userId, content, metadata = {}) {
  const text = sanitizeText(content, 4000);
  if (!text) return null;
  const memory = {
    id: uid('mem'),
    userId,
    content: text,
    kind: metadata.kind || 'semantic',
    tags: metadata.tags || [],
    source: metadata.source || 'chat',
    importance: metadata.importance || 0.5,
    embedding: embedText(text),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    archived: false
  };
  await store.update((db) => {
    db.memories.push(memory);
  });
  return memory;
}

export function searchMemories(db, userId, query, limit = 6) {
  const queryVector = embedText(query);
  return db.memories
    .filter((item) => item.userId === userId && !item.archived)
    .map((item) => ({ ...item, score: cosine(queryVector, item.embedding || []) }))
    .filter((item) => item.score > 0.08)
    .sort((a, b) => b.score - a.score || b.importance - a.importance)
    .slice(0, limit);
}

export function extractMemoryCandidates(text, mode = 'general') {
  const input = sanitizeText(text, 4000);
  const candidates = [];
  const patterns = [
    { re: /\bremember(?: that)? ([^.?!]{8,180})/gi, kind: 'explicit' },
    { re: /\bmy name is ([a-z][a-z\s'-]{1,80})/gi, kind: 'profile' },
    { re: /\bi prefer ([^.?!]{4,160})/gi, kind: 'preference' },
    { re: /\bi like ([^.?!]{4,160})/gi, kind: 'preference' },
    { re: /\bi am working on ([^.?!]{6,180})/gi, kind: 'project' },
    { re: /\bmy goal is ([^.?!]{6,180})/gi, kind: 'goal' }
  ];
  for (const { re, kind } of patterns) {
    for (const match of input.matchAll(re)) {
      candidates.push({
        content: match[1].trim(),
        kind,
        importance: kind === 'explicit' ? 0.95 : 0.7,
        tags: mode === 'medical' ? ['medical-context'] : []
      });
    }
  }
  return candidates.slice(0, 5);
}

export async function absorbMemories(store, userId, text, mode) {
  const saved = [];
  for (const item of extractMemoryCandidates(text, mode)) {
    const existing = store.snapshot().memories.find((memory) => {
      return memory.userId === userId && memory.content.toLowerCase() === item.content.toLowerCase() && !memory.archived;
    });
    if (!existing) {
      saved.push(await saveMemory(store, userId, item.content, item));
    }
  }
  return saved.filter(Boolean);
}
