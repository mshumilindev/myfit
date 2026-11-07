import { describe, expect, it } from 'vitest';
import {
  closeDependencies,
  isAddonAllowed,
  isAddonBase,
  isAddonUnlocked,
  removalSet,
} from './enabledSet';

// Owner rule 07.11: a member has Gym out of the box (not in the store, not removable); a trainer has Coach out of the
// box and can install Gym; an admin has neither and can install both. Everything that depends on Gym waits for it.
describe('Gym and Coach by role', () => {
  it('member: Gym is base and never in the store; Coach is not theirs at all', () => {
    expect(isAddonBase('gym', 'member')).toBe(true);
    expect(isAddonAllowed('gym', 'member')).toBe(false);
    expect(isAddonBase('coach', 'member')).toBe(false);
    expect(isAddonAllowed('coach', 'member')).toBe(false);
  });
  it('trainer: Coach is base, Gym is installable', () => {
    expect(isAddonBase('coach', 'trainer')).toBe(true);
    expect(isAddonAllowed('coach', 'trainer')).toBe(false);
    expect(isAddonBase('gym', 'trainer')).toBe(false);
    expect(isAddonAllowed('gym', 'trainer')).toBe(true);
  });
  it('admin: neither is installed, both are installable', () => {
    for (const id of ['gym', 'coach']) {
      expect(isAddonBase(id, 'admin')).toBe(false);
      expect(isAddonAllowed(id, 'admin')).toBe(true);
    }
  });
  it('manager keeps Coach (no store) and has no Gym', () => {
    expect(isAddonBase('coach', 'manager')).toBe(true);
    expect(isAddonBase('gym', 'manager')).toBe(false);
  });
});

describe('what needs Gym', () => {
  const needs = ['activities', 'home-sets', 'goals', 'playbook', 'atlas', 'apex'];
  it('is locked for a trainer and an admin until Gym is installed, never for a member', () => {
    for (const id of needs) {
      expect(isAddonUnlocked(id, new Set(), 'admin')).toBe(false);
      expect(isAddonUnlocked(id, new Set(), 'trainer')).toBe(false);
      expect(isAddonUnlocked(id, new Set(['gym']), 'admin')).toBe(true);
      expect(isAddonUnlocked(id, new Set(), 'member')).toBe(true);
    }
  });
  it('does not count as installed without Gym, modules included, even if stored', () => {
    expect(closeDependencies([...needs, 'mastery', 'health'], 'admin')).toEqual(['health']);
    expect(closeDependencies([...needs, 'gym'], 'trainer').sort()).toEqual(
      [...needs, 'gym'].sort(),
    );
    expect(closeDependencies(needs, 'member')).toContain('activities');
  });
  it('goes away with Gym, with the modules of Apex', () => {
    const gone = removalSet('gym');
    for (const id of [...needs, 'gym', 'mastery', 'apex-ranks']) expect(gone).toContain(id);
    expect(gone).not.toContain('health');
    expect(gone).not.toContain('sleep');
  });
});
