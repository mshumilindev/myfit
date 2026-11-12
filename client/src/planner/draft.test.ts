import { describe, expect, it } from 'vitest';
import { draftToPlan, kindOf, newDraft, planToDraft, repeatOf } from './draft';

describe('plan draft', () => {
  it('round-trips every repeat kind the form offers', () => {
    for (const k of ['none', 'daily', 'weekly', 'weekdays', 'biweekly', 'monthly'] as const) {
      expect(kindOf(repeatOf(k, '2026-11-12'))).toBe(k);
    }
  });
  it('builds a plan with the next reminder time and keeps the series edits on re-save', () => {
    const now = Date.UTC(2026, 10, 11, 12, 0);
    const d = { ...newDraft('p1', '2026-11-12'), title: ' Run ', hour: 18, minute: 30, lead: 30 };
    const plan = draftToPlan(d, 'UTC', undefined, now);
    expect(plan.title).toBe('Run');
    expect(plan.nextFireAt).toBe(Date.UTC(2026, 10, 12, 18, 0));
    const again = draftToPlan(
      planToDraft({ ...plan, timing: { ...plan.timing, skip: ['2026-11-13'] } }),
      'UTC',
      { ...plan, timing: { ...plan.timing, skip: ['2026-11-13'] } },
      now,
    );
    expect(again.timing.skip).toEqual(['2026-11-13']);
  });
  it('a plan in the past has no next reminder', () => {
    const plan = draftToPlan(
      { ...newDraft('p2', '2026-01-01') },
      'UTC',
      undefined,
      Date.UTC(2026, 10, 11),
    );
    expect(plan.nextFireAt).toBeNull();
  });
});

describe('newDraft with the Planner defaults', () => {
  it('starts from the saved reminder, duration and style', () => {
    const d = newDraft('p9', '2026-11-12', { lead: 15, mode: 'ring', durationMin: 90 });
    expect([d.lead, d.mode, d.durationMin]).toEqual([15, 'ring', 90]);
  });
  it('falls back to 60 min / quiet without defaults', () => {
    const d = newDraft('p9', '2026-11-12');
    expect([d.mode, d.durationMin]).toEqual(['quiet', 60]);
  });
});
