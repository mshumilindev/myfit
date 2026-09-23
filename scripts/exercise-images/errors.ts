/** Provider/QA errors carry whether a retry can help — the pool relies on it. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly opts: { retryable: boolean; status?: number; retryAfterMs?: number | null },
  ) {
    super(message);
    this.name = 'ProviderError';
  }
  get retryable(): boolean {
    return this.opts.retryable;
  }
}

/** HTTP status → retryable? 408/409/425/429 and 5xx yes; other 4xx (auth, policy, bad input) no. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

/** Retry-After header (seconds or HTTP date) → ms, or null. */
export function parseRetryAfter(v: string | null, now = Date.now()): number | null {
  if (!v) return null;
  const s = Number(v);
  if (Number.isFinite(s)) return Math.max(0, s * 1000);
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : Math.max(0, t - now);
}

export function classify(err: unknown): { retryable: boolean; retryAfterMs: number | null } {
  if (err instanceof ProviderError)
    return { retryable: err.retryable, retryAfterMs: err.opts.retryAfterMs ?? null };
  // Network failures / aborts from fetch are transient.
  if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TypeError'))
    return { retryable: true, retryAfterMs: null };
  return { retryable: false, retryAfterMs: null };
}
