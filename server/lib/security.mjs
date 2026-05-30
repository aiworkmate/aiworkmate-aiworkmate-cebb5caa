import crypto from 'node:crypto';
import { config } from '../config.mjs';
import { nowISO, uid } from './utils.mjs';

const limits = new Map();

export function securityHeaders(req, res) {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join('; ');

  res.setHeader('content-security-policy', csp);
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('permissions-policy', 'camera=(), geolocation=(), microphone=(self)');
  res.setHeader('cross-origin-opener-policy', 'same-origin');
  res.setHeader('cross-origin-resource-policy', 'same-origin');
  if ((req.headers['x-forwarded-proto'] || '').includes('https')) {
    res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
  }
}

export function parseCookies(header = '') {
  const out = {};
  for (const item of String(header).split(';')) {
    const idx = item.indexOf('=');
    if (idx === -1) continue;
    const key = item.slice(0, idx).trim();
    const value = item.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function cookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearCookie(name) {
  return cookie(name, '', { maxAge: 0, expires: new Date(0), sameSite: 'Lax' });
}

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local').split(',')[0].trim();
}

export function rateLimit(req, keySuffix = 'global') {
  const key = `${clientIp(req)}:${keySuffix}`;
  const now = Date.now();
  const windowStart = now - config.rateLimitWindowMs;
  const recent = (limits.get(key) || []).filter((stamp) => stamp > windowStart);
  recent.push(now);
  limits.set(key, recent);
  return {
    ok: recent.length <= config.rateLimitMax,
    remaining: Math.max(0, config.rateLimitMax - recent.length),
    resetMs: config.rateLimitWindowMs
  };
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await new Promise((resolve, reject) => {
    crypto.pbkdf2(String(password), salt, 210_000, 32, 'sha512', (error, key) => {
      if (error) reject(error);
      else resolve(key.toString('hex'));
    });
  });
  return `pbkdf2$210000$${salt}$${hash}`;
}

export async function verifyPassword(password, stored) {
  const [kind, roundsRaw, salt, expected] = String(stored).split('$');
  if (kind !== 'pbkdf2' || !salt || !expected) return false;
  const rounds = Number(roundsRaw);
  const actual = await new Promise((resolve, reject) => {
    crypto.pbkdf2(String(password), salt, rounds, 32, 'sha512', (error, key) => {
      if (error) reject(error);
      else resolve(key.toString('hex'));
    });
  });
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    settings: user.settings || {},
    createdAt: user.createdAt
  };
}

export async function createSession(store, user, req) {
  const session = {
    id: uid('sess'),
    userId: user.id,
    csrfToken: uid('csrf'),
    createdAt: nowISO(),
    expiresAt: new Date(Date.now() + config.sessionTtlMs).toISOString(),
    ipHash: crypto.createHash('sha256').update(clientIp(req)).digest('hex'),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 240)
  };
  await store.update((db) => {
    db.sessions = db.sessions.filter((item) => item.userId !== user.id || new Date(item.expiresAt).getTime() > Date.now());
    db.sessions.push(session);
  });
  return session;
}

export async function getSession(store, req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionId = cookies[config.sessionCookie];
  if (!sessionId) return { session: null, user: null };
  const db = store.snapshot();
  const session = db.sessions.find((item) => item.id === sessionId);
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return { session: null, user: null };
  const user = db.users.find((item) => item.id === session.userId && item.status !== 'disabled');
  return { session, user };
}

export function requireCsrf(req, session) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  const header = String(req.headers['x-csrf-token'] || '');
  return Boolean(session?.csrfToken && header && header === session.csrfToken);
}

export function hasRole(user, roles) {
  if (!roles || roles.length === 0) return true;
  if (!user) return false;
  if (user.role === 'admin') return true;
  return roles.includes(user.role);
}
