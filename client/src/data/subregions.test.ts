import { describe, it, expect } from 'vitest';
import {
  FOCUS_MUSCLES,
  SPLIT_GROUPS,
  focusToGroup,
  groupToFocus,
  FOCUS_LIB_IDS,
  FOCUS_LABEL_EN,
  type FocusMuscle,
} from './subregions';

describe('sub-region taxonomy', () => {
  it('folds every fine id back to a coarse group', () => {
    for (const f of FOCUS_MUSCLES) {
      expect(typeof focusToGroup(f)).toBe('string');
    }
  });

  it('splits only shoulders and chest', () => {
    expect(Object.keys(SPLIT_GROUPS).sort()).toEqual(['chest', 'shoulders']);
    expect(groupToFocus('shoulders')).toEqual(['delt-front', 'delt-side', 'delt-rear']);
    expect(groupToFocus('chest')).toEqual(['chest-upper', 'chest-lower']);
  });

  it('maps the delt heads and chest regions to the right coarse group', () => {
    expect(focusToGroup('delt-side')).toBe('shoulders');
    expect(focusToGroup('delt-rear')).toBe('shoulders');
    expect(focusToGroup('chest-upper')).toBe('chest');
    expect(focusToGroup('abs')).toBe('core');
  });

  it('round-trips non-split groups through a single fine id', () => {
    expect(groupToFocus('quads')).toEqual(['quads']);
    expect(groupToFocus('lats')).toEqual(['lats']);
    // groups with no fine representation return nothing
    expect(groupToFocus('fullbody')).toEqual([]);
    expect(groupToFocus('cardio')).toEqual([]);
  });

  it('gives library render ids for the split sub-regions only', () => {
    expect(FOCUS_LIB_IDS['delt-side']!.front).toContain('shoulder-side-left');
    expect(FOCUS_LIB_IDS['delt-rear']!.back).toContain('deltoid-rear-left');
    expect(FOCUS_LIB_IDS['chest-upper']!.front).toContain('chest-upper-left');
    // non-split fine ids intentionally have no direct entry
    expect(FOCUS_LIB_IDS['quads' as FocusMuscle]).toBeUndefined();
  });

  it('labels every fine id', () => {
    for (const f of FOCUS_MUSCLES) expect(FOCUS_LABEL_EN[f]).toBeTruthy();
  });
});
