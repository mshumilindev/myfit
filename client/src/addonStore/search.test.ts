import { describe, expect, it } from 'vitest';
import { addonStoreEn } from '../i18n/addonStore.en';
import { fold, highlightParts, MIN_QUERY, searchItems } from './search';

const st = addonStoreEn as never;

describe('store search', () => {
  it('waits for three characters', () => {
    expect(MIN_QUERY).toBe(3);
    expect(searchItems('member', 'sl', st)).toEqual([]);
    expect(searchItems('member', '  s ', st)).toEqual([]);
  });
  it('ranks a name that starts with the query first, then names, parents, descriptions', () => {
    const ids = searchItems('member', 'sle', st);
    expect(ids[0]).toBe('sleep');
  });
  it('finds through the parent app name and the category', () => {
    expect(searchItems('member', 'health', st)).toContain('health');
    expect(searchItems('member', 'health', st)).not.toContain('injury-log');
    expect(searchItems('member', 'apex', st)).toContain('apex');
    expect(searchItems('member', 'mastery', st)).not.toContain('mastery');
    expect(searchItems('member', 'recovery', st)).toContain('sleep');
  });
  it('is case- and diacritic-insensitive', () => {
    expect(fold('Łódź Ünï')).toBe('łodz uni');
    expect(searchItems('member', 'ATLAS', st)).toContain('atlas');
  });
  it('shows a role only its own items', () => {
    expect(searchItems('trainer', 'gyms', st)).not.toContain('gyms');
    expect(searchItems('member', 'gyms', st)).not.toContain('gyms');
    expect(searchItems('member', 'atlas', st)).toContain('atlas');
    expect(searchItems('manager', 'sleep', st)).toEqual([]);
  });
  it('splits text around every match for highlighting', () => {
    expect(highlightParts('Sleep sounds', 'sle')).toEqual([
      { text: 'Sle', hit: true },
      { text: 'ep sounds', hit: false },
    ]);
    expect(highlightParts('Sleep', 'zz')).toEqual([{ text: 'Sleep', hit: false }]);
    expect(highlightParts('Sleep', 'sl')).toEqual([{ text: 'Sleep', hit: false }]);
  });
});
