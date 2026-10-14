import { describe, expect, it } from 'vitest';
import { canUseCoach, coachScreenOpen, isCoachRole } from './access';

const ROLES = ['member', 'trainer', 'admin'] as const;

describe('Coach role gate (trainer OR admin, flag on)', () => {
  // role x flag
  it.each([
    ['member', false, false],
    ['member', true, false],
    ['trainer', false, false],
    ['trainer', true, true],
    ['admin', false, false],
    ['admin', true, true],
  ] as const)('%s, flag %s -> %s', (role, flag, expected) => {
    expect(canUseCoach(role, flag)).toBe(expected);
  });

  it('admin has the same rights as a coach', () => {
    expect(isCoachRole('admin')).toBe(isCoachRole('trainer'));
    expect(canUseCoach('admin', true)).toBe(canUseCoach('trainer', true));
  });

  it('unknown / missing roles never pass', () => {
    for (const r of [null, undefined, '', 'owner', 'Trainer']) {
      expect(canUseCoach(r, true)).toBe(false);
    }
  });

  it('routes: a coach hash opens only for an allowed role with the flag on', () => {
    for (const role of ROLES) {
      for (const flag of [false, true]) {
        const allowed = role !== 'member' && flag;
        expect(coachScreenOpen('#/c/agenda', role, flag)).toBe(allowed);
        expect(coachScreenOpen('#/c/clients/x/live', role, flag)).toBe(allowed);
        // The advice view prefix is never the dashboard.
        expect(coachScreenOpen('#/coach', role, flag)).toBe(false);
        expect(coachScreenOpen('#/today', role, flag)).toBe(false);
      }
    }
  });
});
