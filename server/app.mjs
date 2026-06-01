import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config, publicConfig } from './config.mjs';
import { createStore } from './lib/storage.mjs';
import { audit, summarizeAnalytics } from './modules/analytics.mjs';
import { createUpload, publicUpload, uploadsForUser } from './modules/uploads.mjs';
import { clearCookie, cookie, createSession, getSession, hasRole, hashPassword, parseCookies, publicUser, rateLimit, requireCsrf, securityHeaders, verifyPassword } from './lib/security.mjs';
import { json, nowISO, readJson, sanitizeText, splitForStreaming, sseEvent, sseStart, sleep, uid } from './lib/utils.mjs';
import { orchestrateChat } from './modules/orchestrator.mjs';
import { saveMemory, searchMemories } from './modules/memory.mjs';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

export async function createApp() {
  const store = await createStore();

  async function handler(req, res) {
    securityHeaders(req, res);
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      const limit = rateLimit(req, url.pathname.startsWith('/api/chat') ? 'chat' : 'api');
      if (!limit.ok) return json(res, 429, { error: 'Rate limit exceeded. Please wait and try again.' });
      if (url.pathname.startsWith('/api/')) {
        return await api(req, res, url, store);
      }
      return await staticFile(req, res, url);
    } catch (error) {
      const status = error.status || 500;
      return json(res, status, { error: status === 500 ? 'Internal server error.' : error.message });
    }
  }

  return { server: http.createServer(handler), store, handler };
}

async function api(req, res, url, store) {
  const { session, user } = await getSession(store, req);
  const publicPaths = new Set(['/api/health', '/api/session', '/api/auth/register', '/api/auth/login']);
  if (!publicPaths.has(url.pathname)) {
    if (!user) return json(res, 401, { error: 'Authentication required.' });
    if (!requireCsrf(req, session)) return json(res, 403, { error: 'Invalid CSRF token.' });
  }

  if (url.pathname === '/api/health') return json(res, 200, { ok: true, at: nowISO(), service: 'ai-workmate' });
  if (url.pathname === '/api/session' && req.method === 'GET') {
    return json(res, 200, {
      user: publicUser(user),
      csrfToken: session?.csrfToken || null,
      config: publicConfig()
    });
  }
  if (url.pathname === '/api/auth/register' && req.method === 'POST') return register(req, res, store);
  if (url.pathname === '/api/auth/login' && req.method === 'POST') return login(req, res, store);
  if (url.pathname === '/api/auth/logout' && req.method === 'POST') return logout(req, res, store, user);

  if (url.pathname === '/api/chat' && req.method === 'POST') return chat(req, res, store, user);
  if (url.pathname === '/api/chat/stream' && req.method === 'POST') return chatStream(req, res, store, user);
  if (url.pathname === '/api/conversations' && req.method === 'GET') return conversations(res, store, user);
  if (url.pathname === '/api/conversations' && req.method === 'POST') return conversationCreate(req, res, store, user);
  if (url.pathname.startsWith('/api/conversations/') && req.method === 'GET') return conversationDetail(res, store, user, url.pathname.split('/').pop());
  if (url.pathname === '/api/uploads' && req.method === 'GET') return json(res, 200, { uploads: uploadsForUser(store.snapshot(), user.id) });
  if (url.pathname === '/api/uploads' && req.method === 'POST') return upload(req, res, store, user);
  if (url.pathname === '/api/memory' && req.method === 'GET') return memoryList(res, store, user, url);
  if (url.pathname === '/api/memory' && req.method === 'POST') return memoryCreate(req, res, store, user);
  if (url.pathname === '/api/account' && req.method === 'PUT') return accountUpdate(req, res, store, user);
  if (url.pathname === '/api/admin/metrics' && req.method === 'GET') return adminMetrics(res, store, user);
  if (url.pathname === '/api/admin/audit' && req.method === 'GET') return adminAudit(res, store, user);

  return json(res, 404, { error: 'API route not found.' });
}

async function register(req, res, store) {
  if (!config.enableRegistration) return json(res, 403, { error: 'Registration is disabled.' });
  const body = await readJson(req, 64_000);
  const email = sanitizeText(body.email, 180).toLowerCase();
  const name = sanitizeText(body.name, 100) || email.split('@')[0];
  const password = String(body.password || '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { error: 'A valid email is required.' });
  if (password.length < 8) return json(res, 400, { error: 'Password must be at least 8 characters.' });
  const existing = store.snapshot().users.find((item) => item.email === email);
  if (existing) return json(res, 409, { error: 'An account already exists for this email.' });
  const user = {
    id: uid('usr'),
    name,
    email,
    role: store.snapshot().users.length === 0 ? 'admin' : 'user',
    status: 'active',
    passwordHash: await hashPassword(password),
    settings: { theme: 'system', defaultMode: 'general', liveData: true, memory: true },
    createdAt: nowISO(),
    updatedAt: nowISO()
  };
  await store.update((db) => db.users.push(user));
  const session = await createSession(store, user, req);
  await audit(store, { actorId: user.id, type: 'auth.register', targetId: user.id });
  setSessionCookies(res, session);
  return json(res, 201, { user: publicUser(user), csrfToken: session.csrfToken, config: publicConfig() });
}

async function login(req, res, store) {
  const body = await readJson(req, 64_000);
  const email = sanitizeText(body.email, 180).toLowerCase();
  const password = String(body.password || '');
  const user = store.snapshot().users.find((item) => item.email === email && item.status !== 'disabled');
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await audit(store, { type: 'auth.login_failed', detail: { email } });
    return json(res, 401, { error: 'Invalid email or password.' });
  }
  const session = await createSession(store, user, req);
  await audit(store, { actorId: user.id, type: 'auth.login', targetId: user.id });
  setSessionCookies(res, session);
  return json(res, 200, { user: publicUser(user), csrfToken: session.csrfToken, config: publicConfig() });
}

async function logout(req, res, store, user) {
  const cookies = parseCookies(req.headers.cookie || '');
  await store.update((db) => {
    db.sessions = db.sessions.filter((item) => item.id !== cookies[config.sessionCookie]);
  });
  if (user) await audit(store, { actorId: user.id, type: 'auth.logout', targetId: user.id });
  res.setHeader('set-cookie', [clearCookie(config.sessionCookie), clearCookie(config.csrfCookie)]);
  return json(res, 200, { ok: true });
}

function setSessionCookies(res, session) {
  const secure = config.appOrigin.startsWith('https://');
  res.setHeader('set-cookie', [
    cookie(config.sessionCookie, session.id, { maxAge: Math.floor(config.sessionTtlMs / 1000), sameSite: 'Lax', secure }),
    cookie(config.csrfCookie, session.csrfToken, { maxAge: Math.floor(config.sessionTtlMs / 1000), sameSite: 'Lax', secure, httpOnly: false })
  ]);
}

async function chatStream(req, res, store, user) {
  const body = await readJson(req, config.maxUploadBytes + 64_000);
  sseStart(res);
  try {
    const result = await orchestrateChat(store, {
      user,
      message: body.message,
      conversationId: body.conversationId,
      mode: body.mode === 'medical' ? 'medical' : 'general',
      uploadIds: Array.isArray(body.uploadIds) ? body.uploadIds : [],
      enableLive: body.enableLive !== false,
      enableMemory: body.enableMemory !== false
    });
    sseEvent(res, 'meta', result.meta);
    for (const chunk of splitForStreaming(result.answer)) {
      if (res.destroyed || req.destroyed) break;
      sseEvent(res, 'token', { text: chunk });
      await sleep(8);
    }
    sseEvent(res, 'done', { conversationId: result.conversationId });
  } catch (error) {
    sseEvent(res, 'error', { error: error.message });
  } finally {
    res.end();
  }
}

async function chat(req, res, store, user) {
  const body = await readJson(req, config.maxUploadBytes + 64_000);
  const result = await orchestrateChat(store, {
    user,
    message: body.message,
    conversationId: body.conversationId,
    mode: body.mode === 'medical' ? 'medical' : 'general',
    uploadIds: Array.isArray(body.uploadIds) ? body.uploadIds : [],
    enableLive: body.enableLive !== false,
    enableMemory: body.enableMemory !== false
  });
  return json(res, 200, { response: result.response });
}

async function conversationCreate(req, res, store, user) {
  const body = await readJson(req, 64_000);
  const title = sanitizeText(body.title || 'New conversation', 80) || 'New conversation';
  const mode = body.mode === 'medical' ? 'medical' : 'general';
  let conversation;
  await store.update((db) => {
    conversation = {
      id: uid('conv'),
      userId: user.id,
      title,
      mode,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    db.conversations.push(conversation);
  });
  await audit(store, { actorId: user.id, type: 'conversation.create', targetId: conversation.id, detail: { mode } });
  return json(res, 201, { conversation });
}

function conversations(res, store, user) {
  const db = store.snapshot();
  const items = db.conversations
    .filter((item) => item.userId === user.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((item) => ({ ...item, messageCount: db.messages.filter((msg) => msg.conversationId === item.id).length }));
  return json(res, 200, { conversations: items });
}

function conversationDetail(res, store, user, id) {
  const db = store.snapshot();
  const conversation = db.conversations.find((item) => item.id === id && item.userId === user.id);
  if (!conversation) return json(res, 404, { error: 'Conversation not found.' });
  const messages = db.messages.filter((item) => item.conversationId === id);
  return json(res, 200, { conversation, messages });
}

async function upload(req, res, store, user) {
  const body = await readJson(req, Math.ceil(config.maxUploadBytes * 1.5) + 128_000);
  const item = await createUpload(store, user.id, body);
  await audit(store, { actorId: user.id, type: 'upload.create', targetId: item.id, detail: { name: item.name, mime: item.mime, size: item.size } });
  return json(res, 201, { upload: item });
}

function memoryList(res, store, user, url) {
  const q = url.searchParams.get('q') || '';
  const db = store.snapshot();
  const memories = q
    ? searchMemories(db, user.id, q, 20)
    : db.memories.filter((item) => item.userId === user.id && !item.archived).slice(-50).reverse();
  return json(res, 200, { memories: memories.map(({ embedding, ...item }) => item) });
}

async function memoryCreate(req, res, store, user) {
  const body = await readJson(req, 64_000);
  const memory = await saveMemory(store, user.id, body.content, { kind: body.kind || 'manual', importance: 0.9, tags: Array.isArray(body.tags) ? body.tags : [] });
  await audit(store, { actorId: user.id, type: 'memory.create', targetId: memory.id });
  const { embedding, ...safe } = memory;
  return json(res, 201, { memory: safe });
}

async function accountUpdate(req, res, store, user) {
  const body = await readJson(req, 64_000);
  let updated;
  await store.update((db) => {
    updated = db.users.find((item) => item.id === user.id);
    updated.name = sanitizeText(body.name || updated.name, 100);
    updated.settings = {
      ...updated.settings,
      ...(typeof body.settings === 'object' && body.settings ? body.settings : {})
    };
    updated.updatedAt = nowISO();
  });
  await audit(store, { actorId: user.id, type: 'account.update', targetId: user.id });
  return json(res, 200, { user: publicUser(updated) });
}

function adminMetrics(res, store, user) {
  if (!hasRole(user, ['admin'])) return json(res, 403, { error: 'Admin role required.' });
  const db = store.snapshot();
  return json(res, 200, {
    summary: summarizeAnalytics(db),
    recent: db.analytics.slice(-100).reverse()
  });
}

function adminAudit(res, store, user) {
  if (!hasRole(user, ['admin'])) return json(res, 403, { error: 'Admin role required.' });
  return json(res, 200, { audit: store.snapshot().auditLogs.slice(-200).reverse() });
}

async function staticFile(req, res, url) {
  let requested = decodeURIComponent(url.pathname);
  if (requested === '/') requested = '/index.html';
  const target = path.normalize(path.join(config.publicDir, requested));
  const relative = path.relative(config.publicDir, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return json(res, 403, { error: 'Forbidden.' });
  try {
    const data = await fs.readFile(target);
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      'content-type': mimeTypes[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=3600'
    });
    res.end(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const data = await fs.readFile(path.join(config.publicDir, 'index.html'));
      res.writeHead(200, { 'content-type': mimeTypes['.html'], 'cache-control': 'no-store' });
      res.end(data);
      return;
    }
    throw error;
  }
}
