/**
 * What a wheel picker does when a row passes the selection band: a haptic tick (the iOS picker's detent) and, when a
 * sound is plugged in, its click. The kit's WheelPicker only exposes `onDetent`; the screen wires this in, so the kit
 * stays free of platform code. Nothing is stored or sent — the sound is off until something calls `setWheelSound`.
 */
import { haptic } from './haptics';

type Sound = (() => void) | null;
let sound: Sound = null;
let last = 0;
/** Fast flicks pass dozens of rows a second; one pulse per frame is already more than a finger can tell apart. */
const MIN_GAP_MS = 28;

/** Plug a sound in (or pass null to mute). Called from a user setting, if the product ever adds one. */
export function setWheelSound(fn: Sound): void {
  sound = fn;
}

let ctx: AudioContext | null = null;
/** A short dry "tick": 12 ms of a high sine with a fast decay, quiet enough to be heard over a gym. */
export function tickSound(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 2200;
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.015);
  } catch {
    /* best effort */
  }
}

export function wheelDetent(): void {
  const now = performance.now();
  if (now - last < MIN_GAP_MS) return;
  last = now;
  haptic('tick');
  sound?.();
}
