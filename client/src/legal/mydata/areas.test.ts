import { describe, expect, it } from 'vitest';
import { AREA_ORDER, areaLines, inputsFromState, storedHealth, type AreaInputs } from './areas';
import { myDataEn } from '../../i18n/myData.en';
import { myDataTexts, MY_DATA_LOCALES, type DataAreaId } from '../../i18n/myData';

const fixture = {
  workouts: [
    { exercises: [{ sets: [1, 2, 3] }, { sets: [1] }] },
    { exercises: [{ sets: [1, 2] }] },
  ],
  activities: [{}, {}],
  restPeriods: [{}],
  gyms: [{}, {}, {}],
  bodyMetrics: { weights: [{}, {}, {}, {}] },
  sleeps: [{}, {}, {}, {}, {}],
  injuries: [{}],
  conditions: [],
} as unknown as Parameters<typeof inputsFromState>[0];
const rest = {
  stored: { cycle: false, nicotine: true, alcohol: false, supplements: false },
  chat: 7,
  atlasAllowed: true,
  geoAllowed: false,
  hasTrainer: false,
  pushOn: null,
};

describe('data page inputs come from the stores', () => {
  const i: AreaInputs = inputsFromState(fixture, rest);

  it('counts what is loaded, nothing else', () => {
    expect(i).toMatchObject({
      sessions: 2,
      sets: 6,
      activities: 2,
      restPeriods: 1,
      gyms: 3,
      weighIns: 4,
      nights: 5,
      injuries: 1,
      conditions: 0,
      chat: 7,
    });
  });

  it('every number on a page is a count line fed by an input; sealed lines have no value', () => {
    const val = (a: DataAreaId, id: string) => areaLines(a, i).find((l) => l.id === id)?.value;
    expect(val('training', 'trSessions')).toEqual({ kind: 'count', n: 2 });
    expect(val('training', 'trSets')).toEqual({ kind: 'count', n: 6 });
    expect(val('atlas', 'atChat')).toEqual({ kind: 'count', n: 7 });
    expect(val('gyms', 'gyGyms')).toEqual({ kind: 'count', n: 3 });
    // not readable here, or no store behind it: no value
    for (const [a, id] of [
      ['training', 'trPrograms'],
      ['sleepbody', 'sbNutrition'],
      ['gyms', 'gyVisits'],
      ['chat', 'chMessages'],
      ['account', 'accSignin'],
      ['account', 'accLogs'],
    ] as const)
      expect(val(a, id)).toBeUndefined();
    expect(val('notifications', 'noDevice')).toBeUndefined();
  });

  it('only features with something stored can be deleted', () => {
    expect(storedHealth(i)).toEqual(['injuries', 'nicotine']);
  });
});

describe('words', () => {
  it('uk and pl carry every area, line and device key of English; lt and et read English', () => {
    for (const l of ['uk', 'pl'] as const) {
      const t = myDataTexts(l);
      expect(Object.keys(t).sort()).toEqual(Object.keys(myDataEn).sort());
      expect(Object.keys(t.lines).sort()).toEqual(Object.keys(myDataEn.lines).sort());
      expect(Object.keys(t.device).sort()).toEqual(Object.keys(myDataEn.device).sort());
      expect(Object.keys(t.pages).sort()).toEqual(Object.keys(myDataEn.pages).sort());
      expect(t.title).not.toBe(myDataEn.title);
    }
    expect(myDataTexts('lt')).toBe(myDataEn);
    expect(myDataTexts('et')).toBe(myDataEn);
    expect(Object.keys(MY_DATA_LOCALES).sort()).toEqual(['en', 'pl', 'uk']);
    expect(Object.keys(myDataEn.areas).sort()).toEqual([...AREA_ORDER].sort());
  });

  it('never overstates the protection: end-to-end only to deny it', () => {
    const denial = /not end-to-end|не наскрізне|nie szyfrowanie end-to-end/;
    for (const l of ['en', 'uk', 'pl'] as const) {
      const p = myDataTexts(l).pages;
      for (const a of ['training', 'sleepbody', 'health', 'chat'] as const)
        expect(p[a].where).toMatch(denial);
    }
  });
});
