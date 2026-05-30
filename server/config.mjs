import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '..');
const env = globalThis.process?.env ?? {};

function intEnv(name, fallback) {
  const value = Number(env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function boolEnv(name, fallback = false) {
  if (!(name in env)) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(env[name]).toLowerCase());
}

export const config = {
  rootDir,
  publicDir: path.join(rootDir, 'public'),
  dataDir: env.WORKMATE_DATA_DIR || path.join(rootDir, 'data'),
  host: env.HOST || '127.0.0.1',
  port: intEnv('PORT', 8787),
  appOrigin: env.APP_ORIGIN || '',
  sessionCookie: 'wm_session',
  csrfCookie: 'wm_csrf',
  sessionTtlMs: intEnv('SESSION_TTL_MS', 1000 * 60 * 60 * 24 * 14),
  sessionSecret: env.SESSION_SECRET || 'local-development-change-me',
  rateLimitWindowMs: intEnv('RATE_LIMIT_WINDOW_MS', 60_000),
  rateLimitMax: intEnv('RATE_LIMIT_MAX', 120),
  maxUploadBytes: intEnv('MAX_UPLOAD_MB', 12) * 1024 * 1024,
  enableRegistration: boolEnv('ENABLE_REGISTRATION', true),
  ai: {
    openaiApiKey: env.OPENAI_API_KEY || '',
    openaiBaseUrl: (env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, ''),
    model: env.OPENAI_MODEL || 'gpt-4.1',
    visionModel: env.OPENAI_VISION_MODEL || env.OPENAI_MODEL || 'gpt-4.1',
    endpointStyle: env.AI_ENDPOINT_STYLE || 'responses',
    timeoutMs: intEnv('AI_TIMEOUT_MS', 45_000)
  },
  tools: {
    tavilyApiKey: env.TAVILY_API_KEY || '',
    braveSearchApiKey: env.BRAVE_SEARCH_API_KEY || '',
    newsApiKey: env.NEWS_API_KEY || '',
    mapsApiKey: env.MAPS_API_KEY || ''
  }
};

export function publicConfig() {
  return {
    maxUploadBytes: config.maxUploadBytes,
    aiConfigured: Boolean(config.ai.openaiApiKey),
    liveProviders: {
      web: Boolean(config.tools.tavilyApiKey || config.tools.braveSearchApiKey),
      news: Boolean(config.tools.newsApiKey),
      maps: Boolean(config.tools.mapsApiKey)
    }
  };
}
