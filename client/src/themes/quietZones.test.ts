import { describe, expect, it } from 'vitest';
import { QUIET_ZONES, quietZoneAt, routePath } from './quietZones';

describe('routePath', () => {
  it('drops #, query and trailing slash', () => {
    expect(routePath('#/session/ab?x=1')).toBe('/session/ab');
    expect(routePath('#/privacy/')).toBe('/privacy');
    expect(routePath('')).toBe('/');
    expect(routePath('#/')).toBe('/');
  });
});

describe('quiet zones', () => {
  it.each([
    '#/session',
    '#/trainee/a/b',
    '#/activity',
    '#/log-activity/sport',
    '#/workout/w1',
    '#/builder',
    '#/home/set/new',
    '#/sleep',
    '#/coach/live',
    '#/privacy',
    '#/terms/',
    '#/dpa',
    '#/trainer-terms',
    '#/consents',
    '#/health/privacy',
    '#/recap-story/2026-10',
    '#/trainer/chat',
    '#/coach/chat?with=ab',
  ])('%s is quiet', (h) => expect(quietZoneAt(h)).not.toBeNull());

  it.each([
    '#/today',
    '',
    '#/overview',
    '#/progress',
    '#/gyms',
    '#/coach',
    '#/coach/clients',
    '#/themes',
    '#/settings',
  ])('%s is not quiet', (h) => expect(quietZoneAt(h)).toBeNull());

  it('a prefix is not a match (a path that only starts with the same letters)', () => {
    expect(quietZoneAt('#/sessions-archive')).toBeNull();
    expect(quietZoneAt('#/homework')).toBeNull();
  });

  it('every zone has a unique id and a reason', () => {
    const ids = QUIET_ZONES.map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(QUIET_ZONES.every((z) => z.reason)).toBe(true);
  });
});
