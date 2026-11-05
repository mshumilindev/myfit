import { describe, expect, it } from 'vitest';
import { recommend } from './recommend';

describe('recommendations', () => {
  it('starts a new member with apps by value and keeps going to the last one', () => {
    const all = recommend('member', new Set(), []);
    expect(all.slice(0, 3)).toEqual(['health', 'atlas', 'sleep']);
    expect(all).not.toContain('injury-log'); // an add-on needs its app first
    expect(all).not.toContain('nutrition'); // coming soon
  });
  it('puts add-ons of an installed or picked app first', () => {
    const r = recommend('member', new Set(['health']), []);
    expect(r.slice(0, 4)).toEqual(['injury-log', 'cycle', 'supplements', 'nicotine-alcohol']);
    expect(recommend('member', new Set(), ['health'])[0]).toBe('injury-log');
  });
  it('drops what is installed, picked or skipped and ends when nothing is left', () => {
    const r = recommend('member', new Set(['health']), ['atlas'], { skip: ['sleep'] });
    expect(r).not.toContain('health');
    expect(r).not.toContain('atlas');
    expect(r).not.toContain('sleep');
    const everything = new Set(recommend('member', new Set(), []).concat(['health']));
    // closing over parents: all apps installed, all add-ons installed
    expect(
      recommend(
        'member',
        new Set([
          ...everything,
          'injury-log',
          'cycle',
          'supplements',
          'nicotine-alcohol',
          'sleep-auto-start',
          'sleep-sounds',
        ]),
        [],
      ),
    ).toEqual([]);
  });
  it('respects the limit and the role', () => {
    expect(recommend('member', new Set(), [], { limit: 2 })).toHaveLength(2);
    expect(recommend('trainer', new Set(), [])).toContain('gyms');
    expect(recommend('manager', new Set(), [])).toEqual([]);
  });
});
