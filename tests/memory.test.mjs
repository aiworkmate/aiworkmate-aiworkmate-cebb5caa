import assert from 'node:assert/strict';
import test from 'node:test';

import {
  tokenize,
  embedText,
  cosine,
  searchMemories,
  extractMemoryCandidates
} from '../server/modules/memory.mjs';

test('tokenize splits and lowercases text', () => {
  const tokens = tokenize('Hello World Testing');
  assert.ok(tokens.includes('hello'));
  assert.ok(tokens.includes('world'));
  assert.ok(tokens.includes('testing'));
});

test('tokenize removes short tokens and stop words', () => {
  const tokens = tokenize('I am a big fan of the new system');
  assert.ok(!tokens.includes('i'));
  assert.ok(!tokens.includes('am'));
  assert.ok(!tokens.includes('a'));
  assert.ok(!tokens.includes('of'));
  assert.ok(!tokens.includes('the'));
  assert.ok(tokens.includes('big'));
  assert.ok(tokens.includes('fan'));
  assert.ok(tokens.includes('new'));
  assert.ok(tokens.includes('system'));
});

test('tokenize handles empty/null input', () => {
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize(null), []);
  assert.deepEqual(tokenize(undefined), []);
});

test('tokenize strips non-alphanumeric characters', () => {
  const tokens = tokenize('hello! @world# testing$');
  assert.ok(tokens.includes('hello'));
  assert.ok(tokens.includes('world'));
  assert.ok(tokens.includes('testing'));
});

test('embedText returns normalized vector', () => {
  const vec = embedText('hello world testing');
  assert.equal(vec.length, 384);
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  assert.ok(Math.abs(norm - 1) < 0.001);
});

test('embedText returns zero vector for empty text', () => {
  const vec = embedText('');
  assert.equal(vec.length, 384);
  assert.ok(vec.every((v) => v === 0));
});

test('cosine returns 1 for identical vectors', () => {
  const vec = embedText('hello world');
  const sim = cosine(vec, vec);
  assert.ok(Math.abs(sim - 1) < 0.001);
});

test('cosine returns 0 for orthogonal vectors', () => {
  const a = [1, 0, 0];
  const b = [0, 1, 0];
  assert.equal(cosine(a, b), 0);
});

test('cosine handles zero vectors', () => {
  assert.equal(cosine([0, 0], [0, 0]), 0);
});

test('cosine returns high similarity for related texts', () => {
  const a = embedText('weather forecast temperature');
  const b = embedText('weather temperature today');
  const c = embedText('quantum physics research paper');
  const simAB = cosine(a, b);
  const simAC = cosine(a, c);
  assert.ok(simAB > simAC, 'Related texts should be more similar');
});

test('searchMemories filters by userId and returns ranked results', () => {
  const memories = [
    { userId: 'u1', content: 'I prefer dark mode for coding', archived: false, embedding: embedText('I prefer dark mode for coding'), importance: 0.7 },
    { userId: 'u1', content: 'I like TypeScript projects', archived: false, embedding: embedText('I like TypeScript projects'), importance: 0.6 },
    { userId: 'u2', content: 'I prefer dark mode too', archived: false, embedding: embedText('I prefer dark mode too'), importance: 0.7 },
    { userId: 'u1', content: 'archived memory', archived: true, embedding: embedText('archived memory'), importance: 0.5 }
  ];
  const db = { memories };
  const results = searchMemories(db, 'u1', 'dark mode preference');
  assert.ok(results.length > 0);
  assert.ok(results.every((r) => r.userId === 'u1'));
  assert.ok(results.every((r) => !r.archived));
  assert.ok(results.every((r) => r.score > 0.08));
});

test('searchMemories respects limit', () => {
  const memories = Array.from({ length: 20 }, (_, i) => ({
    userId: 'u1',
    content: `memory about coding project number ${i}`,
    archived: false,
    embedding: embedText(`memory about coding project number ${i}`),
    importance: 0.5
  }));
  const db = { memories };
  const results = searchMemories(db, 'u1', 'coding project', 3);
  assert.ok(results.length <= 3);
});

test('searchMemories returns empty for non-matching user', () => {
  const db = { memories: [{ userId: 'u1', content: 'test', archived: false, embedding: embedText('test'), importance: 0.5 }] };
  const results = searchMemories(db, 'u999', 'test');
  assert.equal(results.length, 0);
});

test('extractMemoryCandidates finds explicit remember statements', () => {
  const candidates = extractMemoryCandidates('Remember that I always use vim for editing.');
  assert.ok(candidates.length > 0);
  assert.ok(candidates.some((c) => c.kind === 'explicit'));
});

test('extractMemoryCandidates finds preference patterns', () => {
  const candidates = extractMemoryCandidates('I prefer dark mode for all applications.');
  assert.ok(candidates.length > 0);
  assert.ok(candidates.some((c) => c.kind === 'preference'));
});

test('extractMemoryCandidates finds name patterns', () => {
  const candidates = extractMemoryCandidates('My name is Alice Johnson.');
  assert.ok(candidates.length > 0);
  assert.ok(candidates.some((c) => c.kind === 'profile'));
});

test('extractMemoryCandidates finds project patterns', () => {
  const candidates = extractMemoryCandidates('I am working on a machine learning pipeline.');
  assert.ok(candidates.length > 0);
  assert.ok(candidates.some((c) => c.kind === 'project'));
});

test('extractMemoryCandidates finds goal patterns', () => {
  const candidates = extractMemoryCandidates('My goal is to finish the API refactor by Friday.');
  assert.ok(candidates.length > 0);
  assert.ok(candidates.some((c) => c.kind === 'goal'));
});

test('extractMemoryCandidates adds medical tags in medical mode', () => {
  const candidates = extractMemoryCandidates('I prefer concise summaries.', 'medical');
  if (candidates.length > 0) {
    assert.ok(candidates[0].tags.includes('medical-context'));
  }
});

test('extractMemoryCandidates limits to 5 results', () => {
  const text = 'I prefer A. I prefer B. I prefer C. I prefer D. I prefer E. I prefer F. I like G things. I like H things.';
  const candidates = extractMemoryCandidates(text);
  assert.ok(candidates.length <= 5);
});

test('extractMemoryCandidates returns empty for no patterns', () => {
  assert.deepEqual(extractMemoryCandidates('Hello, how are you?'), []);
});
