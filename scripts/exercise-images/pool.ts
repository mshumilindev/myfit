/** Worker pool + retry with exponential backoff, jitter and Retry-After. */
import { classify } from './errors';

export async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
  shouldStop: () => boolean = () => false,
): Promise<void> {
  let next = 0;
  const lanes = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      while (!shouldStop()) {
        const i = next++;
        if (i >= items.length) return;
        await worker(items[i], i);
      }
    },
  );
  await Promise.all(lanes);
}

export function backoffMs(
  attempt: number,
  baseMs = 2000,
  maxMs = 60000,
  rnd = Math.random,
): number {
  const exp = Math.min(maxMs, baseMs * 2 ** attempt);
  // "Full jitter": spread retries so parallel lanes don't stampede together.
  return Math.round(exp / 2 + (rnd() * exp) / 2);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: {
    retries: number;
    onRetry?: (attempt: number, waitMs: number, err: unknown) => void;
    wait?: (ms: number) => Promise<void>;
  },
): Promise<T> {
  const wait = opts.wait ?? sleep;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      const c = classify(err);
      if (!c.retryable || attempt >= opts.retries) throw err;
      const ms = c.retryAfterMs ?? backoffMs(attempt);
      opts.onRetry?.(attempt + 1, ms, err);
      await wait(ms);
    }
  }
}

/** fetch with an abort-based timeout. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}
