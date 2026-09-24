/**
 * Rest timer: how long to rest, and how to tell the athlete it's over.
 *
 * The countdown itself is derived in the session view from the last set's
 * `loggedAt` (so it survives reloads); this module holds the target rules and
 * the side effects — vibration, a short chime, a best-effort notification
 * when the app is in the background, and the screen wake lock that keeps the
 * app in the foreground in the first place (a web app can't fire on time from
 * a locked phone; keeping the screen on is what makes the alert reliable).
 */
import { useEffect } from 'react';
import { haptic } from './haptics';
import type { SetType } from './types';

/** Target rest presets offered in the rest sheet, seconds. */
export const REST_PRESETS = [45, 60, 90, 120, 150, 180, 240];

/**
 * Default rest when the athlete hasn't set one for the lift:
 *  - after a warm-up: 60 s (it's a ramp, not work);
 *  - between members of a superset/circuit round: none — go straight on;
 *  - heavy compound: 2:30; everything else: 1:30.
 * A remembered per-exercise target (the rest sheet) wins over all of these,
 * except the superset hand-off.
 */
export function defaultRestSec(p: {
  compound: boolean;
  lastType: SetType;
  midRound: boolean;
}): number {
  if (p.midRound) return 0;
  if (p.lastType === 'warmup') return 60;
  return p.compound ? 150 : 90;
}

/** Everything the app knows about the set just finished and the athlete today. */
export interface RestInputs {
  /** A multi-joint lift (catalog mechanic, sanity-checked by muscles crossed). */
  compound: boolean;
  /** Coarse equipment ids of the lift (barbell, dumbbell, machine, cable, body…). */
  equipment: string[];
  /** Main muscle trained. */
  primary: string | null;
  lastType: SetType;
  /** Weight as a share of today's expected e1RM (null = unknown / bodyweight). */
  intensity: number | null;
  reps: number;
  /** The set went to failure (marked or inferred). */
  failure: boolean;
  /** Effort, rated or estimated (6–10), null = unknown. */
  rpe: number | null;
  /** 0..1 weekly fatigue of the main muscle. */
  muscleFatigue: number;
  /** Ill now or recovering (last week). */
  illness: boolean;
  /** Slept ≥1.5 h short last night. */
  shortSleep: boolean;
  /** Superset / circuit hand-off to the next member (no rest). */
  midRound: boolean;
}

export type RestReason =
  | 'heavy'
  | 'moderate'
  | 'light'
  | 'isolation'
  | 'freeWeight'
  | 'machine'
  | 'bigMuscle'
  | 'smallMuscle'
  | 'failure'
  | 'hard'
  | 'easy'
  | 'highReps'
  | 'technique'
  | 'fatigue'
  | 'illness'
  | 'sleep'
  | 'warmup'
  | 'superset';

const BIG_MUSCLES = new Set([
  'quads',
  'glutes',
  'hamstrings',
  'back',
  'lats',
  'chest',
  'lower_back',
  'adductors',
]);
const SMALL_MUSCLES = new Set([
  'biceps',
  'triceps',
  'forearms',
  'calves',
  'core',
  'neck',
  'abductors',
]);

/**
 * How long to rest after this set, built from what the set was and the state
 * the athlete is in. The base comes from load (how close to max) and the lift
 * type; the rest are adjustments, each returned as a reason so the UI can say
 * why. Rounded to 15 s, 30 s … 5 min.
 *
 * Grounded in the usual guidance: 2–5 min for heavy multi-joint work, 1–2 min
 * for moderate hypertrophy work, ~1 min for light/isolation/high-rep work;
 * more after failure and for bigger, more fatigued muscles; free weights ask
 * more of the whole body than machines.
 */
export function planRest(i: RestInputs): {
  sec: number;
  reasons: { key: RestReason; sec: number }[];
} {
  const reasons: { key: RestReason; sec: number }[] = [];
  if (i.midRound) return { sec: 0, reasons: [{ key: 'superset', sec: 0 }] };
  if (i.lastType === 'warmup') return { sec: 60, reasons: [{ key: 'warmup', sec: 60 }] };
  // Base: relative load. Unknown load → by lift type.
  let base: number;
  const x = i.intensity;
  if (x !== null && x >= 0.85) {
    base = 180;
    reasons.push({ key: 'heavy', sec: 0 });
  } else if (x !== null && x >= 0.72) {
    base = 135;
    reasons.push({ key: 'moderate', sec: 0 });
  } else if (x !== null) {
    base = 105;
    reasons.push({ key: 'light', sec: 0 });
  } else base = i.compound ? 135 : 90;
  const add = (key: RestReason, sec: number) => {
    if (sec !== 0) reasons.push({ key, sec });
    return sec;
  };
  let sec = base;
  if (!i.compound) sec += add('isolation', -Math.round(base * 0.3));
  const eq = i.equipment;
  if (i.compound && eq.some((e) => e === 'barbell' || e === 'ezBar')) sec += add('freeWeight', 15);
  else if (eq.length > 0 && eq.every((e) => e === 'machine' || e === 'cable'))
    sec += add('machine', -15);
  if (i.primary && BIG_MUSCLES.has(i.primary)) sec += add('bigMuscle', 15);
  else if (i.primary && SMALL_MUSCLES.has(i.primary)) sec += add('smallMuscle', -15);
  if (i.failure) sec += add('failure', 30);
  else if (i.rpe !== null && i.rpe >= 9) sec += add('hard', 20);
  else if (i.rpe !== null && i.rpe <= 7) sec += add('easy', -15);
  if (i.reps >= 15) sec += add('highReps', -15);
  if (i.lastType === 'drop' || i.lastType === 'reverse-drop') sec += add('technique', 30);
  else if (i.lastType === 'static-dynamic') sec += add('technique', 15);
  if (i.muscleFatigue > 0.15)
    sec += add('fatigue', Math.round((30 * Math.min(1, i.muscleFatigue)) / 5) * 5);
  if (i.illness) sec += add('illness', 20);
  if (i.shortSleep) sec += add('sleep', 15);
  const out = Math.min(300, Math.max(30, Math.round(sec / 15) * 15));
  return { sec: out, reasons };
}

export interface RestPrefs {
  vibrate: boolean;
  sound: boolean;
  keepAwake: boolean;
  notify: boolean;
}
export const REST_PREFS_DEFAULT: RestPrefs = {
  vibrate: true,
  sound: true,
  keepAwake: true,
  notify: false,
};

let audioCtx: AudioContext | null = null;

/** Unlock audio inside a user gesture (the Log tap), so the chime can play later. */
export function primeRestAudio(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch {
    /* no audio — vibration still works */
  }
}

function chime(): void {
  const ctx = audioCtx;
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime;
  // Two soft rising tones — noticeable in a gym, not an alarm.
  for (const [i, f] of [880, 1320].entries()) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    const s = t0 + i * 0.18;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.25, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start(s);
    o.stop(s + 0.4);
  }
}

/** Fire the "rest is over" alert according to the athlete's prefs. */
export function restAlert(prefs: RestPrefs, note?: { title: string; body: string }): void {
  try {
    if (prefs.vibrate) haptic('double');
  } catch {
    /* ignore */
  }
  if (prefs.sound) chime();
  if (
    prefs.notify &&
    note &&
    typeof document !== 'undefined' &&
    document.visibilityState === 'hidden' &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
  ) {
    void navigator.serviceWorker?.ready
      .then((reg) => reg.showNotification(note.title, { body: note.body, tag: 'rest-done' }))
      .catch(() => {});
  }
}

/** Ask for notification permission (from the rest sheet toggle). */
export async function requestRestNotifications(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

type WakeLockLike = { release: () => Promise<void> };

/** Keep the screen on while `active` (a live workout). Re-acquired when the
 *  page comes back to the foreground — the browser drops it on hide. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined') return;
    const wl = (
      navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } }
    ).wakeLock;
    if (!wl) return;
    let lock: WakeLockLike | null = null;
    let dead = false;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      wl.request('screen')
        .then((l) => {
          if (dead) void l.release();
          else lock = l;
        })
        .catch(() => {});
    };
    acquire();
    const onVis = () => acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      dead = true;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}

/** m:ss for the countdown. */
export function fmtCountdown(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
