/**
 * Sound and haptic schedule of a timed block (pure: no audio, no timers). The player maps a cue kind to a tone.
 * Countdown: tick on 5-4, warning tone on 3-2-1, long start tone on GO. Running block: one heads-up
 * 30 s before the end (only for blocks that have a cap), three short beeps on the last three seconds, a final tone.
 */
export type CueKind = 'tick' | 'warn' | 'go' | 'heads-up' | 'last' | 'end';

export const COUNTDOWN_FROM = 5;
export const WARN_AT = 3;
export const HEADS_UP_SEC = 30;
/** A heads-up under this length would fire right after the start: skip it for short blocks. */
export const HEADS_UP_MIN_BLOCK_SEC = 90;

/** The cue for a countdown second `n` (COUNTDOWN_FROM..1), or `go`. */
export function countdownCue(n: number, go = false): CueKind {
  if (go) return 'go';
  return n <= WARN_AT ? 'warn' : 'tick';
}

/** Whole seconds left on a countdown that started at `startMs`, ceil'd so the first beat shows `from`. 0 = GO. */
export function countdownLeft(startMs: number, nowMs: number, from = COUNTDOWN_FROM): number {
  const left = Math.ceil(from - (nowMs - startMs) / 1000);
  return Math.max(0, Math.min(from, left));
}

/**
 * The cue due when a running block's remaining whole seconds change from `prev` to `next` (counting down). Several
 * seconds can pass between two calls (a backgrounded tab): the most important cue crossed wins, never a burst.
 * `capSec` is the block's total length, or null for an open-ended block (For time without a cap): no heads-up, no end.
 */
export function blockCue(prev: number, next: number, capSec: number | null): CueKind | null {
  if (capSec == null || next >= prev) return null;
  if (next <= 0 && prev > 0) return 'end';
  if (next <= 3 && next >= 1 && prev > next) return 'last';
  if (capSec >= HEADS_UP_MIN_BLOCK_SEC && prev > HEADS_UP_SEC && next <= HEADS_UP_SEC)
    return 'heads-up';
  return null;
}

export interface CuePrefs {
  sound: boolean;
  vibrate: boolean;
}

/** What a cue does under the athlete's prefs: which output channels fire (sound off = visual and vibration only). */
export function cueOutputs(
  kind: CueKind,
  prefs: CuePrefs,
): { sound: boolean; haptic: 'tick' | 'double' | 'success' | null } {
  const strong = kind === 'go' || kind === 'end' || kind === 'heads-up';
  const h = !prefs.vibrate
    ? null
    : kind === 'go' || kind === 'end'
      ? 'success'
      : strong
        ? 'double'
        : 'tick';
  return { sound: prefs.sound, haptic: h };
}
