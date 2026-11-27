import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from './addons/enabledSet';
import {
  BLOCK_LOAD_WEIGHT,
  BLOCK_REPS_PER_SET,
  BLOCK_SECONDS_PER_SET,
  blockMuscleLoad,
} from './blockLoad';
import { acuteCap, acuteFatigueScore, muscleFatigue } from './fatigue';
import { muscleReadiness, RECOVERY_DAYS } from './recovery';
import { LANDMARKS } from './volume';
import { muscleSetsInWorkout, SECONDARY_SET_WEIGHT, workoutSets, workoutVolumeKg } from './store';
import { recentLoadSets } from './loadWindow';
import { weeklyMuscleSets } from './volume';
import type { WorkoutBlock } from './timeBlocks/model';
import type { Exercise, Workout } from './types';

const INSTALLED = ['advanced-training', 'time-blocks', 'fatigue', 'readiness'];
beforeEach(() => addonsPref.set(INSTALLED));
afterEach(() => addonsPref.reset());

const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 27, 12);

const blk = (o: Partial<WorkoutBlock> = {}): WorkoutBlock => ({
  id: 'b',
  spec: { fmt: 'amrap', capSec: 720 },
  members: [{ name: 'Pullups', reps: '5' }],
  position: -0.5,
  run: { startedAt: 1, pausedMs: 0, pausedAt: null, finishedAt: 2 },
  result: { rounds: 8, savedAt: 3 },
  ...o,
});
const lift = (name: string, n: number): Exercise => ({
  id: name,
  name,
  kind: 'strength',
  position: 0,
  sets: Array.from({ length: n }, (_, i) => ({
    id: `${name}${i}`,
    reps: 8,
    weight: 80,
    isWarmup: false,
    position: i,
    loggedAt: NOW,
  })),
});
const session = (daysAgo: number, exercises: Exercise[], blocks?: WorkoutBlock[]): Workout => ({
  id: `w${daysAgo}${exercises.length}${blocks ? 'b' : ''}`,
  startedAt: NOW - daysAgo * DAY,
  finishedAt: NOW - daysAgo * DAY + 3600000,
  autoFinished: false,
  exercises,
  ...(blocks ? { blocks } : {}),
});

describe('blockMuscleLoad: what a logged block asks of a muscle', () => {
  it('turns rounds × reps into hard-set equivalents at the block weight', () => {
    const l = blockMuscleLoad({ blocks: [blk()] }).get('lats')!;
    expect(l.primary).toBeCloseTo(((5 * 8) / BLOCK_REPS_PER_SET) * BLOCK_LOAD_WEIGHT, 6); // 2 sets
    expect(blockMuscleLoad({ blocks: [blk()] }).get('biceps')!.secondary).toBeCloseTo(2, 6);
  });

  it('counts timed members by seconds, and `actuals` as the total that member did', () => {
    const timed = blk({
      members: [{ name: 'Pullups', reps: '40 s' }],
      result: { rounds: 3, savedAt: 1 },
    });
    expect(blockMuscleLoad({ blocks: [timed] }).get('lats')!.primary).toBeCloseTo(
      ((40 * 3) / BLOCK_SECONDS_PER_SET) * BLOCK_LOAD_WEIGHT,
      6,
    );
    const did = blk({ result: { rounds: 8, actuals: { 0: 20 }, savedAt: 1 } });
    expect(blockMuscleLoad({ blocks: [did] }).get('lats')!.primary).toBeCloseTo(
      (20 / BLOCK_REPS_PER_SET) * BLOCK_LOAD_WEIGHT,
      6,
    );
  });

  it('pins the conversion constants and reads minutes as 60 seconds', () => {
    expect([BLOCK_REPS_PER_SET, BLOCK_SECONDS_PER_SET, BLOCK_LOAD_WEIGHT]).toEqual([10, 40, 0.5]);
    for (const reps of ['1 min', '1m', '60 s']) {
      const b = blk({
        members: [{ name: 'Pullups', reps }],
        result: { rounds: 2, savedAt: 1 },
      });
      // 2 rounds × 60 s = 120 s -> 3 hard sets -> 1.5 at the block weight
      expect(blockMuscleLoad({ blocks: [b] }).get('lats')!.primary, reps).toBeCloseTo(1.5, 6);
    }
  });

  it('counts only a block with a saved result, a known move, and only while the module is installed', () => {
    expect(blockMuscleLoad({ blocks: [blk({ result: undefined })] }).size).toBe(0);
    expect(blockMuscleLoad({ blocks: [] }).size).toBe(0);
    expect(blockMuscleLoad({}).size).toBe(0);
    expect(
      blockMuscleLoad({ blocks: [blk({ members: [{ name: 'Mystery Dance', reps: '9' }] })] }).size,
    ).toBe(0);
    expect(blockMuscleLoad({ blocks: [blk({ members: [{ name: 'Pullups' }] })] }).size).toBe(0); // no reps = nothing to count
    addonsPref.set([]);
    expect(blockMuscleLoad({ blocks: [blk()] }).size).toBe(0);
  });
});

describe('fatigue and readiness read blocks; volume does not', () => {
  const lifts = [lift('Barbell Squat', 4)];
  const withBlock = [
    session(1, lifts, [
      blk({ members: [{ name: 'Pullups', reps: '12' }], result: { rounds: 10, savedAt: 1 } }),
    ]),
  ];
  const without = [session(1, lifts)];

  it('is byte-for-byte the old read for sessions without blocks, with an empty list or with no result', () => {
    const base = muscleFatigue(without, NOW);
    for (const w of [session(1, lifts, []), session(1, lifts, [blk({ result: undefined })])]) {
      expect([...muscleFatigue([w], NOW)]).toEqual([...base]);
      expect([...muscleReadiness([w], NOW)]).toEqual([...muscleReadiness(without, NOW)]);
    }
  });

  it('a block raises the score of the muscle it loads and lowers its readiness', () => {
    const a = muscleFatigue(without, NOW).get('lats')!;
    const b = muscleFatigue(withBlock, NOW).get('lats')!;
    expect(b.score).toBeGreaterThan(a.score);
    expect(muscleReadiness(withBlock, NOW).get('lats')!.readiness).toBeLessThan(
      muscleReadiness(without, NOW).get('lats')!.readiness,
    );
  });

  it('a muscle worked only in a block is not direct work: it cannot read "fried", whatever the block', () => {
    const huge = [
      session(
        1,
        [],
        [blk({ members: [{ name: 'Pullups', reps: '30' }], result: { rounds: 60, savedAt: 1 } })],
      ),
    ];
    const f = muscleFatigue(huge, NOW).get('lats')!;
    expect(f.level).not.toBe('fried');
    expect(f.score).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(f.sets).toBe(0); // the "N sets" shown stay in the volume currency
    expect(f.score).toBeGreaterThan(0); // but it is not treated as untouched
  });

  it('the dose of a block and a lift in one session is one dose (acute term reads their sum)', () => {
    const two = [
      session(
        0.1,
        [lift('Barbell Squat', 2)],
        [
          blk({
            members: [{ name: 'Goblet Squat', reps: '10' }],
            result: { rounds: 6, savedAt: 1 },
          }),
        ],
      ),
    ];
    const solo = [session(0.1, [lift('Barbell Squat', 2)])];
    const quads = (w: Workout[]) => muscleFatigue(w, NOW).get('quads')!;
    expect(quads(two).acuteDays ?? 0).toBeGreaterThanOrEqual(quads(solo).acuteDays ?? 0);
    expect(quads(two).score).toBeGreaterThan(quads(solo).score);
    expect(acuteCap(3, 12)).toBeGreaterThan(0);
  });

  it('the acute dose is the exact sum of the lift and the block of that session', () => {
    // 3 working sets of squat + a block worth 6 × 10 / 10 × 0.5 = 3 equivalent sets on quads = dose 6
    const blockSets = (6 * 10) / BLOCK_REPS_PER_SET;
    const blockDose = blockSets * BLOCK_LOAD_WEIGHT;
    const mixed = [
      session(
        0.1,
        [lift('Barbell Squat', 3)],
        [
          blk({
            members: [{ name: 'Goblet Squat', reps: '10' }],
            result: { rounds: 6, savedAt: 1 },
          }),
        ],
      ),
    ];
    const quads = LANDMARKS.quads!;
    const lm = new Map([['quads' as const, quads]]);
    const f = muscleFatigue(mixed, NOW, lm).get('quads')!;
    const expected = acuteFatigueScore(
      0.1,
      3 + blockDose,
      RECOVERY_DAYS.quads ?? 2,
      quads.mav,
      NOW,
    );
    // the acute term is the one that sets the score here, and it reads dose = lift + block, not the block alone
    expect(f.score).toBeCloseTo(expected, 9);
    const blockOnly = acuteFatigueScore(0.1, blockDose, RECOVERY_DAYS.quads ?? 2, quads.mav, NOW);
    expect(expected).not.toBeCloseTo(blockOnly, 3);
  });

  it('secondary muscles of a block load readiness at the secondary weight', () => {
    const w = session(1, [], [blk()]); // 8 rounds × 5 pullups: lats primary 2, biceps secondary 2
    const load = blockMuscleLoad(w);
    const sec = load.get('biceps')!.secondary;
    expect(sec).toBeGreaterThan(0);
    const r = muscleReadiness([w], NOW);
    expect(r.get('lats')!.lastDose).toBeCloseTo(load.get('lats')!.primary, 6);
    expect(r.get('biceps')!.lastDose).toBeCloseTo(sec * SECONDARY_SET_WEIGHT, 6);
    // and the lift dose of the same session adds to the secondary one
    const both = session(1, [lift('Barbell Row', 3)], [blk()]);
    const bothDose = muscleReadiness([both], NOW).get('biceps')!.lastDose;
    const liftOnly = muscleReadiness([session(1, [lift('Barbell Row', 3)])], NOW).get(
      'biceps',
    )!.lastDose;
    expect(bothDose).toBeCloseTo(liftOnly + sec * SECONDARY_SET_WEIGHT, 6);
  });

  it('volume, load window, sets and tonnage are untouched by blocks', () => {
    const w = withBlock[0];
    const w0 = without[0];
    expect([...muscleSetsInWorkout(w)]).toEqual([...muscleSetsInWorkout(w0)]);
    expect([...recentLoadSets([w], NOW)]).toEqual([...recentLoadSets([w0], NOW)]);
    expect([...weeklyMuscleSets([w], NOW, 7)]).toEqual([...weeklyMuscleSets([w0], NOW, 7)]);
    expect(workoutSets(w)).toBe(workoutSets(w0));
    expect(workoutVolumeKg(w)).toBe(workoutVolumeKg(w0));
  });

  it('Time blocks not installed: the same numbers as a history without the blocks', () => {
    addonsPref.set(['fatigue', 'readiness', 'advanced-training']);
    expect([...muscleFatigue(withBlock, NOW)]).toEqual([...muscleFatigue(without, NOW)]);
    expect([...muscleReadiness(withBlock, NOW)]).toEqual([...muscleReadiness(without, NOW)]);
  });
});
