import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COACH_SCREENS,
  MORE_SCREENS,
  RAIL_SCREENS,
  TAB_SCREENS,
  chatRoute,
  coachEntryHash,
  coachHash,
  isCoachDashHash,
  navScreenOf,
  parseCoachHash,
  readLastCoachRoute,
  rememberCoachRoute,
  type CoachRoute,
} from './routes';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('coach routes', () => {
  it('uses #/c, never the advice view prefix #/coach', () => {
    expect(isCoachDashHash('#/c')).toBe(true);
    expect(isCoachDashHash('#/c/agenda')).toBe(true);
    expect(isCoachDashHash('#/c/clients/abc?x=1')).toBe(true);
    expect(isCoachDashHash('#/coach')).toBe(false);
    expect(isCoachDashHash('#/coach/today')).toBe(false);
    expect(isCoachDashHash('#/clients')).toBe(false);
    expect(isCoachDashHash('')).toBe(false);
  });

  it.each(COACH_SCREENS)('round-trips %s', (screen) => {
    const r: CoachRoute = { screen };
    expect(coachHash(r)).toBe(`#/c/${screen}`);
    expect(parseCoachHash(coachHash(r))).toEqual(r);
  });

  it('round-trips a client page and tab, encoding the id', () => {
    const r: CoachRoute = { screen: 'client', cid: 'a/b c', tab: 'strength' };
    expect(coachHash(r)).toBe('#/c/clients/a%2Fb%20c/strength');
    expect(parseCoachHash(coachHash(r))).toEqual(r);
    expect(parseCoachHash('#/c/clients/abc')).toEqual({ screen: 'client', cid: 'abc' });
  });

  it('falls back to the Agenda for unknown screens, bare prefix and bad escapes', () => {
    expect(parseCoachHash('#/c')).toEqual({ screen: 'agenda' });
    expect(parseCoachHash('#/c/nope')).toEqual({ screen: 'agenda' });
    expect(parseCoachHash('#/today')).toEqual({ screen: 'agenda' });
    expect(parseCoachHash('#/c/today')).toEqual({ screen: 'agenda' }); // the old name keeps working
    expect(parseCoachHash('#/c/today?view=stage')).toEqual({ screen: 'agenda' });
    expect(parseCoachHash('#/c/clients/%E0%A4%A')).toEqual({ screen: 'client', cid: '%E0%A4%A' });
  });

  it('ignores the query string', () => {
    expect(parseCoachHash('#/c/schedule?week=2026-10-05')).toEqual({ screen: 'schedule' });
  });

  it('nav layout: seven rail items, four tabs + More, five More entries (R-FE-002)', () => {
    expect(RAIL_SCREENS).toEqual([
      'agenda',
      'clients',
      'schedule',
      'week',
      'decisions',
      'programs',
      'chat',
    ]);
    expect(TAB_SCREENS).toEqual(['agenda', 'clients', 'schedule', 'chat']);
    expect(MORE_SCREENS).toEqual(['week', 'decisions', 'programs', 'live', 'signals']);
    for (const s of [...RAIL_SCREENS, ...TAB_SCREENS, ...MORE_SCREENS])
      expect(COACH_SCREENS).toContain(s);
  });

  it('a client page lights Clients', () => {
    expect(navScreenOf({ screen: 'client', cid: 'x' })).toBe('clients');
    expect(navScreenOf({ screen: 'chat' })).toBe('chat');
  });

  it('remembers the last route for the mode switch round trip', () => {
    expect(coachEntryHash()).toBe('#/c/agenda');
    rememberCoachRoute({ screen: 'decisions' });
    expect(readLastCoachRoute()).toEqual({ screen: 'decisions' });
    expect(coachEntryHash()).toBe('#/c/decisions');
  });

  it('works without storage (blocked / private window)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => rememberCoachRoute({ screen: 'week' })).not.toThrow();
    expect(readLastCoachRoute()).toEqual({ screen: 'agenda' });
  });

  it('ignores a corrupt stored value', () => {
    localStorage.setItem('coach:last', '#/people/clients');
    expect(readLastCoachRoute()).toEqual({ screen: 'agenda' });
  });

  it('opens chat on one client thread: Message / Ask buttons carry the client (verify iter 15)', () => {
    expect(coachHash(chatRoute('c1'))).toBe('#/c/chat?with=c1');
    expect(parseCoachHash('#/c/chat?with=c1')).toEqual({ screen: 'chat', with: 'c1' });
    expect(parseCoachHash(coachHash(chatRoute('a b')))).toEqual(chatRoute('a b'));
    expect(parseCoachHash('#/c/chat')).toEqual({ screen: 'chat' });
    expect(coachHash({ screen: 'chat' })).toBe('#/c/chat');
    expect(navScreenOf(chatRoute('c1'))).toBe('chat');
  });
});
