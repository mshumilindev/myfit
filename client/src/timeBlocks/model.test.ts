import { describe, expect, it } from 'vitest';
import {
  blockCapSec,
  blockOrder,
  blockRemainSec,
  blockView,
  elapsedMs,
  finishRun,
  pauseRun,
  resumeRun,
  startRun,
  validateSpec,
  type BlockSpec,
  type WorkoutBlock,
} from './model';

const amrap: BlockSpec = { fmt: 'amrap', capSec: 720 };
const emom: BlockSpec = { fmt: 'emom', everySec: 60, rounds: 10 };
const tabata: BlockSpec = { fmt: 'intervals', workSec: 20, restSec: 10, rounds: 8 };
const fran: BlockSpec = { fmt: 'fortime', scheme: [21, 15, 9] };

describe('block run (timestamps only)', () => {
  it('elapsed excludes paused time and freezes while paused or finished', () => {
    let r = startRun(1000);
    expect(elapsedMs(r, 4000)).toBe(3000);
    r = pauseRun(r, 4000);
    expect(elapsedMs(r, 9000)).toBe(3000); // frozen while paused
    r = resumeRun(r, 9000);
    expect(elapsedMs(r, 10000)).toBe(4000); // 5 s pause not counted
    r = finishRun(r, 12000);
    expect(elapsedMs(r, 99999)).toBe(6000);
  });
  it('pause/resume/finish are idempotent and a clock jumping back never gives negative time', () => {
    let r = startRun(1000);
    r = pauseRun(pauseRun(r, 2000), 3000);
    expect(r.pausedAt).toBe(2000);
    expect(resumeRun(resumeRun(r, 5000), 6000).pausedMs).toBe(3000);
    expect(elapsedMs(startRun(5000), 1000)).toBe(0);
    const f = finishRun(startRun(0), 1000);
    expect(finishRun(f, 9000).finishedAt).toBe(1000);
    expect(pauseRun(f, 2000)).toBe(f);
  });
});

describe('block length and validation', () => {
  it('knows the total length per format; open-ended For time has none', () => {
    expect(blockCapSec(amrap)).toBe(720);
    expect(blockCapSec(emom)).toBe(600);
    expect(blockCapSec(tabata)).toBe(230); // 8 x 30 s, no rest after the last work
    expect(blockCapSec(fran)).toBeNull();
    expect(blockCapSec({ fmt: 'fortime', capSec: 900 })).toBe(900);
    expect(blockRemainSec(amrap, 100.2)).toBe(620);
    expect(blockRemainSec(fran, 100)).toBeNull();
  });
  it('accepts the classics and refuses malformed specs', () => {
    expect([amrap, emom, tabata, fran].every(validateSpec)).toBe(true);
    expect(validateSpec({ fmt: 'amrap' })).toBe(false);
    expect(validateSpec({ fmt: 'amrap', capSec: 0 })).toBe(false);
    expect(validateSpec({ fmt: 'amrap', capSec: 99999 })).toBe(false);
    expect(validateSpec({ fmt: 'emom', rounds: 0 })).toBe(false);
    expect(validateSpec({ fmt: 'emom', everySec: 600, rounds: 99 })).toBe(false);
    expect(validateSpec({ fmt: 'intervals', workSec: 20, rounds: 8 })).toBe(true);
    expect(validateSpec({ fmt: 'intervals', workSec: 0, rounds: 8 })).toBe(false);
    expect(validateSpec({ fmt: 'fortime', scheme: [] })).toBe(false);
    expect(validateSpec({ fmt: 'fortime', scheme: [21, 1.5] })).toBe(false);
    expect(validateSpec({ fmt: 'bogus' } as unknown as BlockSpec)).toBe(false);
  });
});

describe('block clock view', () => {
  it('AMRAP counts down and is done at the cap', () => {
    expect(blockView(amrap, 0)).toMatchObject({ remainSec: 720, pct: 100, done: false });
    expect(blockView(amrap, 360)).toMatchObject({ remainSec: 360, pct: 50 });
    expect(blockView(amrap, 720)).toMatchObject({ remainSec: 0, done: true });
    expect(blockView(amrap, 5000)).toMatchObject({ remainSec: 0, done: true });
  });
  it('EMOM shows the minute and the seconds left in it, done after the last minute', () => {
    expect(blockView(emom, 0)).toMatchObject({ minute: 1, remainSec: 60, total: 10 });
    expect(blockView(emom, 59.5)).toMatchObject({ minute: 1, remainSec: 1 });
    expect(blockView(emom, 60)).toMatchObject({ minute: 2, remainSec: 60 });
    expect(blockView(emom, 599)).toMatchObject({ minute: 10, remainSec: 1, done: false });
    expect(blockView(emom, 600)).toMatchObject({ minute: 10, remainSec: 0, done: true });
  });
  it('intervals alternate work and rest, and end on the last work', () => {
    expect(blockView(tabata, 0)).toMatchObject({ phase: 'work', round: 1, remainSec: 20 });
    expect(blockView(tabata, 20)).toMatchObject({ phase: 'rest', round: 1, remainSec: 10 });
    expect(blockView(tabata, 30)).toMatchObject({ phase: 'work', round: 2, remainSec: 20 });
    expect(blockView(tabata, 229)).toMatchObject({
      phase: 'work',
      round: 8,
      remainSec: 1,
      done: false,
    });
    expect(blockView(tabata, 230)).toMatchObject({ round: 8, remainSec: 0, done: true });
  });
  it('For time counts up and is done only at its cap', () => {
    expect(blockView(fran, 125.9)).toMatchObject({ elapsedSec: 125, capPct: null, done: false });
    expect(blockView({ fmt: 'fortime', capSec: 600 }, 300)).toMatchObject({
      capPct: 50,
      done: false,
    });
    expect(blockView({ fmt: 'fortime', capSec: 600 }, 600)).toMatchObject({ done: true });
  });
  it('negative elapsed (clock skew) reads as the start', () => {
    expect(blockView(amrap, -5)).toMatchObject({ remainSec: 720 });
  });
});

describe('blockOrder', () => {
  const at = (id: string, position: number): WorkoutBlock => ({
    id,
    spec: amrap,
    members: [],
    position,
  });
  it('sorts by position among the exercises and does not mutate its input', () => {
    const input = [at('c', 2.5), at('a', -0.5), at('d', 5.5), at('b', 0.5)];
    const ids = input.map((b) => b.id);
    expect(blockOrder(input).map((b) => b.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(input.map((b) => b.id)).toEqual(ids);
  });
});
