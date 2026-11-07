import { beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from './enabledSet';
import { defaultApp, defaultAppHash } from './defaultApp';

beforeEach(() => addonsPref.reset());

describe('default app by role (owner rule 07.11)', () => {
  it('member: always Gym', () => {
    expect(defaultApp('member')).toBe('gym');
    expect(defaultAppHash('member')).toBe('#/today');
  });
  it('trainer: Coach until Gym is installed, then Gym', () => {
    expect(defaultApp('trainer')).toBe('coach');
    addonsPref.set(['gym']);
    expect(defaultApp('trainer')).toBe('gym');
  });
  it('admin: Users with neither, Coach when only Coach, Gym when Gym (alone or with Coach)', () => {
    expect(defaultApp('admin')).toBe('roster');
    expect(defaultAppHash('admin')).toBe('#/people/users');
    addonsPref.set(['coach']);
    expect(defaultApp('admin')).toBe('coach');
    addonsPref.set(['coach', 'gym']);
    expect(defaultApp('admin')).toBe('gym');
    addonsPref.set(['gym']);
    expect(defaultApp('admin')).toBe('gym');
  });
});
