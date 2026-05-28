// Tiny in-process LRU+TTL cache for repeated live-data lookups.
// Per-worker only (no cross-instance coherence) — keeps latency low for hot queries
// without adding infrastructure.

interface Entry<V> { value: V; expires: number }

export class TTLCache<V> {
  private map = new Map<string, Entry<V>>();
  constructor(private maxEntries = 200, private ttlMs = 5 * 60_000) {}

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expires) { this.map.delete(key); return undefined; }
    // refresh LRU position
    this.map.delete(key);
    this.map.set(key, e);
    return e.value;
  }

  set(key: string, value: V): void {
    if (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}

export const liveDataCache = new TTLCache<unknown>(200, 5 * 60_000);
