import { beforeEach, describe, expect, it } from 'vitest';
import {
  cutOut,
  dayToTs,
  healthItems,
  mergeRanges,
  monthGrid,
  overlappingPeriods,
  presetRange,
  rangesOverlap,
  timelineRows,
  validateRange,
  workoutsInRange,
  ymdToDay,
} from './health';
import {
  __getStateForTests,
  __replaceStateForTests,
  activeRestPeriod,
  restDayKeys,
  dayKey,
  deleteRestPeriod,
  logPastInjury,
  logRestPeriod,
  startInjury,
  updateInjury,
  updateRestPeriod,
} from './store';
import type { Injury, RestPeriod, Workout } from './types';

// Saturday 26 Sep 2026 — the design's "today".
const D = (m: number, d: number) => ymdToDay(2026, m - 1, d);
const TODAY = D(9, 26);
const NOW = new Date(2026, 8, 26, 12, 0).getTime();

const period = (over: Partial<RestPeriod>): RestPeriod => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  startDay: D(9, 1),
  endDay: D(9, 1),
  mode: 'off',
  createdAt: 1,
  ...over,
});

const workout = (id: string, m: number, d: number): Workout => ({
  id,
  startedAt: new Date(2026, m - 1, d, 18, 0).getTime(),
  finishedAt: new Date(2026, m - 1, d, 18, 52).getTime(),
  autoFinished: false,
  dayName: 'Upper body',
  exercises: [],
});

describe('health: day keys', () => {
  it('dayToTs is the inverse of store.dayKey', () => {
    expect(dayKey(dayToTs(TODAY))).toBe(TODAY);
    expect(dayKey(NOW)).toBe(TODAY);
  });

  it('monthGrid pads to the configured week start', () => {
    // 1 Sep 2026 is a Tuesday: one blank cell for a Monday week, two for Sunday.
    expect(monthGrid(2026, 8, 1).slice(0, 2)).toEqual([null, D(9, 1)]);
    expect(monthGrid(2026, 8, 7).slice(0, 3)).toEqual([null, null, D(9, 1)]);
    expect(monthGrid(2026, 8, 1).length % 7).toBe(0);
  });
});

describe('health: range validation', () => {
  it('rejects an end before the start', () => {
    expect(
      validateRange({ startDay: D(9, 18), endDay: D(9, 12) }, { today: TODAY, allowFuture: true }),
    ).toBe('end-before-start');
  });

  it('blocks the future only when logging the past', () => {
    const r = { startDay: D(10, 1), endDay: D(10, 10) };
    expect(validateRange(r, { today: TODAY, allowFuture: true })).toBeNull();
    expect(validateRange(r, { today: TODAY, allowFuture: false })).toBe('future');
  });

  it('an ongoing period must already have started', () => {
    const r = { startDay: D(9, 28), endDay: D(9, 28), open: true };
    expect(validateRange(r, { today: TODAY, allowFuture: true })).toBe('open-future-start');
    expect(
      validateRange({ ...r, startDay: D(9, 24) }, { today: TODAY, allowFuture: false }),
    ).toBeNull();
  });
});

describe('health: overlap detection', () => {
  it('detects shared days, including open-ended periods', () => {
    expect(rangesOverlap({ startDay: 1, endDay: 5 }, { startDay: 5, endDay: 9 })).toBe(true);
    expect(rangesOverlap({ startDay: 1, endDay: 4 }, { startDay: 5, endDay: 9 })).toBe(false);
    expect(
      rangesOverlap({ startDay: 1, endDay: 1, open: true }, { startDay: 50, endDay: 60 }),
    ).toBe(true);
  });

  it('lists overlapping periods but not the one being edited', () => {
    const a = period({ id: 'a', startDay: D(8, 1), endDay: D(8, 10) });
    const b = period({ id: 'b', startDay: D(9, 12), endDay: D(9, 18), mode: 'illness' });
    const r = { startDay: D(8, 5), endDay: D(9, 14) };
    expect(overlappingPeriods(r, [a, b]).map((p) => p.id)).toEqual(['a', 'b']);
    expect(overlappingPeriods(r, [a, b], 'b').map((p) => p.id)).toEqual(['a']);
  });

  it('finds workouts logged inside the range (F04: trained on 14 Sep)', () => {
    const ws = [workout('w1', 9, 14), workout('w2', 9, 20)];
    const hit = workoutsInRange({ startDay: D(9, 12), endDay: D(9, 18) }, ws, TODAY);
    expect(hit.map((w) => w.id)).toEqual(['w1']);
  });
});

describe('health: overlap resolution', () => {
  it('cutOut splits a period around the new range', () => {
    const p = period({ startDay: D(8, 1), endDay: D(8, 10) });
    expect(cutOut(p, { startDay: D(8, 4), endDay: D(8, 6) })).toEqual([
      { startDay: D(8, 1), endDay: D(8, 3) },
      { startDay: D(8, 7), endDay: D(8, 10) },
    ]);
    expect(cutOut(p, { startDay: D(7, 30), endDay: D(8, 12) })).toEqual([]);
  });

  it('mergeRanges unions and keeps an open end', () => {
    expect(
      mergeRanges({ startDay: D(9, 10), endDay: D(9, 14) }, [
        { startDay: D(9, 12), endDay: D(9, 12), open: true },
      ]),
    ).toEqual({ startDay: D(9, 10), endDay: D(9, 14), open: true });
  });
});

describe('health: presets', () => {
  const ctx = { today: TODAY, weekStart: 1 as const, start: D(10, 1) };
  it('past presets end today at the latest', () => {
    expect(presetRange('last3', ctx)).toEqual({ startDay: D(9, 24), endDay: TODAY });
    expect(presetRange('thisWeek', ctx)).toEqual({ startDay: D(9, 21), endDay: TODAY });
    expect(presetRange('lastWeek', ctx)).toEqual({ startDay: D(9, 14), endDay: D(9, 20) });
  });
  it('week presets follow the configured first day', () => {
    expect(presetRange('thisWeek', { ...ctx, weekStart: 7 })).toEqual({
      startDay: D(9, 20),
      endDay: TODAY,
    });
  });
  it('length presets keep the chosen start (F03: 10 days from 1 Oct)', () => {
    expect(presetRange('tenDays', ctx)).toEqual({ startDay: D(10, 1), endDay: D(10, 10) });
  });
});

describe('health: timeline', () => {
  it('draws concurrent periods in two lanes with gaps and month headers', () => {
    const periods = [
      period({ id: 'flu', mode: 'illness', startDay: D(9, 12), endDay: D(9, 18) }),
      period({ id: 'ill', mode: 'illness', startDay: D(9, 24), endDay: D(9, 24), open: true }),
      period({ id: 'vac', startDay: D(8, 1), endDay: D(8, 10) }),
    ];
    const knee: Injury = {
      id: 'knee',
      reason: 'injury',
      bodyPart: 'knee',
      side: 'left',
      muscles: [],
      stage: 'reintroduce',
      startDay: D(9, 20),
      createdAt: 1,
      checkins: [],
    };
    const rows = timelineRows(healthItems(periods, [knee], TODAY), TODAY, D(6, 1));
    const kinds = rows.map((r) => (r.kind === 'item' ? r.item.id : r.kind));
    expect(kinds).toEqual([
      'later',
      'now',
      'ill',
      'knee',
      'month',
      'gap',
      'flu',
      'gap',
      'month',
      'vac',
      'origin',
    ]);
    const ill = rows.find((r) => r.kind === 'item' && r.item.id === 'ill');
    const kn = rows.find((r) => r.kind === 'item' && r.item.id === 'knee');
    expect(ill && ill.kind === 'item' && ill.lane).toBe(0);
    expect(ill && ill.kind === 'item' && ill.through.map((x) => x.kind)).toEqual(['injury']);
    expect(kn && kn.kind === 'item' && kn.lane).toBe(1);
    const gap = rows.find((r) => r.kind === 'gap');
    expect(gap && gap.kind === 'gap' && [gap.from, gap.to]).toEqual([D(9, 19), D(9, 19)]);
  });
});

// --- store ---------------------------------------------------------------------------

function seed(restPeriods: RestPeriod[], workouts: Workout[] = [], injuries: Injury[] = []) {
  __replaceStateForTests({ ...__getStateForTests(), restPeriods, workouts, injuries });
}

describe('store: logRestPeriod', () => {
  beforeEach(() => seed([]));

  it('backfills a closed past illness (12–18 Sep) with a name', () => {
    const res = logRestPeriod(
      { mode: 'illness', startDay: D(9, 12), endDay: D(9, 18), name: ' Flu ' },
      NOW,
    );
    expect(res.ok).toBe(true);
    const saved = __getStateForTests().restPeriods;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      mode: 'illness',
      startDay: D(9, 12),
      endDay: D(9, 18),
      open: false,
      name: 'Flu',
    });
  });

  it('backfills an ongoing illness that started on an earlier day', () => {
    const res = logRestPeriod(
      { mode: 'illness', startDay: D(9, 24), endDay: TODAY, open: true },
      NOW,
    );
    expect(res.ok && res.period.open).toBe(true);
    expect(res.ok && res.period.startDay).toBe(D(9, 24));
  });

  it('refuses the future when logging the past but schedules it when allowed', () => {
    const r = { mode: 'off' as const, startDay: D(10, 1), endDay: D(10, 10) };
    expect(logRestPeriod(r, NOW)).toEqual({ ok: false, reason: 'future' });
    expect(logRestPeriod({ ...r, allowFuture: true }, NOW).ok).toBe(true);
  });

  it('refuses an end before the start', () => {
    expect(logRestPeriod({ mode: 'off', startDay: D(9, 10), endDay: D(9, 5) }, NOW)).toEqual({
      ok: false,
      reason: 'end-before-start',
    });
  });

  it('refuses an unresolved overlap of the same mode', () => {
    seed([period({ id: 'vac', startDay: D(8, 1), endDay: D(8, 10) })]);
    expect(logRestPeriod({ mode: 'off', startDay: D(8, 5), endDay: D(8, 6) }, NOW)).toEqual({
      ok: false,
      reason: 'overlap',
    });
    expect(__getStateForTests().restPeriods).toHaveLength(1);
  });

  it('lets different modes (rest, active, illness) run side by side', () => {
    seed([period({ id: 'vac', startDay: D(8, 1), endDay: D(8, 10) })]);
    expect(logRestPeriod({ mode: 'illness', startDay: D(8, 5), endDay: D(8, 6) }, NOW).ok).toBe(
      true,
    );
    const list = __getStateForTests().restPeriods;
    expect(list).toHaveLength(2);
    expect(list.find((p) => p.id === 'vac')).toMatchObject({ startDay: D(8, 1), endDay: D(8, 10) });
  });

  it('an ongoing illness does not overlap a period that starts after today', () => {
    seed([period({ id: 'trip', startDay: D(10, 3), endDay: D(10, 6) })]);
    expect(
      logRestPeriod({ mode: 'off', startDay: D(9, 20), endDay: D(9, 20), open: true }, NOW).ok,
    ).toBe(true);
  });

  it('replace cuts the new days out of the other same-mode period (split in two)', () => {
    seed([period({ id: 'vac', startDay: D(8, 1), endDay: D(8, 10) })]);
    const res = logRestPeriod(
      { mode: 'off', startDay: D(8, 4), endDay: D(8, 6), overlap: 'replace' },
      NOW,
    );
    expect(res.ok).toBe(true);
    const list = __getStateForTests()
      .restPeriods.map((p) => [p.mode, p.startDay, p.endDay])
      .sort((a, b) => (a[1] as number) - (b[1] as number));
    expect(list).toEqual([
      ['off', D(8, 1), D(8, 3)],
      ['off', D(8, 4), D(8, 6)],
      ['off', D(8, 7), D(8, 10)],
    ]);
  });

  it('merge folds same-mode periods into one', () => {
    seed([period({ id: 'vac', startDay: D(8, 1), endDay: D(8, 10) })]);
    const res = logRestPeriod(
      { mode: 'off', startDay: D(8, 8), endDay: D(8, 14), overlap: 'merge' },
      NOW,
    );
    expect(res.ok).toBe(true);
    const list = __getStateForTests().restPeriods;
    expect(list).toHaveLength(1);
    expect([list[0].startDay, list[0].endDay]).toEqual([D(8, 1), D(8, 14)]);
  });

  it('removes the chosen workouts inside the range (Remove the session)', () => {
    seed([], [workout('w1', 9, 14), workout('w2', 9, 20)]);
    logRestPeriod(
      { mode: 'illness', startDay: D(9, 12), endDay: D(9, 18), removeWorkoutIds: ['w1'] },
      NOW,
    );
    expect(__getStateForTests().workouts.map((w) => w.id)).toEqual(['w2']);
  });
});

describe('store: updateRestPeriod / deleteRestPeriod', () => {
  it('edits a period in place and ignores its own range for overlaps', () => {
    seed([period({ id: 'flu', mode: 'illness', startDay: D(9, 12), endDay: D(9, 18) })]);
    const res = updateRestPeriod(
      'flu',
      { mode: 'illness', startDay: D(9, 11), endDay: D(9, 17), name: 'Flu' },
      NOW,
    );
    expect(res.ok).toBe(true);
    const [p] = __getStateForTests().restPeriods;
    expect(p).toMatchObject({ id: 'flu', startDay: D(9, 11), endDay: D(9, 17), name: 'Flu' });
  });

  it('reports a missing period', () => {
    seed([]);
    expect(updateRestPeriod('x', { mode: 'off', startDay: 1, endDay: 1 }, NOW)).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('deletes a period', () => {
    seed([period({ id: 'a' }), period({ id: 'b' })]);
    deleteRestPeriod('a');
    expect(__getStateForTests().restPeriods.map((p) => p.id)).toEqual(['b']);
  });
});

describe('store: injury backfill', () => {
  beforeEach(() => seed([]));

  it('logs a healed past injury as history', () => {
    const res = logPastInjury(
      { bodyPart: 'knee', side: 'left', startDay: D(8, 2), healedDay: D(8, 30) },
      NOW,
    );
    expect(res.ok).toBe(true);
    const [inj] = __getStateForTests().injuries;
    expect(inj).toMatchObject({ bodyPart: 'knee', side: 'left', startDay: D(8, 2) });
    expect(inj.healedDay).toBe(D(8, 30));
    expect(inj.muscles).toContain('quads');
  });

  it('refuses a healed day before the injury or in the future', () => {
    expect(
      logPastInjury({ bodyPart: 'knee', side: 'left', startDay: D(9, 2), healedDay: D(9, 1) }, NOW),
    ).toEqual({ ok: false, reason: 'healed-before-start' });
    expect(
      logPastInjury(
        { bodyPart: 'knee', side: 'left', startDay: D(9, 2), healedDay: D(10, 1) },
        NOW,
      ),
    ).toEqual({ ok: false, reason: 'future' });
  });

  it('starts a still-healing injury from the day it happened', () => {
    const inj = startInjury({
      reason: 'injury',
      bodyPart: 'knee',
      side: 'left',
      muscles: ['quads'],
      stage: 'reintroduce',
      startDay: D(9, 20),
      now: NOW,
    });
    expect(inj.startDay).toBe(D(9, 20));
    expect(inj.healedDay).toBeNull();
  });

  it('edits an injury (place, dates, healed)', () => {
    const res = logPastInjury(
      { bodyPart: 'knee', side: 'left', startDay: D(8, 2), healedDay: D(8, 30) },
      NOW,
    );
    if (!res.ok) throw new Error('seed');
    const up = updateInjury(
      res.injury.id,
      { bodyPart: 'ankle', side: 'right', startDay: D(8, 3), healedDay: null },
      NOW,
    );
    expect(up.ok).toBe(true);
    const [inj] = __getStateForTests().injuries;
    expect(inj).toMatchObject({ bodyPart: 'ankle', side: 'right', startDay: D(8, 3) });
    expect(inj.healedDay).toBeNull();
    expect(inj.muscles).toContain('calves');
  });
});

describe('store: planning ahead (scheduled rest)', () => {
  beforeEach(() => seed([]));
  const at = (m: number, d: number) => new Date(2026, m - 1, d, 12).getTime();

  it('schedules full rest and active recovery fully in the future', () => {
    const off = logRestPeriod(
      { mode: 'off', startDay: D(9, 28), endDay: D(10, 4), name: 'Vacation', allowFuture: true },
      NOW,
    );
    const act = logRestPeriod(
      { mode: 'active', startDay: D(10, 12), endDay: D(10, 18), allowFuture: true },
      NOW,
    );
    expect(off.ok && act.ok).toBe(true);
    expect(__getStateForTests().restPeriods).toHaveLength(2);
  });

  it('refuses a future illness even when scheduling is allowed', () => {
    expect(
      logRestPeriod(
        { mode: 'illness', startDay: D(9, 28), endDay: D(9, 30), allowFuture: true },
        NOW,
      ),
    ).toEqual({ ok: false, reason: 'future' });
  });

  it('a scheduled period is editable before it starts', () => {
    const r = logRestPeriod(
      { mode: 'off', startDay: D(9, 28), endDay: D(10, 4), allowFuture: true },
      NOW,
    );
    if (!r.ok) throw new Error('seed');
    const up = updateRestPeriod(
      r.period.id,
      { mode: 'active', startDay: D(9, 29), endDay: D(10, 2), allowFuture: true },
      NOW,
    );
    expect(up.ok).toBe(true);
    expect(__getStateForTests().restPeriods[0]).toMatchObject({
      mode: 'active',
      startDay: D(9, 29),
      endDay: D(10, 2),
    });
  });

  it('activates on its start day and pauses only during the range', () => {
    logRestPeriod({ mode: 'off', startDay: D(9, 28), endDay: D(10, 4), allowFuture: true }, NOW);
    expect(activeRestPeriod(at(9, 26))).toBeNull();
    expect(activeRestPeriod(at(9, 27))).toBeNull();
    expect(activeRestPeriod(at(9, 28))?.mode).toBe('off');
    expect(activeRestPeriod(at(10, 4))?.mode).toBe('off');
    expect(activeRestPeriod(at(10, 5))).toBeNull();
    const rest = restDayKeys(__getStateForTests().restPeriods, at(10, 10));
    expect(rest.has(D(9, 27))).toBe(false);
    expect(rest.has(D(9, 28))).toBe(true);
    expect(rest.has(D(10, 5))).toBe(false);
  });
});
