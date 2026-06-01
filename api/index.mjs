if (!process.env.WORKMATE_DATA_DIR) {
  process.env.WORKMATE_DATA_DIR = '/tmp/ai-workmate-data';
}

let appPromise;

async function getHandler() {
  if (!appPromise) {
    const { createApp } = await import('../server/app.mjs');
    appPromise = createApp();
  }
  const app = await appPromise;
  return app.handler;
}

export default async function handler(req, res) {
  const appHandler = await getHandler();
  return appHandler(req, res);
}
