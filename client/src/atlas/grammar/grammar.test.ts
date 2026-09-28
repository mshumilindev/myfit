import { afterAll, describe, expect, it } from 'vitest';
import { GOLD, GOLD_SPLIT } from './gold';
import { FIELDS, score, table, type Field, type Group } from './evaluate';
import { analyze, focus } from './index';
import { clearMemos } from './core';

/** Test-only env access without Node typings. */
const ENV: Record<string, string | undefined> =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

const report = score(GOLD);

/** GRAMMAR_REPORT=<filter> GRAMMAR_OUT=<file>: write the accuracy table + errors (vitest hides passing logs). */
const out: string[] = [];
const log = (s: string): void => {
  out.push(s);
};
if (ENV.GRAMMAR_REPORT) {
  log(table(report));
  const only = ENV.GRAMMAR_REPORT;
  for (const e of report.errors) {
    if (only !== '1' && !only.split(',').includes(e.lang) && !only.split(',').includes(e.field))
      continue;
    log(
      `[${e.lang}] ${e.field}: exp=${JSON.stringify(e.exp)} got=${JSON.stringify(e.got)}  «${e.text}»`,
    );
  }
}
afterAll(async () => {
  if (!ENV.GRAMMAR_OUT) return;
  const mod = 'node:fs';
  const fs = (await import(/* @vite-ignore */ mod)) as {
    writeFileSync(p: string, d: string): void;
  };
  fs.writeFileSync(ENV.GRAMMAR_OUT as string, out.join('\n') + '\n');
});

/** Targets: en/uk ≥ 98 % per field (100 % for sentence type and clause segmentation), others ≥ 95 %. */
const TARGET: Record<Group, number> = {
  en: 0.98,
  uk: 0.98,
  'ru+': 0.95,
  pl: 0.95,
  lt: 0.95,
  et: 0.95,
};

describe('grammar gold set', () => {
  it('has ≥ 400 annotated sentences', () => {
    expect(GOLD.length).toBeGreaterThanOrEqual(400);
  });
  for (const g of Object.keys(TARGET) as Group[]) {
    for (const f of FIELDS) {
      const strict = (g === 'en' || g === 'uk') && (f === 'type' || f === 'clauses');
      it(`${g} · ${f} ≥ ${strict ? 100 : TARGET[g] * 100}%`, () => {
        const s = report.stats[g][f as Field];
        const acc = s.ok / s.n;
        expect(acc).toBeGreaterThanOrEqual(strict ? 1 : TARGET[g]);
      });
    }
  }
});

describe('sentence splitting', () => {
  it.each(GOLD_SPLIT)('%s → %i', (text, n) => {
    expect(analyze(text).sentences.length).toBe(n);
  });
});

describe('focus helper', () => {
  it('self-report + complaint in one message', () => {
    const f = focus(analyze('I danced for 2 hours today, why not commenting on that?'));
    expect(f.isReportAboutSelf).toBe(true);
    expect(f.isComplaint).toBe(true);
    expect(f.quantities.map((q) => `${q.value}${q.unit}`)).toEqual(['2h']);
    expect(f.timeRef).toBe('today');
  });
  it('conditional pairs and asked-about lemmas', () => {
    const f = focus(analyze('якщо в мене болить коліно то що мені робити з присідом'));
    expect(f.conditionals).toHaveLength(1);
    expect(f.conditionals[0].if.text).toMatch(/болить коліно/);
    expect(f.action).toBe('робити');
    expect(f.askedAbout).toContain('присід');
    expect(f.isRequestForHelp).toBe(true);
  });
  it('Ukrainian self-report with units', () => {
    const f = focus(analyze('вчора пробіг 5 км а сьогодні ноги вбиті чи можна жим'));
    expect(f.isReportAboutSelf).toBe(true);
    expect(f.timeRef).toBe('yesterday');
    expect(f.quantities[0]).toMatchObject({ value: 5, unit: 'km' });
  });
});

describe('performance', () => {
  // Typical ~20-word chat messages.
  const MSGS = [
    'so yesterday i did chest and triceps for 2 hours and today my shoulders are really sore, is that normal?',
    'I danced for 2 hours today with my wife and it was great, why are you not counting it as cardio?',
    'вчора пробіг 5 км а сьогодні ноги вбиті, чи можна робити жим лежачи якщо болить коліно після присідань',
    'якщо в мене болить коліно то що мені робити з присідом і чи варто взагалі йти в зал завтра',
    'Вчера пробежал 10 км, сегодня ноги болят и спина тоже, можно ли тренироваться или лучше отдохнуть пару дней?',
    'Wczoraj przebiegłem 5 km, a dziś bolą mnie nogi, czy mogę dzisiaj trenować na siłowni czy lepiej odpocząć?',
  ];
  const time = (cold: boolean): number => {
    const N = cold ? 40 : 300;
    const t0 = performance.now();
    for (let i = 0; i < N; i++)
      for (const m of MSGS) {
        if (cold) clearMemos();
        analyze(m);
      }
    return (performance.now() - t0) / (N * MSGS.length);
  };
  /** Best of three runs: the machine's speed, not a GC pause. */
  const best = (cold: boolean): number => Math.min(time(cold), time(cold), time(cold));
  if (ENV.GRAMMAR_REPORT) {
    for (let i = 0; i < 30; i++) for (const m of MSGS) analyze(m);
    log(
      `perf: warm ${time(false).toFixed(3)} ms, cold ${time(true).toFixed(3)} ms per ~20-word message`,
    );
  }
  it('analyze() < 2 ms for a typical 20-word message (warm word cache)', () => {
    for (let i = 0; i < 30; i++) for (const m of MSGS) analyze(m);
    const per = best(false);
    if (ENV.GRAMMAR_REPORT) console.log(`warm: ${per.toFixed(3)} ms / message`);
    expect(per).toBeLessThan(2);
  });
  it('analyze() < 2 ms even with cold per-word caches', () => {
    const per = best(true);
    if (ENV.GRAMMAR_REPORT) console.log(`cold: ${per.toFixed(3)} ms / message`);
    expect(per).toBeLessThan(2);
  });
});
