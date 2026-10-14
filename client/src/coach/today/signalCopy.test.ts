import { describe, expect, it } from 'vitest';
import { TODAY_LOCALES } from '../../i18n/coachToday';
import { todayEn } from '../../i18n/coachToday.en';
import { buildFixtureWorld, FIXTURE_NOW } from '../data/__fixtures__/fixtures';
import { deriveWorld } from '../data/deriveWorld';
import { buildOptions } from '../domain/diff';
import { buildBoard, buildToday, similarDecisions } from './model';
import {
  describeDiffT,
  optionView,
  resultStepText,
  signalChart,
  signalHero,
  signalText,
} from './signalCopy';

const world = () => {
  const d = buildFixtureWorld();
  return deriveWorld(d, d.book, FIXTURE_NOW);
};

describe('Today dictionaries', () => {
  const locales = Object.entries(TODAY_LOCALES);
  it('has the same keys in every locale', () => {
    for (const [, dict] of locales) {
      expect(Object.keys(dict).sort()).toEqual(Object.keys(todayEn).sort());
      expect(Object.keys(dict.cat).sort()).toEqual(Object.keys(todayEn.cat).sort());
    }
  });
  it('every string and function produces text without leaks ({n}, undefined, NaN)', () => {
    for (const [loc, dict] of locales) {
      for (const [k, v] of Object.entries(dict)) {
        if (k === 'cat') continue;
        const outs: string[] = [];
        if (typeof v === 'function') {
          for (const n of [1, 2, 5, 12]) {
            const f = v as (...a: unknown[]) => unknown;
            const args =
              k === 'confidence'
                ? ['high']
                : k === 'opMessageDraft'
                  ? ['Anna', 'stall']
                  : [n, n, n, n, n, n];
            const r = f(...args);
            outs.push(String(r));
            if (k === 'allClearBody') outs.push(String(f(0, 0, 14)), String(f(n, n, 14)));
            if (k === 'sigRhythmBody' || k === 'sigRhythmLine')
              outs.push(String(f(null, null)), String(f(2, 9)));
            if (k === 'sigInjuryBody') outs.push(String(f(null, n)), String(f('no overhead', n)));
            if (k === 'sigNoSetsLine') outs.push(String(f(null)));
            if (k === 'recordedTitle') outs.push(String(f('X', null)), String(f('X', 'Anna')));
            if (k === 'recordedSub') outs.push(String(f(null, null)), String(f(14, 'Wed 21 Oct')));
            if (k === 'effectLine') outs.push(String(f('x', null)));
            if (k === 'resultLine')
              outs.push(String(f('Improved', null, null)), String(f('Improved', '5', '6')));
          }
        } else outs.push(String(v));
        for (const o of outs) {
          expect(o, `${loc}.${k}`).not.toMatch(/\{n\}|undefined|NaN|\[object/);
          expect(o.length, `${loc}.${k}`).toBeGreaterThan(0);
        }
      }
      for (const v of Object.values(dict.cat)) expect(v.length).toBeGreaterThan(0);
    }
  });
  it('uk uses real plural forms (1 / 2 / 5 differ)', () => {
    const f = TODAY_LOCALES.uk.otherOptions;
    expect(new Set([f(1), f(2), f(5)]).size).toBe(3);
  });
});

describe('signal copy', () => {
  it('every signal of the fixture world reads as text, with no raw facts leaking', () => {
    const w = world();
    expect(w.signals.length).toBeGreaterThan(5);
    for (const a of w.signals) {
      for (const [loc, dict] of Object.entries(TODAY_LOCALES)) {
        const x = signalText(dict, a.signal);
        for (const s of [x.title, x.body, x.line]) {
          expect(s, `${loc} ${a.signal.kind}`).not.toMatch(/undefined|NaN|null|\{/);
          expect(s.length).toBeGreaterThan(3);
        }
      }
    }
  });

  it('stall: lab numbers (116 kg, 4 weeks, flat, evidence rows)', () => {
    const w = world();
    const s = w.signals.find((a) => a.signal.kind === 'stall')!.signal;
    expect(signalText(todayEn, s).title).toBe('Bench press has not moved in 4 weeks');
    const hero = signalHero(todayEn, s)!;
    expect(hero).toMatchObject({ value: '116', unit: 'kg', sub: 'no change in 4 weeks' });
    const c = signalChart(todayEn, s, w.now, 'en')!;
    expect(c.tone).toBe('flag');
    expect(c.notEnough).toBe(false);
    expect(c.points.length).toBeGreaterThanOrEqual(5);
    expect(c.table.rows.length).toBeGreaterThanOrEqual(4);
    expect(c.table.head).toEqual(['Date', 'Sets (kg × reps)', 'Est. 1RM']);
    expect(c.aria).toMatch(/Bench press/);
  });

  it('chart says "not enough sessions" under 3 points', () => {
    const w = world();
    const s = structuredClone(w.signals.find((a) => a.signal.kind === 'stall')!.signal);
    s.evidence[0].rows = s.evidence[0].rows.slice(0, 2);
    expect(signalChart(todayEn, s, w.now, 'en')!.notEnough).toBe(true);
  });

  it('option description is the diff in words (one sentence per op) and titles exist for every option', () => {
    const w = world();
    for (const a of w.signals) {
      for (const o of buildOptions(a.signal)) {
        const v = optionView(todayEn, o);
        expect(v.title.length).toBeGreaterThan(0);
        if (o.diff) {
          expect(v.description).toBe(describeDiffT(todayEn, o.diff.ops));
          expect(v.description.split('. ').length).toBeGreaterThanOrEqual(o.diff.ops.length);
        } else expect(v.description).toBe('');
      }
    }
  });

  it('"Message" is never an option', () => {
    const w = world();
    for (const a of w.signals)
      for (const o of buildOptions(a.signal)) {
        expect(o.id).not.toMatch(/message/);
        expect(optionView(todayEn, o).title).not.toMatch(/message/i);
      }
  });

  it('result check uses the one configured threshold', () => {
    const w = world();
    const s = w.signals.find((a) => a.signal.kind === 'stall')!.signal;
    expect(resultStepText(todayEn, s)).toBe(
      'In 14 days. Counted as improved only if estimated 1RM moves by 2.5 kg or more.',
    );
    const pr = w.signals.find((a) => a.signal.kind === 'pr')!.signal;
    expect(resultStepText(todayEn, pr)).toBeNull();
  });
});

describe('today model', () => {
  it('cards, digest and counts reconcile; header count = cards that need a decision', () => {
    const w = world();
    const m = buildToday(w);
    expect(m.needs.length + m.watch.length).toBe(w.picked.cards.length);
    expect(m.needs.length + m.watch.length).toBeLessThanOrEqual(5);
    expect(m.needCount).toBe(w.counts.needDecision);
    expect(m.needCount).toBe(m.needs.length);
    const shown = m.needs.concat(m.watch).reduce((a, c) => a + c.count, 0);
    const open = w.signals.filter((a) => a.state === 'open').length;
    expect(shown + m.digest.length).toBe(open);
    expect(m.requestCount).toBe(1);
    expect(m.requests[0].kind).toBe('answer');
    expect(m.requests[1].kind).toBe('waiting');
    expect(m.requests[0].note).toMatch(/Work trip/);
  });

  it('board: every open signal on exactly one stage, results capped, summary reconciles', () => {
    const w = world();
    const b = buildBoard(w, todayEn, 'en');
    expect(b.stages.map((s) => s.id)).toEqual([
      'signal',
      'evidence',
      'decided',
      'measuring',
      'result',
    ]);
    const sigCards = b.stages.slice(0, 2).flatMap((s) => s.cards);
    expect(sigCards.length).toBe(w.signals.filter((a) => a.state === 'open').length);
    expect(new Set(sigCards.map((c) => c.id)).size).toBe(sigCards.length);
    expect(b.stages[3].cards.length).toBe(w.summary.measuring);
    expect(b.stages[4].cards.length).toBeLessThanOrEqual(4);
    expect(b.summary).toMatch(/26 of 42 decisions improved \(62%\), 2 still measuring/);
    const oleh = sigCards.find((c) => c.fullName === 'Oleh Bondar')!;
    expect(oleh.status).toBe('Urgent');
  });

  it('similar past decisions appear only from 5 measured ones', () => {
    const w = world();
    expect(similarDecisions(w.decisions, 'stall')).not.toBeNull();
    expect(similarDecisions(w.decisions.slice(0, 3), 'stall')).toBeNull();
  });
});
