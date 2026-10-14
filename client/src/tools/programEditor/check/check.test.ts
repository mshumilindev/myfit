import { describe, expect, it } from 'vitest';
import { DEMO_ACTIVITIES, demoCatalog, demoDoc } from '../stories/demoHost';
import { emptyDoc, type ProgramDoc } from '../model/doc';
import { addBareExercise, addItem, setRowMode, toMusclesMode } from '../model/ops';
import {
  BUILT_IN_RULES,
  MUSCLE_BAND,
  runCheck,
  weeklyVolume,
  type CheckEnv,
  type CheckRule,
} from './engine';

const env = (over: Partial<CheckEnv> = {}): CheckEnv => ({
  catalog: demoCatalog,
  activities: DEMO_ACTIVITIES,
  ...over,
});

describe('check engine', () => {
  it('counts reconcile and a thin program is blocked', () => {
    const c = runCheck(demoDoc(), env());
    expect(c.counts.fix + c.counts.review + c.counts.note + c.counts.ok).toBe(c.findings.length);
    expect(c.blocked).toBe(c.counts.fix > 0);
    expect(c.findings.filter((f) => f.sev === 'fix').every((f) => f.kind === 'range')).toBe(true);
    // fix first, ok last
    const order = c.findings.map((f) => f.sev);
    expect(order).toEqual(
      [...order].sort(
        (a, b) =>
          ['fix', 'review', 'note', 'ok'].indexOf(a) - ['fix', 'review', 'note', 'ok'].indexOf(b),
      ),
    );
  });

  it('every number is derived: more sets lift the total', () => {
    const d = demoDoc();
    const more = {
      ...d,
      items: d.items.map((i) => (i.name === 'Leg Press' ? { ...i, sets: i.sets + 10 } : i)),
    };
    const sum = (p: ProgramDoc) => weeklyVolume(p, env()).reduce((n, v) => n + v.sets, 0);
    expect(sum(more)).toBeGreaterThan(sum(d));
    expect(weeklyVolume(d, env()).find((v) => v.group === 'calves')!.band).toEqual(
      MUSCLE_BAND.calves,
    );
  });

  it('primary muscle counts a full set, secondaries half', () => {
    let d = emptyDoc();
    d = addItem(d, {
      day: 1,
      name: 'Barbell Bench Press',
      kind: 'strength',
      sets: 10,
      reps: 5,
      durationMin: null,
      equipment: [],
    });
    const v = Object.fromEntries(weeklyVolume(d, env()).map((x) => [x.group, x.sets]));
    expect([v.chest, v.triceps, v.shoulders]).toEqual([10, 5, 5]);
  });

  it('bare rows are listed, never counted, never an error', () => {
    const d = demoDoc();
    const row = d.items.find((i) => i.name === 'Dumbbell Curl')!;
    const bare = setRowMode(d, row.id, true);
    const v = weeklyVolume(bare, env()).find((x) => x.group === 'biceps')!;
    expect(v.bareEx).toContain('Dumbbell Curl');
    const note = runCheck(bare, env()).findings.find((f) => f.kind === 'bare');
    expect(note?.sev).toBe('note');
  });

  it('a muscles day is information, an empty one is a blocker', () => {
    const m = toMusclesMode(demoDoc(), 1, demoCatalog);
    const c = runCheck(m, env());
    expect(c.findings.find((f) => f.kind === 'musclesDay' && f.facts.day === 1)?.sev).toBe('note');
    const empty: ProgramDoc = { ...m, targetMuscles: { ...m.targetMuscles, '1': [] } };
    expect(
      runCheck(empty, env()).findings.some((f) => f.kind === 'emptyDay' && f.sev === 'fix'),
    ).toBe(true);
  });

  it("a restriction conflicts only when the host passes it (consent is the host's)", () => {
    const d = demoDoc();
    const shared = runCheck(d, env({ checkContext: { restrictions: ['no overhead movement'] } }));
    expect(shared.findings.some((f) => f.kind === 'restriction')).toBe(false);
    const press = addBareExercise(d, 1, 'Barbell Shoulder Press', demoCatalog).program;
    expect(
      runCheck(
        press,
        env({ checkContext: { restrictions: ['no overhead movement'] } }),
      ).findings.some((f) => f.kind === 'restriction' && f.sev === 'fix'),
    ).toBe(true);
    expect(
      runCheck(press, env({ checkContext: { restrictions: [] } })).findings.some(
        (f) => f.kind === 'restriction',
      ),
    ).toBe(false);
  });

  it('a custom exercise gets the missing-picture review item', () => {
    const r = addBareExercise(demoDoc(), 1, 'Zottman Curl Variation', demoCatalog);
    const pic = runCheck(r.program, env()).findings.find((f) => f.kind === 'pictures');
    expect(pic?.sev).toBe('review');
    expect(pic?.facts.names).toContain('Zottman Curl Variation');
  });

  it('push/pull uses the catalog force, then the primary muscle', () => {
    const c = runCheck(demoDoc(), env());
    expect(c.pushPull.push).toBeGreaterThan(0);
    expect(c.pushPull.pull).toBeGreaterThan(0);
  });

  it("activities are summed by the host's category", () => {
    let d = demoDoc();
    d = {
      ...d,
      activities: [
        { id: 'a', day: 2, type: 'run', minutes: 40, effort: 'moderate', when: 'any' },
        { id: 'b', day: 4, type: 'yoga', minutes: 20, effort: 'light', when: 'any' },
      ],
    };
    const c = runCheck(d, env());
    expect([c.activities.cardioMin, c.activities.recoveryMin]).toEqual([40, 20]);
  });

  it("rules are the host's to change: add, drop and reorder", () => {
    const d = demoDoc();
    const noPictures = runCheck(
      addBareExercise(d, 1, 'Zottman Curl Variation', demoCatalog).program,
      env({ checkRules: (b) => b.filter((r) => r.id !== 'pictures') }),
    );
    expect(noPictures.findings.some((f) => f.kind === 'pictures')).toBe(false);
    const custom: CheckRule = {
      id: 'tooLong',
      run: ({ doc }) =>
        doc.items.length > 3
          ? [{ id: 'long', kind: 'tooLong', sev: 'fix', facts: { n: doc.items.length } }]
          : [],
    };
    const c = runCheck(d, env({ checkRules: (b) => [...b, custom] }));
    const f = c.findings.find((x) => x.kind === 'tooLong');
    expect(f?.sev).toBe('fix');
    expect(c.blocked).toBe(true);
    expect(BUILT_IN_RULES.map((r) => r.id)).toContain('pictures');
  });

  it('"Fix in editor" lands on the first training day in the host\'s week order', () => {
    let d = emptyDoc();
    for (const day of [1, 7])
      d = addItem(d, {
        day,
        name: 'Barbell Bench Press',
        kind: 'strength',
        sets: 2,
        reps: 5,
        durationMin: null,
        equipment: [],
      });
    const fixDay = (order?: readonly number[]) =>
      runCheck(d, env({ weekOrder: order })).findings.find((f) => f.id === 'range-chest')?.fix?.day;
    expect(fixDay()).toBe(1);
    expect(fixDay([7, 1, 2, 3, 4, 5, 6])).toBe(7);
  });
});
