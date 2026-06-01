// Universal safe wrapper — never let a side-pipeline crash the request.
// Logs the failure and returns the provided fallback.

export async function safe<T>(
  fn: () => Promise<T>,
  fallback: T,
  label = "safe",
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[safe:${label}] swallowed error`, { err: String(err) });
    return fallback;
  }
}

// Lightweight in-process metrics. Per-worker only; good enough for trend signal.
class Metrics {
  fallbackCount = 0;
  fallbackByReason = new Map<string, number>();
  recordFallback(reason: string) {
    this.fallbackCount++;
    this.fallbackByReason.set(reason, (this.fallbackByReason.get(reason) ?? 0) + 1);
    console.warn("[metrics:fallback]", {
      reason,
      total: this.fallbackCount,
      byReason: Object.fromEntries(this.fallbackByReason),
    });
  }
}

export const metrics = new Metrics();
