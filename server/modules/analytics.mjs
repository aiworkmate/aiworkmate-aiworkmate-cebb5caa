import { nowISO, uid } from '../lib/utils.mjs';

export async function recordMetric(store, event) {
  const metric = {
    id: uid('metric'),
    at: nowISO(),
    type: event.type || 'event',
    userId: event.userId || null,
    conversationId: event.conversationId || null,
    latencyMs: event.latencyMs || 0,
    tokensEstimated: event.tokensEstimated || 0,
    model: event.model || null,
    toolNames: event.toolNames || [],
    mode: event.mode || 'general',
    status: event.status || 'ok',
    detail: event.detail || null
  };
  await store.update((db) => {
    db.analytics.push(metric);
    if (db.analytics.length > 5000) db.analytics = db.analytics.slice(-5000);
  });
  return metric;
}

export async function audit(store, event) {
  const entry = {
    id: uid('audit'),
    at: nowISO(),
    actorId: event.actorId || null,
    type: event.type,
    targetId: event.targetId || null,
    ip: event.ip || null,
    status: event.status || 'ok',
    detail: event.detail || {}
  };
  await store.update((db) => {
    db.auditLogs.push(entry);
    if (db.auditLogs.length > 5000) db.auditLogs = db.auditLogs.slice(-5000);
  });
  return entry;
}

export function summarizeAnalytics(db) {
  const last = db.analytics.slice(-1000);
  const byType = {};
  const byTool = {};
  const byMode = {};
  let errors = 0;
  let latencyTotal = 0;
  let latencyCount = 0;
  let tokens = 0;

  for (const item of last) {
    byType[item.type] = (byType[item.type] || 0) + 1;
    byMode[item.mode] = (byMode[item.mode] || 0) + 1;
    if (item.status !== 'ok') errors += 1;
    if (item.latencyMs) {
      latencyTotal += item.latencyMs;
      latencyCount += 1;
    }
    tokens += item.tokensEstimated || 0;
    for (const tool of item.toolNames || []) {
      byTool[tool] = (byTool[tool] || 0) + 1;
    }
  }

  return {
    totalEvents: last.length,
    errorRate: last.length ? errors / last.length : 0,
    averageLatencyMs: latencyCount ? Math.round(latencyTotal / latencyCount) : 0,
    tokensEstimated: tokens,
    byType,
    byTool,
    byMode
  };
}
