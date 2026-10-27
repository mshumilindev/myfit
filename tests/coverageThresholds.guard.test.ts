/**
 * Гард «пороги покриття лише ростуть» (SPO-47): чиста логіка порівняння зі scripts/check-coverage-thresholds.mjs
 * + перевірка, що реальні конфіги зараз проходять. Правило: .claude/rules/tests.md.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs script without type declarations
import * as guard from '../scripts/check-coverage-thresholds.mjs';

type Block = { include: string[]; exclude: string[]; thresholds: Record<string, number> };
const ROOT = join(__dirname, '..');
const floor = (): Block => ({
  include: ['src/i18n/**', 'src/data/**'],
  exclude: ['**/*.d.ts'],
  thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
});
const cmp = (cur: Block) => guard.compareBlock(floor(), cur, 'cfg') as string[];

describe('compareBlock', () => {
  it('equal passes', () => expect(cmp(floor())).toEqual([]));

  it('raised thresholds, wider include and fewer excludes pass', () => {
    const cur = floor();
    cur.thresholds.statements = 90;
    cur.include.push('src/atlas/**');
    cur.exclude = [];
    expect(cmp(cur)).toEqual([]);
  });

  it('a broader glob covering an old include passes', () => {
    const cur = floor();
    cur.include = ['src/**'];
    expect(cmp(cur)).toEqual([]);
  });

  it('lower threshold fails and names the key', () => {
    const cur = floor();
    cur.thresholds.branches = 79;
    const out = cmp(cur);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('thresholds.branches');
  });

  it('removed threshold fails', () => {
    const cur = floor();
    delete cur.thresholds.lines;
    expect(cmp(cur)[0]).toContain('thresholds.lines');
  });

  it('removed include of a file that no longer exists passes (SPO-139), an existing file or a glob does not', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cov-retired-'));
    try {
      writeFileSync(join(dir, 'alive.ts'), '');
      const isRetired = (e: string) => guard.isRetiredEntry(dir, e) as boolean;
      const base: Block = { ...floor(), include: ['alive.ts', 'gone.ts', 'src/**'] };
      const cur: Block = { ...floor(), include: [] };
      const out = guard.compareBlock(base, cur, 'cfg', isRetired) as string[];
      expect(out).toHaveLength(2);
      expect(out.join('\n')).toContain('alive.ts');
      expect(out.join('\n')).toContain('src/**');
      expect(out.join('\n')).not.toContain('gone.ts');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('removed include fails and names the entry', () => {
    const cur = floor();
    cur.include = ['src/i18n/**'];
    const out = cmp(cur);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('src/data/**');
  });

  it('added exclude fails and names the entry', () => {
    const cur = floor();
    cur.exclude.push('src/store.ts');
    const out = cmp(cur);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('src/store.ts');
  });
});

describe('compareFloorToBase', () => {
  const wrap = (b: Block) => ({ configs: { 'a.ts': b } });
  it('lowered floor vs git base fails, raised passes', () => {
    const lowered = floor();
    lowered.thresholds.statements = 70;
    expect(guard.compareFloorToBase(wrap(floor()), wrap(lowered)).length).toBe(1);
    const raised = floor();
    raised.thresholds.statements = 85;
    expect(guard.compareFloorToBase(wrap(floor()), wrap(raised))).toEqual([]);
  });

  it('SPO-268: the patch-coverage threshold may only grow', () => {
    const w = (n?: number) => ({
      configs: {},
      ...(n === undefined ? {} : { patch: { statements: n } }),
    });
    expect(guard.compareFloorToBase(w(80), w(75))).toHaveLength(1);
    expect(guard.compareFloorToBase(w(80), w())).toHaveLength(1);
    expect(guard.compareFloorToBase(w(80), w(80))).toEqual([]);
    expect(guard.compareFloorToBase(w(80), w(90))).toEqual([]);
    expect(guard.compareFloorToBase(w(), w(70))).toEqual([]);
  });

  it('a config dropped from the floor fails', () => {
    expect(guard.compareFloorToBase(wrap(floor()), { configs: {} })).toHaveLength(1);
  });
});

describe('planUpdate', () => {
  const old = () => ({ configs: { 'vitest.config.ts': floor() } });
  it('refuses to lower the floor', () => {
    const cur = floor();
    cur.thresholds.statements = 10;
    const plan = guard.planUpdate(old(), { 'vitest.config.ts': cur });
    expect(plan.ok).toBe(false);
    expect(plan.problems[0]).toContain('thresholds.statements');
  });

  it('writes a raised floor', () => {
    const cur = floor();
    cur.thresholds.lines = 95;
    const plan = guard.planUpdate(old(), { 'vitest.config.ts': cur });
    expect(plan.ok).toBe(true);
    expect(plan.floor.configs['vitest.config.ts'].thresholds.lines).toBe(95);
  });

  it('refuses a lower client_full_baseline', () => {
    const total = (pct: number) =>
      Object.fromEntries(
        ['statements', 'branches', 'functions', 'lines'].map((m) => [
          m,
          { pct, covered: 1, total: 2 },
        ]),
      );
    const prev = { totals: total(60) };
    expect(guard.planBaseline(prev, total(59)).ok).toBe(false);
    expect(guard.planBaseline(prev, total(61)).ok).toBe(true);
  });
});

describe('real configs', () => {
  it('currently pass against coverage-thresholds.json', () => {
    const floors = JSON.parse(readFileSync(join(ROOT, 'coverage-thresholds.json'), 'utf8'));
    const currents = guard.readCurrent(ROOT);
    expect(Object.keys(currents).sort()).toEqual(Object.keys(floors.configs).sort());
    expect(guard.compareAll(floors.configs, currents)).toEqual([]);
  });

  it('the CLI fails on a lowered threshold in a temp copy (real configs untouched)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cov-guard-'));
    try {
      cpSync(join(ROOT, 'coverage-thresholds.json'), join(tmp, 'coverage-thresholds.json'));
      for (const f of guard.CONFIGS as string[]) {
        cpSync(join(ROOT, f), join(tmp, f), { recursive: true });
      }
      expect(guard.main(['--root', tmp])).toBe(0);
      const p = join(tmp, 'vitest.config.ts');
      writeFileSync(p, readFileSync(p, 'utf8').replace('statements: 90', 'statements: 50'));
      expect(guard.main(['--root', tmp])).toBe(1);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
