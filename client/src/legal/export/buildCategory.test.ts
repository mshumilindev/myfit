import { describe, expect, it } from 'vitest';
import { buildCategory } from './buildCategory';
import { toCsv } from './csv';
import { EXPORT_CATEGORIES, exportBaseName, type ExportFile } from './exportModel';
import { chatMsg, sources, storeSlice, storedHealth } from './fixtures.testutil';

const NOW = '2026-10-22T09:00:00.000Z';
const file = (files: ExportFile[], name: string) => files.find((f) => f.name === name);

describe('csv', () => {
  it('quotes, doubles quotes and neutralises formulas', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          ['x,y', 'say "hi"'],
          ['=SUM(A1)', '@cmd'],
          [null, 3],
        ],
      ),
    ).toBe('a,b\r\n"x,y","say ""hi"""\r\n\'=SUM(A1),\'@cmd\r\n,3\r\n');
  });
  it('keeps plain negative numbers as numbers', () => {
    expect(toCsv(['n'], [[-4.5]])).toBe('n\r\n-4.5\r\n');
  });
});

describe('names', () => {
  it('base name uses the local date', () => {
    const d = new Date(2026, 9, 5, 23, 59);
    expect(exportBaseName(d)).toBe('spotter-export-2026-10-05');
  });
});

describe('training', () => {
  const r = buildCategory('training', sources(), NOW);
  it('has the sessions, one row per set and the activities', () => {
    expect(r.files.map((f) => f.name)).toEqual([
      'workouts.json',
      'sets.csv',
      'activities.json',
      'activities.csv',
      'rest-periods.json',
      'gyms.json',
      'goals-and-settings.json',
    ]);
    const sets = file(r.files, 'sets.csv')!;
    expect(sets.rows).toBe(2);
    const c = sets.content;
    if (c.kind !== 'csv') throw new Error('csv expected');
    expect(c.rows[0].slice(3, 8)).toEqual(['Bench press', 1, 'warmup', 8, 60]);
    expect(c.rows[1][5]).toBe('working');
    expect(c.rows[0][1]).toBe('2026-10-01T08:00:00.000Z');
  });
  it('names what it cannot read', () => {
    expect(r.missing.map((m) => m.reason)).toEqual(['not-loaded']);
  });
  it('without the store it says so and has no files', () => {
    const e = buildCategory('training', sources({ store: null }), NOW);
    expect(e.files).toEqual([]);
    expect(e.missing).toEqual([{ item: 'Training data', reason: 'not-loaded' }]);
  });
});

describe('body', () => {
  it('weigh-ins, sleep, health and nutrition', () => {
    const r = buildCategory('body', sources(), NOW);
    expect(r.files.map((f) => f.name)).toEqual([
      'body.json',
      'weigh-ins.csv',
      'sleep.json',
      'sleep.csv',
      'sleep-settings.json',
      'health.json',
      'nutrition.json',
      'nutrition-log.csv',
    ]);
    expect(r.missing).toEqual([]);
  });
  it('an unloaded food log is listed, not invented', () => {
    const r = buildCategory('body', sources({ nutrition: null }), NOW);
    expect(r.missing).toEqual([
      { item: 'Nutrition log, foods, goal and profile', reason: 'not-loaded' },
    ]);
    expect(r.files.some((f) => f.name.startsWith('nutrition'))).toBe(false);
  });
  it('stored health data is exported RAW even where the feature is off, and labelled as hidden in the app', () => {
    const cycle = { updatedAt: 7, secret: 'stored-cycle-data' };
    const r = buildCategory(
      'body',
      sources({
        // the masked view (store) shows nothing; the stored state (health) has the data
        health: storedHealth({ cycle: cycle as never }),
        hiddenHealth: ['cycle', 'chronic'],
      }),
      NOW,
    );
    expect(r.missing).toEqual([]);
    const h = file(r.files, 'health.json')!;
    expect(JSON.stringify(h.content)).toContain('stored-cycle-data');
    expect(h.about).toContain('stored; hidden in the app because consent is off');
    expect(h.about).toContain('Cycle, Long-term conditions');
  });
  it('without hidden features the health file carries no "hidden" label', () => {
    const h = file(buildCategory('body', sources(), NOW).files, 'health.json')!;
    expect(h.about).not.toContain('hidden in the app');
  });
  it('a food log hidden by consent is exported and labelled, not dropped', () => {
    const base = sources().nutrition!;
    const r = buildCategory('body', sources({ nutrition: { ...base, hidden: true } }), NOW);
    expect(r.missing).toEqual([]);
    for (const n of ['nutrition.json', 'nutrition-log.csv'])
      expect(file(r.files, n)!.about).toContain('stored; hidden in the app because consent is off');
    expect(file(r.files, 'nutrition.json')!.rows).toBe(1);
  });
  it('without the stored health state it says so', () => {
    const r = buildCategory('body', sources({ health: null }), NOW);
    expect(r.missing).toEqual([{ item: 'Health data', reason: 'not-loaded' }]);
    expect(file(r.files, 'health.json')).toBeUndefined();
  });
  it('typed free text is labelled as possibly holding health details', () => {
    expect(file(buildCategory('training', sources(), NOW).files, 'workouts.json')!.about).toMatch(
      /health details you typed/,
    );
    const atlas = buildCategory('atlas', sources(), NOW).files;
    for (const n of ['chat.json', 'atlas-settings.json'])
      expect(file(atlas, n)!.about).toMatch(/health details you typed/);
    expect(file(buildCategory('body', sources(), NOW).files, 'health.json')!.about).toMatch(
      /health details you typed/,
    );
  });
});

describe('account and consent history', () => {
  const r = buildCategory('account', sources(), NOW);
  it('lists consent records oldest first and never a password or key', () => {
    const j = file(r.files, 'consents.json')!.content;
    if (j.kind !== 'json') throw new Error('json expected');
    expect((j.value as { id: string }[]).map((x) => x.id)).toEqual(['c1', 'c2']);
    expect(JSON.stringify(r)).not.toMatch(/password|credential|vaultKey/i);
  });
  it('server-held items are listed as not included', () => {
    expect(r.missing.every((m) => m.reason === 'server-only')).toBe(true);
    expect(r.missing.length).toBeGreaterThan(0);
  });
  it('settings kept in the account travel with the export (Art. 15 / 20)', () => {
    const j = file(r.files, 'settings.json')!.content;
    if (j.kind !== 'json') throw new Error('json expected');
    expect(j.value).toEqual({ 'spotter.weightUnit': 'kg', 'spotter.tw.weekly-goal': 4 });
    expect(file(r.files, 'settings.json')!.rows).toBe(2);
  });
  it('consents not loaded', () => {
    const e = buildCategory('account', sources({ consents: null, settings: {} }), NOW);
    expect(e.files.map((f) => f.name)).toEqual(['account.json']);
    expect(e.missing.at(-1)).toEqual({ item: 'Consent history', reason: 'not-loaded' });
  });
});

describe('atlas and sharing', () => {
  it('the chat without pending messages; settings only when the store is there', () => {
    const msgs = [chatMsg('1', 'me', 'q'), { ...chatMsg('2', 'atlas', '...'), pending: true }];
    const r = buildCategory('atlas', sources({ chat: msgs }), NOW);
    const c = file(r.files, 'chat.json')!;
    expect(c.rows).toBe(1);
    expect(file(r.files, 'atlas-settings.json')).toBeDefined();
    const e = buildCategory('atlas', sources({ store: null }), NOW);
    expect(file(e.files, 'atlas-settings.json')).toBeUndefined();
    expect(e.missing).toHaveLength(1);
  });
  it('sharing keeps the trainer messages and private notes out, with reasons', () => {
    const r = buildCategory('sharing', sources(), NOW);
    expect(r.missing.map((m) => m.reason)).toContain('held-by-other');
    expect(r.files).toHaveLength(1);
  });
});

describe('every category builder reads only its own part', () => {
  it('a category with the store removed never touches the other categories files', () => {
    for (const id of EXPORT_CATEGORIES) {
      const r = buildCategory(id, sources({ store: storeSlice() }), NOW);
      expect(r.id).toBe(id);
    }
  });
});
