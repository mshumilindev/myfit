import { describe, expect, it } from 'vitest';
import { legendKeyOf, parseHidden, serializeHidden, toggleHidden } from './legend';
import { readScheduleParams, writeScheduleParams } from './useScheduleParams';
import type { ScheduleSlot } from './types';

const slot = (status: ScheduleSlot['status']) => ({ status }) as ScheduleSlot;

describe('legend filters', () => {
  it('maps a session to its legend key', () => {
    expect(legendKeyOf(slot('planned'))).toBe('planned');
    expect(legendKeyOf(slot('pending-move'))).toBe('planned');
    expect(legendKeyOf(slot('done'))).toBe('done');
    expect(legendKeyOf(slot('missed'))).toBe('missed');
    expect(legendKeyOf(slot('moved'))).toBe('proposed');
    expect(legendKeyOf(slot('planned'), true)).toBe('proposed');
  });
  it('parses, ignores unknown words and serialises in a stable order', () => {
    expect([...parseHidden('missed, nope,done')].sort()).toEqual(['done', 'missed']);
    expect(serializeHidden(parseHidden('missed,done'))).toBe('done,missed');
    expect(serializeHidden(new Set())).toBeNull();
    expect(parseHidden(null).size).toBe(0);
  });
  it('toggles one key', () => {
    const h = parseHidden('done');
    expect(toggleHidden(h, 'missed')).toBe('done,missed');
    expect(toggleHidden(h, 'done')).toBeNull();
  });
  it('lives in the hash query, so a refresh keeps it', () => {
    const hash = writeScheduleParams('#/c/schedule', { hide: 'done,overlap', view: 'day' });
    expect(hash).toBe('#/c/schedule?view=day&hide=done%2Coverlap');
    expect(readScheduleParams(hash).hide).toBe('done,overlap');
    expect(readScheduleParams('#/c/schedule').hide).toBeNull();
  });
});
