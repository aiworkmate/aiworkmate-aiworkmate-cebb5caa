import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import {
  nowISO,
  uid,
  sha256,
  clampText,
  sanitizeText,
  safeJsonParse,
  readBody,
  readJson,
  splitForStreaming,
  sleep,
  originFromReq,
  compactObject
} from '../server/lib/utils.mjs';

test('nowISO returns a valid ISO date string', () => {
  const result = nowISO();
  assert.ok(result);
  assert.ok(!Number.isNaN(Date.parse(result)));
});

test('uid returns prefixed random string', () => {
  const a = uid('test');
  const b = uid('test');
  assert.ok(a.startsWith('test_'));
  assert.equal(a.length, 'test_'.length + 32);
  assert.notEqual(a, b);
});

test('uid uses default prefix', () => {
  assert.ok(uid().startsWith('id_'));
});

test('sha256 returns hex hash', () => {
  const hash = sha256('hello');
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(sha256('hello'), sha256('hello'));
  assert.notEqual(sha256('hello'), sha256('world'));
});

test('sha256 coerces non-string to string', () => {
  assert.equal(sha256(123), sha256('123'));
});

test('clampText truncates long text', () => {
  assert.equal(clampText('short'), 'short');
  assert.equal(clampText('abcde', 3), 'abc...');
  assert.equal(clampText('abc', 3), 'abc');
});

test('clampText handles non-string input', () => {
  assert.equal(clampText(null), '');
  assert.equal(clampText(undefined), '');
  assert.equal(clampText(42), '');
});

test('sanitizeText trims, strips nulls, and clamps', () => {
  assert.equal(sanitizeText('  hello\u0000world  '), 'helloworld');
  assert.equal(sanitizeText(null), '');
  assert.equal(sanitizeText(undefined), '');
});

test('sanitizeText respects max length', () => {
  const result = sanitizeText('abcdefghij', 5);
  assert.equal(result, 'abcde...');
});

test('safeJsonParse returns parsed object', () => {
  assert.deepEqual(safeJsonParse('{"a":1}'), { a: 1 });
});

test('safeJsonParse returns fallback on bad JSON', () => {
  assert.equal(safeJsonParse('not json'), null);
  assert.equal(safeJsonParse('not json', 'default'), 'default');
});

test('readBody collects stream chunks', async () => {
  const stream = Readable.from([Buffer.from('hello'), Buffer.from(' world')]);
  const body = await readBody(stream);
  assert.equal(body, 'hello world');
});

test('readBody throws when body exceeds maxBytes', async () => {
  const stream = Readable.from([Buffer.from('x'.repeat(100))]);
  await assert.rejects(() => readBody(stream, 10), (err) => {
    assert.equal(err.status, 413);
    return true;
  });
});

test('readJson parses valid JSON object', async () => {
  const stream = Readable.from([Buffer.from('{"key":"value"}')]);
  const result = await readJson(stream);
  assert.deepEqual(result, { key: 'value' });
});

test('readJson returns empty object for empty body', async () => {
  const stream = Readable.from([]);
  const result = await readJson(stream);
  assert.deepEqual(result, {});
});

test('readJson rejects arrays', async () => {
  const stream = Readable.from([Buffer.from('[1,2]')]);
  await assert.rejects(() => readJson(stream), (err) => {
    assert.equal(err.status, 400);
    return true;
  });
});

test('readJson rejects non-object values', async () => {
  const stream = Readable.from([Buffer.from('"string"')]);
  await assert.rejects(() => readJson(stream), (err) => {
    assert.equal(err.status, 400);
    return true;
  });
});

test('splitForStreaming splits text into parts', () => {
  const parts = splitForStreaming('hello world foo bar baz', 10);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p) => p.length <= 12));
});

test('splitForStreaming handles empty string', () => {
  assert.deepEqual(splitForStreaming(''), []);
});

test('splitForStreaming returns single part for short text', () => {
  const parts = splitForStreaming('hi', 28);
  assert.deepEqual(parts, ['hi']);
});

test('sleep resolves after delay', async () => {
  const start = Date.now();
  await sleep(20);
  assert.ok(Date.now() - start >= 15);
});

test('originFromReq constructs origin from forwarded headers', () => {
  const req = { headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'example.com' } };
  assert.equal(originFromReq(req), 'https://example.com');
});

test('originFromReq falls back to host header', () => {
  const req = { headers: { host: 'localhost:8787' } };
  assert.equal(originFromReq(req), 'http://localhost:8787');
});

test('originFromReq handles missing headers', () => {
  const req = { headers: {} };
  assert.equal(originFromReq(req), 'http://');
});

test('compactObject removes null, undefined, and empty strings', () => {
  assert.deepEqual(
    compactObject({ a: 1, b: null, c: undefined, d: '', e: 'ok', f: 0, g: false }),
    { a: 1, e: 'ok', f: 0, g: false }
  );
});
