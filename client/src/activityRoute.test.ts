/** The Activity trends page: #/trends/activity (entered from the Overview tile). */
import { describe, expect, it } from 'vitest';
import { fromHash, progressFromHash, toHash } from './App';

const hash = (sub: 'progress' | 'trends' | 'activity') =>
  toHash('progress', null, 'mine' as never, false, sub, 'total' as never, 'volume' as never);

describe('#/trends/activity', () => {
  it('formats and parses, next to the Trends tab', () => {
    expect(hash('activity')).toBe('#/trends/activity');
    expect(hash('trends')).toBe('#/trends');
    expect(progressFromHash('#/trends/activity').sub).toBe('activity');
    expect(progressFromHash('#/trends').sub).toBe('trends');
    expect(fromHash('#/trends/activity')).toEqual({ tab: 'progress', overlay: null });
  });
});
