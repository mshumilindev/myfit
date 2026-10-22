import { describe, expect, it } from 'vitest';
import {
  FEATURE_OF,
  LOCAL_CATEGORIES,
  SHARE_GROUPS,
  SHARE_IDS,
  allOffLevels,
  allowedLevels,
  buildSummary,
  clampLevel,
  isStaleGrant,
  localsToStop,
  rowBlock,
  sharedCountAll,
  sharesNothingAll,
  stoppedLevels,
  type ShareLevels,
} from './shareModel';

const lv = (p: Partial<ShareLevels>): ShareLevels => ({ ...allOffLevels(), ...p });

describe('share model', () => {
  it('ten settings in three groups; nutrition sits in Body (Q5)', () => {
    expect(SHARE_IDS).toHaveLength(10);
    expect(SHARE_GROUPS.map((g) => g.id)).toEqual(['training', 'body', 'life']);
    expect(SHARE_GROUPS.find((g) => g.id === 'body')?.ids).toContain('nutrition');
    expect(SHARE_GROUPS.flatMap((g) => g.ids).sort()).toEqual([...SHARE_IDS].sort());
  });

  it('only Alcohol has no Full (Q2); the stored level of an old build is clamped', () => {
    for (const id of SHARE_IDS)
      expect(allowedLevels(id)).toEqual(
        id === 'alcohol' ? ['off', 'effects'] : ['off', 'effects', 'full'],
      );
    expect(clampLevel('alcohol', 'full')).toBe('off'); // same as the normaliser and the publisher (B7)
    expect(clampLevel('alcohol', 'effects')).toBe('effects');
    expect(clampLevel('nicotine', 'full')).toBe('full');
  });

  it('the summary covers all ten: only health shared is not "nothing"', () => {
    const only = lv({ conditions: 'effects', alcohol: 'effects' });
    expect(sharesNothingAll(only)).toBe(false);
    expect(buildSummary(only)).toEqual({ effects: ['conditions', 'alcohol'], full: [] });
    expect(sharesNothingAll(allOffLevels())).toBe(true);
  });

  it('the summary keeps the order of the page and splits by level', () => {
    const all = lv({ sleep: 'effects', totals: 'full', nicotine: 'full', body: 'effects' });
    expect(buildSummary(all)).toEqual({ effects: ['body', 'sleep'], full: ['totals', 'nicotine'] });
    expect(sharedCountAll(all)).toBe(4);
  });

  it('a blocked on-device row is never counted; a blocked GRANT row counts by its real level (B2)', () => {
    const l = lv({ nicotine: 'full', injury: 'effects', totals: 'full', nutrition: 'full' });
    const blocks = { nicotine: 'off', injury: 'off', nutrition: 'pending' } as const;
    expect(buildSummary(l, blocks)).toEqual({ effects: ['injury'], full: ['totals', 'nutrition'] });
    expect(sharedCountAll(l, blocks)).toBe(3);
    expect(sharesNothingAll(lv({ injury: 'full' }), { injury: 'off' })).toBe(false);
    expect(sharesNothingAll(lv({ nicotine: 'full' }), { nicotine: 'off' })).toBe(true);
    expect(isStaleGrant('injury', l, blocks)).toBe(true);
    expect(isStaleGrant('nutrition', l, blocks)).toBe(false); // pending is not off
    expect(isStaleGrant('nicotine', l, blocks)).toBe(false); // on-device: handled by Stop's forget
  });

  it('rowBlock follows the consent: workout rows are never blocked, unknown records fail closed', () => {
    const on = { nicotine: true, alcohol: false, injuries: true };
    expect(rowBlock('totals', on, false)).toBeNull();
    expect(rowBlock('nicotine', on, false)).toBe('pending');
    expect(rowBlock('nicotine', on, true)).toBeNull();
    expect(rowBlock('alcohol', on, true)).toBe('off');
    expect(rowBlock('conditions', on, true)).toBe('off');
    expect(Object.keys(FEATURE_OF).sort()).toEqual(
      ['alcohol', 'conditions', 'injury', 'nicotine', 'nutrition', 'supplements'].sort(),
    );
  });

  it('Stop sharing zeroes all ten', () => {
    expect(Object.values(stoppedLevels()).every((l) => l === 'off')).toBe(true);
    expect(Object.keys(stoppedLevels()).sort()).toEqual([...SHARE_IDS].sort());
    expect(sharesNothingAll(stoppedLevels())).toBe(true);
  });

  it('localsToStop lists only the on-device settings above Off, with their level for Undo', () => {
    expect(
      localsToStop({ conditions: 'full', nicotine: 'off', alcohol: 'effects', supplements: 'off' }),
    ).toEqual({ conditions: 'full', alcohol: 'effects' });
    expect(LOCAL_CATEGORIES).toHaveLength(4);
  });
});
