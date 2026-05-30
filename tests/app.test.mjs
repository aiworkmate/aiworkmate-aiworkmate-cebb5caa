import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const leakedPattern = new RegExp([
  'Next best' + ' action',
  'Ask a' + ' follow-up',
  'I processed' + ' your request',
  'routing' + ' response',
  'orchestration' + ' output'
].join('|'), 'i');

async function boot() {
  process.env.WORKMATE_DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'workmate-test-'));
  process.env.PORT = '0';
  const { createApp } = await import('../server/app.mjs');
  const { server } = await createApp();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    server,
    base: `http://127.0.0.1:${address.port}`,
    cookies: ''
  };
}

function mergeCookies(ctx, response) {
  const setCookie = response.headers.getSetCookie ? response.headers.getSetCookie() : splitSetCookie(response.headers.get('set-cookie'));
  if (!setCookie?.length) return;
  const jar = new Map(ctx.cookies.split('; ').filter(Boolean).map((part) => part.split('=')));
  for (const item of setCookie) {
    const [pair] = item.split(';');
    const [key, value] = pair.split('=');
    if (value) jar.set(key, value);
  }
  ctx.cookies = [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}

function splitSetCookie(value) {
  if (!value) return [];
  return value.split(/,\s*(?=[^;,]+=)/);
}

async function request(ctx, pathName, options = {}) {
  const response = await fetch(`${ctx.base}${pathName}`, {
    ...options,
    headers: {
      ...(ctx.cookies ? { cookie: ctx.cookies } : {}),
      ...(ctx.csrf ? { 'x-csrf-token': ctx.csrf } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  mergeCookies(ctx, response);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (body.csrfToken) ctx.csrf = body.csrfToken;
  return { response, body, text };
}

test('AI WorkMate secure app flow', async () => {
  const ctx = await boot();
  try {
    const health = await request(ctx, '/api/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.response.headers.get('x-frame-options'), 'DENY');

    const register = await request(ctx, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ada', email: 'ada@example.com', password: 'correct horse battery staple' })
    });
    assert.equal(register.response.status, 201);
    assert.equal(register.body.user.role, 'admin');
    assert.ok(ctx.csrf);

    const upload = await request(ctx, '/api/uploads', {
      method: 'POST',
      body: JSON.stringify({
        name: 'brief.txt',
        type: 'text/plain',
        dataUrl: `data:text/plain;base64,${Buffer.from('Remember that I prefer concise product specs.').toString('base64')}`
      })
    });
    assert.equal(upload.response.status, 201);
    assert.equal(upload.body.upload.hasText, true);

    const memory = await request(ctx, '/api/memory', {
      method: 'POST',
      body: JSON.stringify({ content: 'I prefer concise product specs.', kind: 'preference' })
    });
    assert.equal(memory.response.status, 201);

    const chat = await fetch(`${ctx.base}/api/chat/stream`, {
      method: 'POST',
      headers: { cookie: ctx.cookies, 'x-csrf-token': ctx.csrf, 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Summarize my uploaded brief', uploadIds: [upload.body.upload.id], enableLive: false })
    });
    assert.equal(chat.status, 200);
    const streamText = await chat.text();
    assert.match(streamText, /event: token/);
    assert.doesNotMatch(streamText, leakedPattern);

    const jsonChat = await request(ctx, '/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Summarize my uploaded brief', uploadIds: [upload.body.upload.id], enableLive: false })
    });
    assert.equal(jsonChat.response.status, 200);
    assert.deepEqual(Object.keys(jsonChat.body).sort(), ['response']);
    assert.match(jsonChat.body.response, /brief|file|attached|reviewed/i);
    assert.doesNotMatch(jsonChat.body.response, leakedPattern);

    const warzone = await fetch(`${ctx.base}/api/chat`, {
      method: 'POST',
      headers: { cookie: ctx.cookies, 'x-csrf-token': ctx.csrf, 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'who is the best in warzone', enableLive: false })
    });
    const warzoneBody = await warzone.json();
    assert.deepEqual(Object.keys(warzoneBody).sort(), ['response']);
    assert.match(warzoneBody.response, /Aiden|Biffle|Aydan|Metaphor/i);
    assert.doesNotMatch(warzoneBody.response, leakedPattern);

    const metrics = await request(ctx, '/api/admin/metrics');
    assert.equal(metrics.response.status, 200);
    assert.ok(metrics.body.summary.totalEvents >= 1);
  } finally {
    await new Promise((resolve) => ctx.server.close(resolve));
  }
});
