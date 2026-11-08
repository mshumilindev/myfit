import { beforeEach, describe, expect, it } from 'vitest';
import {
  addonsPref,
  isAddonAllowed,
  isAddonBase,
  isAddonUnlocked,
  resolveEnabled,
} from '../addons/enabledSet';
import { coachRouteAddon } from './routes';

// Owner 08.11: the base Coach is clients, chat, agenda, decisions, schedule, week and programs; Live, Signals, Notes and Team are add-ons.
describe('Coach extras', () => {
  beforeEach(() => addonsPref.reset());
  it('a route needs its add-on only for Live, Signals and Team (and the client Live tab)', () => {
    expect(coachRouteAddon({ screen: 'live' })).toBe('coach-live');
    expect(coachRouteAddon({ screen: 'signals' })).toBe('coach-signals');
    for (const s of ['team', 'activity', 'roles'] as const)
      expect(coachRouteAddon({ screen: s })).toBe('coach-team');
    expect(coachRouteAddon({ screen: 'client', cid: 'c1', tab: 'live' })).toBe('coach-live');
    // the platform's own messages are never behind an add-on
    expect(coachRouteAddon({ screen: 'spotter' })).toBeNull();
    for (const s of [
      'agenda',
      'clients',
      'schedule',
      'week',
      'decisions',
      'programs',
      'chat',
    ] as const)
      expect(coachRouteAddon({ screen: s })).toBeNull();
    expect(coachRouteAddon({ screen: 'client', cid: 'c1', tab: 'notes' })).toBeNull();
  });
  it('trainer and admin can install them; a member never has them', () => {
    for (const id of ['coach-live', 'coach-signals', 'coach-notes', 'coach-team']) {
      expect(isAddonAllowed(id, 'trainer')).toBe(true);
      expect(isAddonAllowed(id, 'admin')).toBe(true);
      expect(isAddonAllowed(id, 'member')).toBe(false);
    }
  });
  it('they wait for Coach: base for a trainer, installed first for an admin', () => {
    expect(isAddonUnlocked('coach-live', new Set(), 'trainer')).toBe(true);
    expect(isAddonUnlocked('coach-live', new Set(), 'admin')).toBe(false);
    expect(isAddonUnlocked('coach-live', new Set(['coach']), 'admin')).toBe(true);
    addonsPref.set(['coach-live']);
    expect(resolveEnabled(addonsPref.snapshot(), 'admin').has('coach-live')).toBe(false);
    addonsPref.set(['coach', 'coach-live']);
    expect(resolveEnabled(addonsPref.snapshot(), 'admin').has('coach-live')).toBe(true);
  });
  it('a member is never gated by them (they do not open the coach screens)', () => {
    for (const id of ['coach-live', 'coach-signals', 'coach-notes', 'coach-team'])
      expect(isAddonBase(id, 'member')).toBe(true);
  });
  it('Team is base for a manager, the other three are not theirs', () => {
    expect(isAddonBase('coach-team', 'manager')).toBe(true);
    expect(isAddonBase('coach-live', 'manager')).toBe(false);
  });
});
