import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { firstOrder, setOverrideUid, withFirst } from './accountOverrides';
import { setLocale, t } from './i18n';

const VALERIIA = 'dec4b283-ecd4-4e56-8f14-0a5da352f1a2';

beforeEach(() => setLocale('en'));
afterEach(() => {
  setOverrideUid(null);
  setLocale('en');
});

describe('account overrides', () => {
  it('renames badminton only for that account, in every locale', () => {
    expect(t().actType.badminton).toBe('Badminton');
    setOverrideUid(VALERIIA);
    expect(t().actType.badminton).toBe('Table badminton');
    setLocale('uk');
    expect(t().actType.badminton).toBe('Настільний бадмінтон');
    for (const loc of ['pl', 'lt', 'et'] as const) {
      setLocale(loc);
      expect(t().actType.badminton).not.toBe('Badminton');
    }
    setOverrideUid('someone-else');
    setLocale('en');
    expect(t().actType.badminton).toBe('Badminton');
  });

  it('puts badminton first for that account only', () => {
    expect(withFirst(['run', 'dance'])).toEqual(['run', 'dance']);
    setOverrideUid(VALERIIA);
    expect(withFirst(['run', 'badminton', 'dance'])).toEqual(['badminton', 'run', 'dance']);
    expect(firstOrder([{ key: 'tennis' }, { key: 'badminton' }]).map((x) => x.key)).toEqual([
      'badminton',
      'tennis',
    ]);
  });
});
