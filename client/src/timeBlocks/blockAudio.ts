import { haptic } from '../haptics';
import { primeRestAudio, restAudioCtx } from '../restTimer';
import { cueOutputs, type CueKind, type CuePrefs } from './cues';

/** [frequency Hz, duration s, peak gain, repeats, gap s] per cue: soft ticks, brighter warning, a long start tone. */
const TONES: Record<CueKind, readonly [number, number, number, number, number]> = {
  tick: [660, 0.08, 0.18, 1, 0],
  warn: [988, 0.12, 0.26, 1, 0],
  go: [1320, 0.55, 0.3, 1, 0],
  'heads-up': [880, 0.14, 0.26, 2, 0.2],
  last: [988, 0.1, 0.26, 1, 0],
  end: [1320, 0.7, 0.3, 2, 0.35],
};

/** Unlock audio inside the Start tap, so the countdown beeps can play (same context as the rest timer). */
export const primeBlockAudio = primeRestAudio;

function tone(ctx: AudioContext, t0: number, f: number, dur: number, peak: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

/** Play a cue under the athlete's Sound / Vibrate prefs. Best effort: no audio or haptics never throws. */
export function playCue(kind: CueKind, prefs: CuePrefs): void {
  const out = cueOutputs(kind, prefs);
  try {
    if (out.haptic) haptic(out.haptic);
  } catch {
    /* haptics are best effort */
  }
  if (!out.sound) return;
  const ctx = restAudioCtx();
  if (!ctx) return;
  const [f, dur, peak, n, gap] = TONES[kind];
  const t0 = ctx.currentTime;
  for (let i = 0; i < n; i++) tone(ctx, t0 + i * gap, f, dur, peak);
}
