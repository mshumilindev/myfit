import { describe, expect, it } from 'vitest';
import { nextUp, planAlarms, planOfAlarm, HORIZON_MS } from './desktopBridge';
import type { PlanDoc } from './types';

const NOW = Date.UTC(2026, 10, 11, 12, 0, 0);
const plan = (over: Partial<PlanDoc> = {}): PlanDoc =>
  ({
    id: 'p1',
    title: 'Mobility',
    icon: 'bell',
    color: 'accent',
    timing: { kind: 'once', day: '2026-11-11', time: '18:30', tz: 'UTC', lead: 60 },
    mode: 'ring',
    enabled: true,
    nextFireAt: NOW + 3_600_000,
    fireAts: [NOW + 3_600_000],
    v: 1,
    updatedAt: 0,
    ...over,
  }) as unknown as PlanDoc;
const none = new Set<string>();

describe('planAlarms', () => {
  it('lists the next moments with only an id, a time and a mode', () => {
    const [a] = planAlarms([plan()], NOW, none, {});
    expect(a).toEqual({ id: `p1:${NOW + 3_600_000}`, at: NOW + 3_600_000, mode: 'ring' });
    expect(Object.keys(a).sort()).toEqual(['at', 'id', 'mode']);
  });
  it('skips disabled plans, dismissed moments, past ones and ones beyond the horizon', () => {
    const k = `p1:${NOW + 3_600_000}`;
    expect(planAlarms([plan({ enabled: false })], NOW, none, {})).toEqual([]);
    expect(planAlarms([plan()], NOW, new Set([k]), {})).toEqual([]);
    expect(planAlarms([plan({ fireAts: [NOW - 3_600_000] })], NOW, none, {})).toEqual([]);
    expect(planAlarms([plan({ fireAts: [NOW + HORIZON_MS + 1] })], NOW, none, {})).toEqual([]);
  });
  it('a snoozed moment becomes its snooze end', () => {
    const at = NOW - 60_000;
    const until = NOW + 300_000;
    const [a] = planAlarms([plan({ fireAts: [at] })], NOW, none, { [`p1:${at}`]: until });
    expect(a).toEqual({ id: `p1:${at}#${until}`, at: until, mode: 'ring' });
  });
  it('keeps quiet plans too (the shell shows a plain notification)', () => {
    expect(planAlarms([plan({ mode: 'quiet' })], NOW, none, {})[0].mode).toBe('quiet');
  });
});

describe('nextUp', () => {
  it('names the nearest plan by its start time in its own zone', () => {
    const later = plan({
      id: 'p2',
      title: 'Later',
      fireAts: [NOW + 7_200_000],
      nextFireAt: NOW + 7_200_000,
    });
    expect(nextUp([later, plan()], NOW, none)).toBe('Mobility · 14:00');
  });
  it('is empty when nothing is coming', () => {
    expect(nextUp([], NOW, none)).toBeNull();
    expect(nextUp([plan()], NOW, new Set([`p1:${NOW + 3_600_000}`]))).toBeNull();
  });
});

describe('planOfAlarm', () => {
  it('finds the plan of a plain or snoozed alarm id', () => {
    const p = plan();
    expect(planOfAlarm([p], `p1:${NOW}`)).toBe(p);
    expect(planOfAlarm([p], `p1:${NOW}#${NOW + 1}`)).toBe(p);
    expect(planOfAlarm([p], `p10:${NOW}`)).toBeUndefined();
  });
});
