import { describe, expect, it } from 'vitest';
import {
  feelToStage,
  applyCheckin,
  consecutiveFine,
  nextStage,
  prevStage,
  loadFactor,
  bodyPart,
  protectedMuscles,
  loadCaps,
  activeInjuries,
} from './injury';
import type { Injury, CheckinFeel, RehabStageId } from './types';

function make(stage: RehabStageId, feels: CheckinFeel[] = []): Injury {
  return {
    id: 'i1',
    reason: 'injury',
    bodyPart: 'knee',
    muscles: ['quads', 'hamstrings', 'calves'],
    stage,
    startDay: 0,
    createdAt: 0,
    checkins: feels.map((feel, i) => ({ id: 'c' + i, day: i, at: i, feel, stage })),
    healedDay: null,
  };
}

describe('feelToStage', () => {
  it('seeds the starting stage from how it feels now', () => {
    expect(feelToStage('cant')).toBe('protect');
    expect(feelToStage('sore')).toBe('reintroduce');
    expect(feelToStage('almost')).toBe('rebuild');
  });
});

describe('stage order', () => {
  it('advances and regresses within bounds', () => {
    expect(nextStage('protect')).toBe('reintroduce');
    expect(nextStage('return')).toBe('return');
    expect(prevStage('protect')).toBe('protect');
    expect(prevStage('rebuild')).toBe('reintroduce');
  });
});

describe('applyCheckin (feel-driven progression)', () => {
  it('pain eases back a stage (never pushes through pain)', () => {
    const res = applyCheckin(make('rebuild'), 'pain');
    expect(res).toEqual({ stage: 'reintroduce', outcome: 'regress' });
  });

  it('pain at the first stage holds (nowhere lower)', () => {
    expect(applyCheckin(make('protect'), 'pain')).toEqual({ stage: 'protect', outcome: 'hold' });
  });

  it('sore holds at the current stage', () => {
    expect(applyCheckin(make('reintroduce'), 'sore')).toEqual({
      stage: 'reintroduce',
      outcome: 'hold',
    });
  });

  it('one good session is not enough — needs two in a row', () => {
    expect(applyCheckin(make('reintroduce', []), 'fine')).toEqual({
      stage: 'reintroduce',
      outcome: 'hold',
    });
  });

  it('two good sessions in a row OFFER the next stage (never automatic)', () => {
    // one prior "fine" this stage + this "fine" = streak 2 → offer (ready)
    const res = applyCheckin(make('reintroduce', ['fine']), 'fine');
    expect(res).toEqual({ stage: 'rebuild', outcome: 'ready' });
  });

  it('a sore check-in breaks the good streak', () => {
    const inj = make('reintroduce', ['fine', 'sore']);
    expect(consecutiveFine(inj)).toBe(0);
    expect(applyCheckin(inj, 'fine')).toEqual({ stage: 'reintroduce', outcome: 'hold' });
  });

  it('return stage cannot advance further', () => {
    expect(applyCheckin(make('return', ['fine']), 'fine')).toEqual({
      stage: 'return',
      outcome: 'hold',
    });
  });
});

describe('load model', () => {
  it('factors ramp Protect(0) → Reintroduce → Rebuild → Return(1)', () => {
    expect(loadFactor('protect')).toBe(0);
    expect(loadFactor('reintroduce')).toBeLessThan(loadFactor('rebuild'));
    expect(loadFactor('return')).toBe(1);
  });

  it('knee protects the muscles that load it', () => {
    expect(bodyPart('knee')?.muscles).toContain('quads');
    expect(bodyPart('knee')?.muscles).toContain('calves');
  });

  it('protectedMuscles are only the Protect-stage injuries', () => {
    const protectedSet = protectedMuscles([make('protect'), make('rebuild')]);
    expect(protectedSet.has('quads')).toBe(true);
    // rebuild-stage muscles are capped, not fully protected
    const caps = loadCaps([make('rebuild')]);
    expect(caps.get('quads')).toBe(loadFactor('rebuild'));
  });

  it('healed injuries drop out of active selectors', () => {
    const healed = { ...make('protect'), healedDay: 5 };
    expect(activeInjuries([healed])).toHaveLength(0);
    expect(protectedMuscles([healed]).size).toBe(0);
  });
});
