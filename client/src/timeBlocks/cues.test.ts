import { describe, expect, it } from 'vitest';
import {
  blockCue,
  countdownCue,
  countdownLeft,
  cueOutputs,
  COUNTDOWN_FROM,
  HEADS_UP_MIN_BLOCK_SEC,
} from './cues';

describe('countdown cues', () => {
  it('ticks on 5 and 4, warns on 3-2-1, long tone on GO', () => {
    expect([5, 4, 3, 2, 1].map((n) => countdownCue(n))).toEqual([
      'tick',
      'tick',
      'warn',
      'warn',
      'warn',
    ]);
    expect(countdownCue(0, true)).toBe('go');
  });

  it('counts whole seconds from the deadline, 5 on the first beat and 0 at GO', () => {
    expect(countdownLeft(1000, 1000)).toBe(COUNTDOWN_FROM);
    expect(countdownLeft(1000, 1999)).toBe(5);
    expect(countdownLeft(1000, 2001)).toBe(4);
    expect(countdownLeft(1000, 5999)).toBe(1);
    expect(countdownLeft(1000, 6000)).toBe(0);
    expect(countdownLeft(1000, 99999)).toBe(0); // a long background pause lands on GO, never negative
    expect(countdownLeft(1000, 500)).toBe(5); // clock skew never exceeds the start
  });
});

describe('running-block cues', () => {
  const cap = 12 * 60;
  it('gives the heads-up when crossing 30 s, only for blocks long enough', () => {
    expect(blockCue(31, 30, cap)).toBe('heads-up');
    expect(blockCue(40, 29, cap)).toBe('heads-up'); // skipped a second in the background
    expect(blockCue(31, 30, HEADS_UP_MIN_BLOCK_SEC - 1)).toBeNull();
    expect(blockCue(31, 30, HEADS_UP_MIN_BLOCK_SEC)).toBe('heads-up');
  });
  it('gives no heads-up when the 30 s line was already crossed', () => {
    expect(blockCue(30, 29, cap)).toBeNull(); // prev already at 30: the cue fired on the tick before
    expect(blockCue(20, 15, cap)).toBeNull();
    expect(blockCue(10, 5, cap)).toBeNull();
  });
  it('beeps on 3-2-1 and a final tone at zero', () => {
    expect([3, 2, 1].map((n) => blockCue(n + 1, n, cap))).toEqual(['last', 'last', 'last']);
    expect(blockCue(1, 0, cap)).toBe('end');
    expect(blockCue(5, 0, cap)).toBe('end'); // the end wins over the beeps it skipped
  });
  it('is silent in between, when time does not go down, and for open-ended blocks', () => {
    expect(blockCue(100, 99, cap)).toBeNull();
    expect(blockCue(10, 10, cap)).toBeNull();
    expect(blockCue(10, 12, cap)).toBeNull();
    expect(blockCue(31, 30, null)).toBeNull();
    expect(blockCue(1, 0, null)).toBeNull();
  });
});

describe('cue outputs under prefs', () => {
  it('sound off means no audio, vibration still fires; vibrate off means no haptic', () => {
    expect(cueOutputs('go', { sound: false, vibrate: true })).toEqual({
      sound: false,
      haptic: 'success',
    });
    expect(cueOutputs('tick', { sound: true, vibrate: false })).toEqual({
      sound: true,
      haptic: null,
    });
    expect(cueOutputs('heads-up', { sound: true, vibrate: true }).haptic).toBe('double');
    expect(cueOutputs('warn', { sound: true, vibrate: true }).haptic).toBe('tick');
    expect(cueOutputs('end', { sound: true, vibrate: true }).haptic).toBe('success');
  });
});
