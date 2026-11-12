/** SPO-552 I11: what the boot hands the Today screen: the widget body and the week card's "Planner · N today" line. */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { draftToPlan, newDraft } from './draft';
import { zonedToUtc } from './zoned';

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const h = vi.hoisted(() => ({ plans: [] as unknown[] }));
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  getStoreState: () => ({ restPeriods: [], injuries: [] }),
  republishCoachShare: vi.fn(),
  subscribeStore: () => () => undefined,
}));
vi.mock('./sync', async (orig) => ({
  ...(await orig<typeof import('./sync')>()),
  getPlans: () => h.plans,
  getPrefs: () => ({
    shareAvailability: false,
    availability: {},
    defaults: { lead: 60, mode: 'quiet', durationMin: 60 },
  }),
  subscribePlanner: () => () => undefined,
  startPlannerSync: () => () => undefined,
}));

import { plannerHost } from '../plannerRt';

beforeAll(async () => {
  await import('./plannerBoot');
});

const DAY = '2026-11-12';
const now = zonedToUtc(DAY, '10:00', TZ);
const mk = (id: string, time: string) => {
  const [hh, mm] = time.split(':').map(Number);
  return draftToPlan({ ...newDraft(id, DAY), title: id, hour: hh, minute: mm }, TZ, undefined);
};

describe('plannerBoot: Today slots', () => {
  it('provides the widget body', () => {
    expect(plannerHost.UpNext).toBeTruthy();
  });
  it('has no week-card line while nothing is left today', () => {
    h.plans = [mk('early', '07:00')];
    expect(plannerHost.todayLine?.(now, 'en')).toBeNull();
  });
  it('says how many plans are left today, in every language', () => {
    h.plans = [mk('a', '12:00'), mk('b', '18:00')];
    expect(plannerHost.todayLine?.(now, 'en')).toBe('Planner · 2 today');
    expect(plannerHost.todayLine?.(now, 'uk')).toBe('Planner · 2 сьогодні');
    expect(plannerHost.todayLine?.(now, 'pl')).toMatch(/^Planner · 2 /);
  });
});
