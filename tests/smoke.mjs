import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.WORKMATE_DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'workmate-smoke-'));

const { createApp } = await import('../server/app.mjs');
const { server } = await createApp();

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const health = await fetch(`${base}/api/health`);

if (!health.ok) {
  throw new Error(`Health check failed: ${health.status}`);
}

console.log(`Smoke check passed at ${base}`);
await new Promise((resolve) => server.close(resolve));
