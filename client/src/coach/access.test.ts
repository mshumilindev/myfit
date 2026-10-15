import { describe, expect, it } from 'vitest';
import { canUseCoach, coachScreenOpen, isCoachRole } from './access';

const ROLES = ['member', 'trainer', 'admin'] as const;

describe('Coach role gate (trainer OR admin)', () => {
  it.each([
    ['member', false],
    ['trainer', true],
    ['admin', true],
  ] as const)('%s -> %s', (role, expected) => {
    expect(canUseCoach(role)).toBe(expected);
  });

  it('admin has the same rights as a coach', () => {
    expect(isCoachRole('admin')).toBe(isCoachRole('trainer'));
    expect(canUseCoach('admin')).toBe(canUseCoach('trainer'));
  });

  it('unknown / missing roles never pass', () => {
    for (const r of [null, undefined, '', 'owner', 'Trainer']) {
      expect(canUseCoach(r)).toBe(false);
    }
  });

  it('routes: a coach hash opens only for an allowed role', () => {
    for (const role of ROLES) {
      const allowed = role !== 'member';
      expect(coachScreenOpen('#/c/agenda', role)).toBe(allowed);
      expect(coachScreenOpen('#/c/clients/x/live', role)).toBe(allowed);
      // The advice view prefix is never the dashboard.
      expect(coachScreenOpen('#/coach', role)).toBe(false);
      expect(coachScreenOpen('#/today', role)).toBe(false);
    }
  });
});
