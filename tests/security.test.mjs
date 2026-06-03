import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseCookies,
  cookie,
  clearCookie,
  clientIp,
  rateLimit,
  hashPassword,
  verifyPassword,
  publicUser,
  requireCsrf,
  hasRole
} from '../server/lib/security.mjs';

test('parseCookies parses a cookie header', () => {
  const result = parseCookies('foo=bar; baz=qux');
  assert.deepEqual(result, { foo: 'bar', baz: 'qux' });
});

test('parseCookies handles empty string', () => {
  assert.deepEqual(parseCookies(''), {});
  assert.deepEqual(parseCookies(), {});
});

test('parseCookies decodes URI-encoded values', () => {
  const result = parseCookies('name=hello%20world');
  assert.equal(result.name, 'hello world');
});

test('parseCookies skips entries without =', () => {
  const result = parseCookies('foo=bar; invalid; baz=qux');
  assert.deepEqual(result, { foo: 'bar', baz: 'qux' });
});

test('cookie builds a cookie string with defaults', () => {
  const result = cookie('name', 'value');
  assert.ok(result.startsWith('name=value'));
  assert.ok(result.includes('Path=/'));
  assert.ok(result.includes('HttpOnly'));
});

test('cookie respects maxAge option', () => {
  const result = cookie('name', 'value', { maxAge: 3600 });
  assert.ok(result.includes('Max-Age=3600'));
});

test('cookie respects expires option', () => {
  const date = new Date('2025-01-01T00:00:00Z');
  const result = cookie('name', 'value', { expires: date });
  assert.ok(result.includes('Expires='));
});

test('cookie respects sameSite and secure', () => {
  const result = cookie('name', 'value', { sameSite: 'Strict', secure: true });
  assert.ok(result.includes('SameSite=Strict'));
  assert.ok(result.includes('Secure'));
});

test('cookie omits HttpOnly when httpOnly is false', () => {
  const result = cookie('name', 'value', { httpOnly: false });
  assert.ok(!result.includes('HttpOnly'));
});

test('cookie encodes value', () => {
  const result = cookie('name', 'hello world');
  assert.ok(result.includes('name=hello%20world'));
});

test('clearCookie returns an expired cookie', () => {
  const result = clearCookie('session');
  assert.ok(result.includes('session='));
  assert.ok(result.includes('Max-Age=0'));
});

test('clientIp extracts IP from x-forwarded-for', () => {
  const req = { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, socket: {} };
  assert.equal(clientIp(req), '1.2.3.4');
});

test('clientIp falls back to socket remoteAddress', () => {
  const req = { headers: {}, socket: { remoteAddress: '127.0.0.1' } };
  assert.equal(clientIp(req), '127.0.0.1');
});

test('clientIp returns local when nothing is available', () => {
  const req = { headers: {}, socket: {} };
  assert.equal(clientIp(req), 'local');
});

test('rateLimit allows requests within window', () => {
  const req = { headers: { 'x-forwarded-for': '10.0.0.1' }, socket: {} };
  const result = rateLimit(req, 'test-allow');
  assert.ok(result.ok);
  assert.ok(result.remaining >= 0);
  assert.ok(result.resetMs > 0);
});

test('hashPassword and verifyPassword round-trip', async () => {
  const hashed = await hashPassword('my-secret-password');
  assert.ok(hashed.startsWith('pbkdf2$'));
  assert.ok(await verifyPassword('my-secret-password', hashed));
  assert.ok(!(await verifyPassword('wrong-password', hashed)));
});

test('verifyPassword rejects malformed stored hash', async () => {
  assert.ok(!(await verifyPassword('password', 'garbage')));
  assert.ok(!(await verifyPassword('password', 'notpbkdf2$210000$salt$hash')));
});

test('publicUser strips sensitive fields', () => {
  const user = {
    id: 'u1',
    name: 'Ada',
    email: 'ada@example.com',
    role: 'admin',
    settings: { theme: 'dark' },
    createdAt: '2025-01-01',
    passwordHash: 'secret',
    internalField: 'hidden'
  };
  const result = publicUser(user);
  assert.deepEqual(result, {
    id: 'u1',
    name: 'Ada',
    email: 'ada@example.com',
    role: 'admin',
    settings: { theme: 'dark' },
    createdAt: '2025-01-01'
  });
  assert.equal(result.passwordHash, undefined);
});

test('publicUser returns null for falsy input', () => {
  assert.equal(publicUser(null), null);
  assert.equal(publicUser(undefined), null);
});

test('publicUser defaults settings to empty object', () => {
  const result = publicUser({ id: 'u1', name: 'A', email: 'a@b.c', role: 'user', createdAt: 'now' });
  assert.deepEqual(result.settings, {});
});

test('requireCsrf passes for GET/HEAD/OPTIONS', () => {
  assert.ok(requireCsrf({ method: 'GET', headers: {} }, null));
  assert.ok(requireCsrf({ method: 'HEAD', headers: {} }, null));
  assert.ok(requireCsrf({ method: 'OPTIONS', headers: {} }, null));
});

test('requireCsrf requires matching token for POST', () => {
  const session = { csrfToken: 'tok_123' };
  assert.ok(requireCsrf({ method: 'POST', headers: { 'x-csrf-token': 'tok_123' } }, session));
  assert.ok(!requireCsrf({ method: 'POST', headers: { 'x-csrf-token': 'wrong' } }, session));
  assert.ok(!requireCsrf({ method: 'POST', headers: {} }, session));
});

test('requireCsrf fails when no session', () => {
  assert.ok(!requireCsrf({ method: 'POST', headers: { 'x-csrf-token': 'tok' } }, null));
});

test('hasRole returns true when no roles required', () => {
  assert.ok(hasRole(null, []));
  assert.ok(hasRole(null, null));
});

test('hasRole returns false when user is missing', () => {
  assert.ok(!hasRole(null, ['admin']));
  assert.ok(!hasRole(undefined, ['admin']));
});

test('hasRole admin has all roles', () => {
  assert.ok(hasRole({ role: 'admin' }, ['editor', 'viewer']));
});

test('hasRole checks specific role', () => {
  assert.ok(hasRole({ role: 'editor' }, ['editor', 'viewer']));
  assert.ok(!hasRole({ role: 'viewer' }, ['editor']));
});
