import { afterAll, describe, expect, it } from 'vitest';
import { FIELDS, score, table, type Group } from './evaluate';
import { HOLDOUT } from './holdout';
import { HOLDOUT2 } from './holdout2';
import { HOLDOUT3 } from './holdout3';
import { HOLDOUT4 } from './holdout4';

/** Test-only env access without Node typings. */
const ENV: Record<string, string | undefined> =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

/**
 * Held-out sentences (written after tuning on gold.ts). A regression floor,
 * not a target: the first blind run is what the report quotes (see the file headers).
 * holdout3 was used for error analysis after its blind run; holdout4 was scored blind
 * after that round.
 */
const reports = {
  holdout1: score(HOLDOUT),
  holdout2: score(HOLDOUT2),
  holdout3: score(HOLDOUT3),
  holdout4: score(HOLDOUT4),
};
const out: string[] = [];
for (const [name, report] of Object.entries(reports)) {
  out.push(`## ${name}`, table(report));
  for (const e of report.errors)
    out.push(
      `[${e.lang}] ${e.field}: exp=${JSON.stringify(e.exp)} got=${JSON.stringify(e.got)}  «${e.text}»`,
    );
}
afterAll(async () => {
  if (!ENV.GRAMMAR_OUT) return;
  const mod = 'node:fs';
  const fs = (await import(/* @vite-ignore */ mod)) as {
    writeFileSync(p: string, d: string): void;
  };
  fs.writeFileSync(ENV.GRAMMAR_OUT as string, out.join('\n') + '\n');
});

const FLOOR: Record<Group, number> = { en: 0.85, uk: 0.85, 'ru+': 0.7, pl: 0.7, lt: 0.7, et: 0.7 };

describe('held-out sets', () => {
  for (const [name, report] of Object.entries(reports)) {
    for (const g of Object.keys(FLOOR) as Group[]) {
      it(`${name} · ${g}: every field ≥ ${FLOOR[g] * 100}%`, () => {
        for (const f of FIELDS) {
          const s = report.stats[g][f];
          expect(s.ok / s.n, `${g}.${f}`).toBeGreaterThanOrEqual(FLOOR[g]);
        }
      });
    }
  }
});
