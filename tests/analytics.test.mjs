import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeAnalytics } from '../server/modules/analytics.mjs';

test('summarizeAnalytics returns correct summary for empty analytics', () => {
  const summary = summarizeAnalytics({ analytics: [] });
  assert.equal(summary.totalEvents, 0);
  assert.equal(summary.errorRate, 0);
  assert.equal(summary.averageLatencyMs, 0);
  assert.equal(summary.tokensEstimated, 0);
  assert.deepEqual(summary.byType, {});
  assert.deepEqual(summary.byTool, {});
  assert.deepEqual(summary.byMode, {});
});

test('summarizeAnalytics aggregates events by type', () => {
  const db = {
    analytics: [
      { type: 'chat', mode: 'general', status: 'ok', latencyMs: 100, tokensEstimated: 50, toolNames: [] },
      { type: 'chat', mode: 'general', status: 'ok', latencyMs: 200, tokensEstimated: 75, toolNames: [] },
      { type: 'upload', mode: 'general', status: 'ok', latencyMs: 50, tokensEstimated: 0, toolNames: [] }
    ]
  };
  const summary = summarizeAnalytics(db);
  assert.equal(summary.totalEvents, 3);
  assert.equal(summary.byType.chat, 2);
  assert.equal(summary.byType.upload, 1);
});

test('summarizeAnalytics calculates average latency', () => {
  const db = {
    analytics: [
      { type: 'chat', mode: 'general', status: 'ok', latencyMs: 100, tokensEstimated: 0, toolNames: [] },
      { type: 'chat', mode: 'general', status: 'ok', latencyMs: 300, tokensEstimated: 0, toolNames: [] }
    ]
  };
  const summary = summarizeAnalytics(db);
  assert.equal(summary.averageLatencyMs, 200);
});

test('summarizeAnalytics calculates error rate', () => {
  const db = {
    analytics: [
      { type: 'chat', mode: 'general', status: 'ok', latencyMs: 0, tokensEstimated: 0, toolNames: [] },
      { type: 'chat', mode: 'general', status: 'error', latencyMs: 0, tokensEstimated: 0, toolNames: [] },
      { type: 'chat', mode: 'general', status: 'error', latencyMs: 0, tokensEstimated: 0, toolNames: [] },
      { type: 'chat', mode: 'general', status: 'ok', latencyMs: 0, tokensEstimated: 0, toolNames: [] }
    ]
  };
  const summary = summarizeAnalytics(db);
  assert.equal(summary.errorRate, 0.5);
});

test('summarizeAnalytics sums tokens', () => {
  const db = {
    analytics: [
      { type: 'chat', mode: 'general', status: 'ok', latencyMs: 0, tokensEstimated: 100, toolNames: [] },
      { type: 'chat', mode: 'general', status: 'ok', latencyMs: 0, tokensEstimated: 250, toolNames: [] }
    ]
  };
  const summary = summarizeAnalytics(db);
  assert.equal(summary.tokensEstimated, 350);
});

test('summarizeAnalytics aggregates by tool names', () => {
  const db = {
    analytics: [
      { type: 'chat', mode: 'general', status: 'ok', latencyMs: 0, tokensEstimated: 0, toolNames: ['weather', 'web_search'] },
      { type: 'chat', mode: 'general', status: 'ok', latencyMs: 0, tokensEstimated: 0, toolNames: ['weather'] },
      { type: 'chat', mode: 'general', status: 'ok', latencyMs: 0, tokensEstimated: 0, toolNames: ['calculator'] }
    ]
  };
  const summary = summarizeAnalytics(db);
  assert.equal(summary.byTool.weather, 2);
  assert.equal(summary.byTool.web_search, 1);
  assert.equal(summary.byTool.calculator, 1);
});

test('summarizeAnalytics aggregates by mode', () => {
  const db = {
    analytics: [
      { type: 'chat', mode: 'general', status: 'ok', latencyMs: 0, tokensEstimated: 0, toolNames: [] },
      { type: 'chat', mode: 'medical', status: 'ok', latencyMs: 0, tokensEstimated: 0, toolNames: [] },
      { type: 'chat', mode: 'general', status: 'ok', latencyMs: 0, tokensEstimated: 0, toolNames: [] }
    ]
  };
  const summary = summarizeAnalytics(db);
  assert.equal(summary.byMode.general, 2);
  assert.equal(summary.byMode.medical, 1);
});

test('summarizeAnalytics only considers last 1000 events', () => {
  const analytics = Array.from({ length: 1500 }, (_, i) => ({
    type: 'chat',
    mode: 'general',
    status: i < 500 ? 'error' : 'ok',
    latencyMs: 10,
    tokensEstimated: 1,
    toolNames: []
  }));
  const summary = summarizeAnalytics({ analytics });
  assert.equal(summary.totalEvents, 1000);
});

test('summarizeAnalytics handles missing toolNames gracefully', () => {
  const db = {
    analytics: [
      { type: 'chat', mode: 'general', status: 'ok', latencyMs: 0, tokensEstimated: 0 }
    ]
  };
  const summary = summarizeAnalytics(db);
  assert.equal(summary.totalEvents, 1);
});

test('summarizeAnalytics handles zero latency entries', () => {
  const db = {
    analytics: [
      { type: 'chat', mode: 'general', status: 'ok', latencyMs: 0, tokensEstimated: 0, toolNames: [] }
    ]
  };
  const summary = summarizeAnalytics(db);
  assert.equal(summary.averageLatencyMs, 0);
});
