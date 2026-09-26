/**
 * Atlas is a coach, not a chat buddy for everything. Steering him off to the
 * weather, films or politics earns a warning ("not my thing — ask ChatGPT, or
 * I'll go quiet for half an hour"); the third time within a day he does go
 * quiet for 30 minutes. Safety and pain are always answered, blocked or not.
 * Kept on this device only (no server writes, no quota).
 */
export const MAX_STRIKES = 3;
export const BLOCK_MS = 30 * 60_000;
/** Warnings older than this are forgiven. */
export const STRIKE_WINDOW = 24 * 3_600_000;

export interface GuardState {
  /** When each warning was given (recent ones only). */
  strikes: number[];
  /** Quiet until this moment (0 = not blocked). */
  blockedUntil: number;
}

const KEY = 'spotter.atlasOffGuard';
const EMPTY: GuardState = { strikes: [], blockedUntil: 0 };

export function loadGuard(): GuardState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<GuardState> | null;
    return {
      strikes: Array.isArray(raw?.strikes) ? raw.strikes.filter((x) => typeof x === 'number') : [],
      blockedUntil: typeof raw?.blockedUntil === 'number' ? raw.blockedUntil : 0,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveGuard(s: GuardState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode — the guard just forgets */
  }
}

/** Quiet until (ms), or 0 when Atlas talks. */
export function blockedUntil(s: GuardState, now: number): number {
  return s.blockedUntil > now ? s.blockedUntil : 0;
}

/**
 * One more off-topic try. Returns which warning this is (1…3) and the new
 * state; the third one starts the block and wipes the slate.
 */
export function strike(s: GuardState, now: number): { n: number; state: GuardState } {
  const recent = s.strikes.filter((t) => now - t < STRIKE_WINDOW && t <= now);
  const strikes = [...recent, now];
  if (strikes.length >= MAX_STRIKES)
    return { n: MAX_STRIKES, state: { strikes: [], blockedUntil: now + BLOCK_MS } };
  return { n: strikes.length, state: { strikes, blockedUntil: 0 } };
}

/** Answered even while blocked: the safety net and a pain check-in. */
export function alwaysAnswered(intent: string | undefined, flow?: string): boolean {
  return !!intent && (intent.startsWith('safety_') || intent === 'pain' || flow === 'pain');
}
