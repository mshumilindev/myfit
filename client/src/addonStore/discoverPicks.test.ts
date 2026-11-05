import { beforeEach, describe, expect, it } from 'vitest';
import { appOfTheWeek, categoryCount, nextSoon, starterPack, suggestion } from './discoverPicks';

const none = { role: 'member' as const, enabled: new Set<string>(), queued: [] as string[] };
beforeEach(() => undefined);

describe('discover picks', () => {
  it('App of the week is the best app not installed — and stays when picked', () => {
    expect(appOfTheWeek(none)?.id).toBe('health');
    expect(appOfTheWeek({ ...none, queued: ['health'] })?.id).toBe('health');
    expect(appOfTheWeek({ ...none, enabled: new Set(['health']) })?.id).toBe('atlas');
  });
  it('starter pack: the Recovery trio until fewer than two are left', () => {
    expect(starterPack(none)?.left).toEqual(['health', 'injury-log', 'sleep']);
    expect(starterPack({ ...none, enabled: new Set(['health']) })?.left).toEqual([
      'injury-log',
      'sleep',
    ]);
    expect(starterPack({ ...none, enabled: new Set(['health', 'injury-log']) })).toBeNull();
    expect(starterPack({ ...none, role: 'manager' })).toBeNull();
  });
  it('suggests an add-on only of an installed app', () => {
    expect(suggestion(none)).toBeNull();
    const s = suggestion({ ...none, enabled: new Set(['health']) });
    expect(s?.parent.id).toBe('health');
    expect(s?.item.parent).toBe('health');
  });
  it('coming soon and category count come from the role catalog', () => {
    expect(nextSoon('member')?.soon).toBe(true);
    expect(categoryCount('member')).toBeGreaterThan(2);
    expect(nextSoon('manager')).toBeNull();
    expect(categoryCount('manager')).toBe(0);
  });
});
