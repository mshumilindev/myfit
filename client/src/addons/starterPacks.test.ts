import { beforeEach, describe, expect, it } from 'vitest';
import { addonsPref, enableAddons, resolveEnabled } from './enabledSet';
import { INVITE_SEEN, inviteDue, markInviteSeen } from './startInvite';
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
  it('is not due for a manager, after it was seen, or once anything is installed', () => {
    expect(inviteDue([], new Set(), 'manager')).toBe(false);
    expect(inviteDue([INVITE_SEEN], new Set(), 'member')).toBe(false);
    expect(inviteDue([], new Set(['sleep']), 'member')).toBe(false);
  });
  it('the seen marker survives later installs and never counts as an add-on', () => {
    markInviteSeen();
    enableAddons(['sleep'], 'member');
    const list = addonsPref.snapshot().list;
    expect(list).toContain(INVITE_SEEN);
    expect(resolveEnabled(addonsPref.snapshot(), 'member').has(INVITE_SEEN)).toBe(false);
  });
});
