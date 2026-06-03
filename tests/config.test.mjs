import assert from 'node:assert/strict';
import test from 'node:test';

import { config, publicConfig } from '../server/config.mjs';

test('config has required fields', () => {
  assert.ok(config.rootDir);
  assert.ok(config.publicDir);
  assert.ok(config.dataDir);
  assert.equal(config.sessionCookie, 'wm_session');
  assert.equal(config.csrfCookie, 'wm_csrf');
  assert.ok(config.sessionTtlMs > 0);
  assert.ok(config.rateLimitWindowMs > 0);
  assert.ok(config.rateLimitMax > 0);
  assert.ok(config.maxUploadBytes > 0);
});

test('config has AI settings', () => {
  assert.ok(config.ai);
  assert.ok(config.ai.model);
  assert.ok(config.ai.visionModel);
  assert.ok(config.ai.openaiBaseUrl);
  assert.ok(config.ai.timeoutMs > 0);
});

test('config has tools settings', () => {
  assert.ok('tavilyApiKey' in config.tools);
  assert.ok('braveSearchApiKey' in config.tools);
  assert.ok('newsApiKey' in config.tools);
  assert.ok('mapsApiKey' in config.tools);
});

test('publicConfig exposes safe subset', () => {
  const pub = publicConfig();
  assert.ok('maxUploadBytes' in pub);
  assert.ok('aiConfigured' in pub);
  assert.ok('liveProviders' in pub);
  assert.ok('web' in pub.liveProviders);
  assert.ok('news' in pub.liveProviders);
  assert.ok('maps' in pub.liveProviders);
});

test('publicConfig does not expose secrets', () => {
  const pub = publicConfig();
  assert.equal(pub.openaiApiKey, undefined);
  assert.equal(pub.tavilyApiKey, undefined);
  assert.equal(pub.sessionSecret, undefined);
});

test('publicConfig aiConfigured reflects key presence', () => {
  const pub = publicConfig();
  assert.equal(typeof pub.aiConfigured, 'boolean');
});

test('config defaults are reasonable', () => {
  assert.ok(config.rateLimitMax >= 10);
  assert.ok(config.sessionTtlMs >= 60_000);
  assert.ok(config.maxUploadBytes >= 1024);
});
