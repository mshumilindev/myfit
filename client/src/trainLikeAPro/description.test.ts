import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { describeProgram, mainWork } from './description';
import { STRINGS } from './strings';

describe('describeProgram', () => {
  const en = STRINGS.en;
  it('every program has a lead and a "Read more" with real facts, in every locale', () => {
    for (const s of Object.values(STRINGS)) {
      for (const e of CATALOG) {
        const d = describeProgram(e, s);
        expect(d.lead.length).toBeGreaterThan(20);
        expect(d.lead).not.toContain('{x}');
        expect(d.more.length).toBeGreaterThanOrEqual(2);
        for (const t of d.more) {
          expect(t).not.toMatch(/\{[nx]\}|undefined|NaN/);
        }
      }
    }
  });
  it('names the lifts that recur most with their most common scheme', () => {
    const e = CATALOG.find((x) => x.id === 'starr-beginner')!;
    const work = mainWork(e);
    expect(work.length).toBeGreaterThan(0);
    expect(work[0]).toMatch(/\d+×\d+$/);
    expect(describeProgram(e, en).more.join(' ')).toContain(work[0]!);
  });
  it('does not repeat a weekday name as the focus of a day', () => {
    const e = CATALOG.find((x) => x.id === 'starr-beginner')!;
    expect(describeProgram(e, en).more.join(' ')).not.toMatch(/The days: Mon/);
    for (const l of ['uk', 'pl', 'lt', 'et'] as const) {
      expect(describeProgram(e, STRINGS[l]).more.join(' ')).not.toMatch(/: Mon, Wed/);
    }
  });
});
