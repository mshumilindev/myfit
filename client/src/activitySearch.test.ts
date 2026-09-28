import { describe, expect, it } from 'vitest';
import { normalize, searchActivities } from './activitySearch';
import { en } from './i18n/en';
import { uk } from './i18n/uk';
import { pl } from './i18n/pl';
import { lt } from './i18n/lt';
import { et } from './i18n/et';

const others = [en.actType, uk.actType, pl.actType, lt.actType, et.actType];

function keys(q: string, names: Record<string, string> = en.actType) {
  return searchActivities(q, { names, otherNames: others }).map((h) => h.key);
}

describe('normalize', () => {
  it('folds case, diacritics and dashes', () => {
    expect(normalize('  Ping-Pong ')).toBe('ping pong');
    expect(normalize('Pływanie')).toBe('plywanie');
    expect(normalize('Šokiai')).toBe('sokiai');
    expect(normalize('Sõudmine')).toBe('soudmine');
  });
});

describe('searchActivities', () => {
  it('matches names with a highlight range (design m05 "bo")', () => {
    const hits = searchActivities('bo', { names: en.actType, otherNames: others });
    const boxing = hits.find((h) => h.key === 'boxing');
    expect(boxing?.range).toEqual([0, 2]);
    const snow = hits.find((h) => h.key === 'snowboard');
    expect(snow?.range).toEqual([4, 6]);
    const climb = hits.find((h) => h.key === 'climbgym');
    expect(climb?.via).toBe('Bouldering');
    expect(climb?.viaRange).toEqual([0, 2]);
    expect(climb?.range).toBeNull();
  });

  it('synonyms', () => {
    // Indoor wall vs outdoor rock are separate types.
    expect(keys('bouldering')).toContain('climbgym');
    expect(keys('скеледром')).toContain('climbgym');
    expect(keys('rock climbing')).toContain('climbing');
    // "jog" is also the start of Polish "Joga" — the whole-word synonym ranks first.
    expect(keys('jog')[0]).toBe('run');
    expect(keys('jogging')).toEqual(['run']);
    expect(keys('ping pong')).toEqual(['tabletennis']);
    expect(keys('kickboxing')).toContain('boxing');
    for (const q of ['bjj', 'mma', 'judo', 'karate']) expect(keys(q)).toEqual(['martial']);
  });

  it('finds by the English name while in another locale, and by local words', () => {
    expect(keys('tennis', uk.actType)).toContain('tennis');
    expect(keys('сауна', uk.actType)).toEqual(['sauna']);
    expect(keys('пробіжка', uk.actType)).toEqual(['run']);
    expect(keys('bieganie', pl.actType)).toEqual(['run']);
    expect(keys('bėgimas', lt.actType)).toEqual(['run']);
    expect(keys('jooks', et.actType)).toEqual(['run']);
    expect(keys('plywanie', en.actType)).toEqual(['swim']);
  });

  it('English name hit in a non-English locale is shown as a synonym badge', () => {
    const [hit] = searchActivities('run', { names: uk.actType, otherNames: others });
    expect(hit.key).toBe('run');
    expect(hit.range).toBeNull();
    expect(hit.via).toBe('Run');
  });

  it('pinned first, then recently logged, then best match', () => {
    const plain = keys('bo');
    expect(plain[0]).toBe('boxing'); // prefix beats substring and synonym
    const pinned = searchActivities('bo', {
      names: en.actType,
      otherNames: others,
      pinned: ['snowboard'],
    }).map((h) => h.key);
    expect(pinned[0]).toBe('snowboard');
    const recent = searchActivities('bo', {
      names: en.actType,
      otherNames: others,
      lastAt: new Map([['climbgym', 5]]),
    }).map((h) => h.key);
    expect(recent[0]).toBe('climbgym');
  });

  it('limits to a category and ignores empty queries', () => {
    expect(
      searchActivities('bo', { names: en.actType, keys: ['boxing', 'yoga'] }).map((h) => h.key),
    ).toEqual(['boxing']);
    expect(searchActivities('   ', { names: en.actType })).toEqual([]);
  });

  it('no match → empty (UI offers "Log as Other sport")', () => {
    expect(keys('quidditch')).toEqual([]);
  });
});
