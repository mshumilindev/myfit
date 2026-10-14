import { describe, expect, it } from 'vitest';
import { addBareExercise, setRowMode } from './ops';
import { runCheck, weeklyVolume, MUSCLE_BAND } from './check';
import { olehDraft } from './__fixtures__/fixtures';
import { trainingDays } from '../../views/programs/model';
import { toMusclesMode } from '../../tools/programEditor';
import { coachCatalog } from './toolHostBase';

const open = { injury: 'off', restrictions: [] } as const;

describe('Check before sending: the engine', () => {
  it('Oleh: the design example has two items to fix and Send is blocked', () => {
    const c = runCheck(olehDraft(), open);
    expect(c.counts.fix).toBe(2);
    expect(c.blocked).toBe(true);
    expect(c.findings.filter((f) => f.sev === 'fix').every((f) => f.kind === 'range')).toBe(true);
  });

  it('counts reconcile: findings by severity add up', () => {
    const c = runCheck(olehDraft(), open);
    expect(c.counts.fix + c.counts.review + c.counts.note + c.counts.ok).toBe(c.findings.length);
  });

  it('every number is derived: more sets lift a muscle out of "fix"', () => {
    const d = olehDraft();
    const before = weeklyVolume(d).find((v) => v.group === 'calves')!;
    const more = {
      ...d,
      items: d.items.map((i) => (i.name === 'Leg Press' ? { ...i, sets: i.sets + 10 } : i)),
    };
    const after = weeklyVolume(more);
    expect(after.reduce((n, v) => n + v.sets, 0)).toBeGreaterThan(
      weeklyVolume(d).reduce((n, v) => n + v.sets, 0),
    );
    expect(before.band).toEqual(MUSCLE_BAND.calves);
  });

  it('bare rows are listed, never counted, never an error', () => {
    const d = olehDraft();
    const bench = d.items.find((i) => i.name === 'Incline Dumbbell Press')!;
    const bare = setRowMode(d, bench.id, true);
    const full = weeklyVolume(d);
    const less = weeklyVolume(bare);
    expect(less.reduce((n, v) => n + v.sets, 0)).toBeLessThan(full.reduce((n, v) => n + v.sets, 0));
    expect(less.some((v) => v.bareEx.includes('Incline Dumbbell Press'))).toBe(true);
    const c = runCheck(bare, open);
    const note = c.findings.find((f) => f.kind === 'bare');
    expect(note?.sev).toBe('note');
    expect(note?.facts.n).toBe(1);
  });

  it('a muscles day is information, not an error, and counts no sets', () => {
    const d = olehDraft();
    const m = toMusclesMode(d, 6, coachCatalog);
    const c = runCheck(m, open);
    expect(c.findings.find((f) => f.kind === 'musclesDay')?.sev).toBe('note');
    expect(c.findings.some((f) => f.kind === 'emptyDay')).toBe(false);
  });

  it('a day with no muscles and no rows is a blocker', () => {
    const d = toMusclesMode({ ...olehDraft(), targetMuscles: {} }, 6, coachCatalog);
    const empty = { ...d, targetMuscles: { ...d.targetMuscles, '6': [] } };
    expect(trainingDays(empty)).toContain(6);
    expect(
      runCheck(empty, open).findings.some((f) => f.kind === 'emptyDay' && f.sev === 'fix'),
    ).toBe(true);
  });

  it('a restriction conflicts only when the client shared injuries', () => {
    const d = olehDraft();
    const press = {
      ...d,
      items: d.items.map((i) =>
        i.name === 'Barbell Squat' ? { ...i, name: 'Barbell Shoulder Press' } : i,
      ),
    };
    const shared = runCheck(press, { injury: 'effects', restrictions: ['no overhead movement'] });
    expect(shared.findings.some((f) => f.kind === 'restriction' && f.sev === 'fix')).toBe(true);
    const hidden = runCheck(press, { injury: 'off', restrictions: ['no overhead movement'] });
    expect(hidden.findings.some((f) => f.kind === 'restriction')).toBe(false);
  });

  it('a name that is not in the catalog gets the missing-picture review item', () => {
    const d = olehDraft();
    const r = addBareExercise(d, 2, 'Zzyzx unicorn flutter');
    const c = runCheck(r.program, open);
    const pic = c.findings.find((f) => f.kind === 'pictures');
    expect(pic?.sev).toBe('review');
    expect(pic?.facts.names).toContain('Zzyzx unicorn flutter');
  });

  it('fix findings point at a weekday for "Fix in editor"', () => {
    const c = runCheck(olehDraft(), open);
    for (const f of c.findings.filter((x) => x.sev === 'fix' && x.kind !== 'range'))
      expect(f.fix?.day).toBeGreaterThan(0);
  });
});
