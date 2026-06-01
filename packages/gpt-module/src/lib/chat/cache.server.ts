// Tiny in-process LRU+TTL cache for repeated live-data lookups.
// Per-worker only (no cross-instance coherence) — keeps latency low for hot queries
// without adding infrastructure. Sweeps expired entries on every write.

interface Entry<V> { value: V; expires: number }

export const CACHE_TTL = 5 * 60_000;

export class TTLCache<V> {
  private map = new Map<string, Entry<V>>();
  constructor(private maxEntries = 200, private ttlMs = CACHE_TTL) {}

  private sweep(): void {
    const now = Date.now();
    for (const [k, e] of this.map) if (now > e.expires) this.map.delete(k);
  }

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expires) { this.map.delete(key); return undefined; }
    this.map.delete(key);
    this.map.set(key, e);
    return e.value;
  }

  set(key: string, value: V): void {
    this.sweep();
    if (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  size(): number { return this.map.size; }
}

export const liveDataCache = new TTLCache<unknown>(200, CACHE_TTL);
