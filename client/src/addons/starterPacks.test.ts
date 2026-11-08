import { beforeEach, describe, expect, it } from 'vitest';
import { addonsPref, enableAddons, resolveEnabled } from './enabledSet';
import { INVITE_SEEN, inviteDue, markInviteSeen, offerable, snoozeInvite } from './startInvite';
import { headlineOf, packsFor } from './starterPacks';

beforeEach(() => addonsPref.reset());

describe('starter packs', () => {
  it('a member gets three sets, the recommended one adds nothing and Gym is never offered (it is base)', () => {
    const packs = packsFor('member');
    expect(packs.map((p) => p.id)).toEqual(['train', 'recover', 'goal']);
    expect(packs.find((p) => p.recommended)?.ids).toEqual([]);
    expect(packs.flatMap((p) => p.ids)).not.toContain('gym');
  });

  it('a trainer is offered Gym with the coaching add-ons, headline is a coaching item', () => {
    const [coach] = packsFor('trainer');
    expect(coach.recommended).toBe(true);
    expect(coach.ids).toEqual(expect.arrayContaining(['coach-live', 'coach-notes', 'gym']));
    expect(headlineOf(coach)).toBe('coach-live');
  });

  it('a manager has no store, so no sets', () => {
    expect(packsFor('manager')).toEqual([]);
  });

  it('applying a set switches its items on with their parents and nothing else', () => {
    const pack = packsFor('trainer').find((p) => p.id === 'both')!;
    enableAddons([...pack.ids], 'trainer');
    const on = resolveEnabled(addonsPref.snapshot(), 'trainer');
    expect(on.has('gym') && on.has('sleep') && on.has('coach-live')).toBe(true);
    expect(on.has('atlas')).toBe(false);
  });
});

describe('Today invite', () => {
  it('is due while nothing optional is installed and the card was not seen', () => {
    expect(inviteDue([], new Set(), 'member')).toBe(true);
  });
  it('is not due for a manager or after it was seen', () => {
    expect(inviteDue([], new Set(), 'manager')).toBe(false);
    expect(inviteDue([INVITE_SEEN], new Set(), 'member')).toBe(false);
  });
  it('stays due after a first install while substantial items remain, and goes once less than two are left', () => {
    expect(inviteDue([], new Set(['sleep']), 'member')).toBe(true);
    const all = new Set(offerable('member', new Set()));
    expect(inviteDue([], all, 'member')).toBe(false);
    const nearlyAll = new Set([...all].slice(1));
    expect(offerable('member', nearlyAll)).toHaveLength(1);
    expect(inviteDue([], nearlyAll, 'member')).toBe(false);
  });
  it('offers apps and add-ons only: no modules, looks or coming-soon items, none that lack their app', () => {
    const ids = offerable('trainer', new Set());
    expect(ids).not.toContain('nutrition');
    expect(ids).not.toContain('theme-cyberpunk');
    expect(ids).not.toContain('injury-log');
    expect(ids).not.toContain('sleep'); // needs Gym, which a trainer has not installed
    expect(offerable('trainer', new Set(['gym']))).toContain('sleep');
  });
  it('the seen marker survives later installs and never counts as an add-on', () => {
    markInviteSeen();
    enableAddons(['sleep'], 'member');
    const list = addonsPref.snapshot().list;
    expect(list).toContain(INVITE_SEEN);
    expect(resolveEnabled(addonsPref.snapshot(), 'member').has(INVITE_SEEN)).toBe(false);
  });
});

describe('Today invite: not interested', () => {
  const DAY = 24 * 3600 * 1000;
  it('hides for a month, returns, and stops after the third no', () => {
    const t0 = Date.UTC(2026, 10, 8);
    snoozeInvite(t0);
    const list = () => addonsPref.snapshot().list;
    expect(inviteDue(list(), new Set(), 'member', t0 + 29 * DAY)).toBe(false);
    expect(inviteDue(list(), new Set(), 'member', t0 + 31 * DAY)).toBe(true);
    snoozeInvite(t0 + 31 * DAY);
    snoozeInvite(t0 + 62 * DAY);
    expect(list().filter((x) => x.startsWith('later:'))).toHaveLength(1);
    expect(inviteDue(list(), new Set(), 'member', t0 + 400 * DAY)).toBe(false);
  });
  it('the snooze marker survives installs and is never an add-on', () => {
    snoozeInvite(1);
    enableAddons(['sleep'], 'member');
    expect(addonsPref.snapshot().list.some((x) => x.startsWith('later:'))).toBe(true);
    expect(
      [...resolveEnabled(addonsPref.snapshot(), 'member')].some((x) => x.startsWith('later:')),
    ).toBe(false);
  });
});
