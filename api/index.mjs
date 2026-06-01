import { createApp } from '../server/app.mjs';

let appPromise;

async function getHandler() {
  if (!appPromise) appPromise = createApp();
  const app = await appPromise;
  return app.handler;
}

export default async function handler(req, res) {
  const appHandler = await getHandler();
  return appHandler(req, res);
}
