import { describe, expect, it } from 'vitest';
import { draftToPlan, newDraft } from './draft';
import { upNextItems } from './upNextModel';
import { zonedToUtc } from './zoned';

const TZ = 'Europe/Warsaw';
const mk = (id: string, day: string, time: string, over: Record<string, unknown> = {}) => {
  const [h, m] = time.split(':').map(Number);
  return draftToPlan(
    { ...newDraft(id, day), title: id, hour: h, minute: m, ...over },
    TZ,
    undefined,
  );
};
const at = (day: string, time: string) => zonedToUtc(day, time, TZ);

describe('upNextItems', () => {
  const now = at('2026-11-12', '10:00');
  it('orders the next moments and drops the ones that are over', () => {
    const plans = [
      mk('late', '2026-11-12', '18:00'),
      mk('past', '2026-11-12', '07:00'),
      mk('soon', '2026-11-12', '12:00'),
    ];
    expect(upNextItems(plans, now).map((i) => i.plan.id)).toEqual(['soon', 'late']);
  });
  it('shows a plan that is running now as ongoing', () => {
    const [i] = upNextItems([mk('run', '2026-11-12', '09:30')], now);
    expect(i.ongoing).toBe(true);
  });
  it('shows a plan that began before midnight and is still running', () => {
    const p = mk('night', '2026-11-11', '23:30', { durationMin: 180 });
    expect(upNextItems([p], at('2026-11-12', '00:30'))[0]?.ongoing).toBe(true);
  });
  it('walks the repeat rule within the week and not beyond', () => {
    const p = mk('daily', '2026-11-01', '08:00', { repeat: 'daily' });
    const days = upNextItems([p], now, 20).map((i) => i.day);
    expect(days[0]).toBe('2026-11-13');
    expect(days.length).toBe(7);
  });
  it('skips paused plans', () => {
    expect(upNextItems([{ ...mk('off', '2026-11-12', '12:00'), enabled: false }], now)).toEqual([]);
  });
  it('respects the limit', () => {
    const plans = ['a', 'b', 'c', 'd'].map((x, k) => mk(x, '2026-11-12', `1${k + 1}:00`));
    expect(upNextItems(plans, now, 2)).toHaveLength(2);
  });
});
