import "server-only";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;

let sweepStarted = false;
function ensureSweep() {
  if (sweepStarted) return;
  sweepStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, WINDOW_MS).unref?.();
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(key: string): RateLimitResult {
  ensureSweep();
  const now = Date.now();
  let entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, entry);
  }
  entry.count++;
  return {
    allowed: entry.count <= MAX_REQUESTS,
    limit: MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - entry.count),
    resetAt: entry.resetAt,
  };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}
