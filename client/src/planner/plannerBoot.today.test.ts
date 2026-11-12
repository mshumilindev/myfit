/** SPO-552 I11: what the boot hands the Today screen: the widget body (card and inline in the week card). */
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  getStoreState: () => ({ restPeriods: [], injuries: [] }),
  republishCoachShare: vi.fn(),
  subscribeStore: () => () => undefined,
}));
vi.mock('./sync', async (orig) => ({
  ...(await orig<typeof import('./sync')>()),
  getPlans: () => [],
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

describe('plannerBoot: Today slots', () => {
  it('provides the widget body', () => {
    expect(plannerHost.UpNext).toBeTruthy();
  });
});
