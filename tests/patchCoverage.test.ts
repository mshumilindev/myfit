/**
 * Patch-coverage (SPO-268): чиста логіка scripts/patch-coverage.mjs — розбір diff, злиття звітів шардів, підрахунок.
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs script without type declarations
import * as pc from '../scripts/patch-coverage.mjs';

const DIFF = [
  'diff --git a/client/src/a.ts b/client/src/a.ts',
  '--- a/client/src/a.ts',
  '+++ b/client/src/a.ts',
  '@@ -3,2 +3,3 @@',
  '@@ -10 +11 @@',
  '@@ -20,3 +22,0 @@',
  'diff --git a/client/src/a.test.ts b/client/src/a.test.ts',
  '+++ b/client/src/a.test.ts',
  '@@ -1 +1,5 @@',
  'diff --git a/client/src/old.ts b/client/src/old.ts',
  '+++ /dev/null',
  '@@ -1,4 +0,0 @@',
  'diff --git a/server/src/x.ts b/server/src/x.ts',
  '+++ b/server/src/x.ts',
  '@@ -1 +1 @@',
].join('\n');

describe('isSourceFile', () => {
  it('counts product code only', () => {
    expect(pc.isSourceFile('client/src/a.ts')).toBe(true);
    expect(pc.isSourceFile('client/src/views/V.tsx')).toBe(true);
    for (const f of [
      'client/src/a.test.ts',
      'client/src/a.cases.test.tsx',
      'client/src/Button.stories.tsx',
      'client/src/types.d.ts',
      'client/src/__fixtures__/x.ts',
      'client/src/main.tsx',
      'client/src/styles.css',
      'server/src/a.ts',
    ])
      expect(pc.isSourceFile(f)).toBe(false);
  });
});

describe('parseChangedLines', () => {
  it('collects added lines of product files, ignoring tests, deletions and other trees', () => {
    const out = pc.parseChangedLines(DIFF) as Record<string, Set<number>>;
    expect(Object.keys(out)).toEqual(['client/src/a.ts']);
    expect([...out['client/src/a.ts']].sort((x, y) => x - y)).toEqual([3, 4, 5, 11]);
  });
});

const cov = (s: Record<string, number>) => ({
  statementMap: {
    '0': { start: { line: 3 }, end: { line: 3 } },
    '1': { start: { line: 4 }, end: { line: 4 } },
    '2': { start: { line: 11 }, end: { line: 11 } },
    '3': { start: { line: 50 }, end: { line: 50 } },
  },
  s,
});

describe('mergeCoverage + evaluate', () => {
  const changed = { 'client/src/a.ts': new Set([3, 4, 11]) };

  it('sums shard counters, so a statement hit in any shard is covered', () => {
    const merged = pc.mergeCoverage(
      [
        { '/repo/client/src/a.ts': cov({ '0': 1, '1': 0, '2': 0, '3': 9 }) },
        { '/repo/client/src/a.ts': cov({ '0': 0, '1': 2, '2': 0, '3': 0 }) },
      ],
      '/repo',
    );
    const res = pc.evaluate(merged, changed);
    expect(res.total).toBe(3); // line 50 is outside the diff
    expect(res.covered).toBe(2);
    expect(res.pct).toBe(66.67);
    expect([...res.uncovered['client/src/a.ts']]).toEqual([11]);
  });

  it('a diff without executable statements passes at 100%', () => {
    expect(pc.evaluate({ 'client/src/a.ts': { statementMap: {}, s: {} } }, changed).pct).toBe(100);
  });

  it('a changed file with no coverage data is reported as missing, not silently ignored', () => {
    const res = pc.evaluate({}, changed);
    expect(res.missing).toEqual(['client/src/a.ts']);
    expect(pc.formatReport(res, 80)).toContain('client/src/a.ts');
  });

  it('report names the uncovered lines and the threshold', () => {
    const merged = pc.mergeCoverage(
      [{ '/repo/client/src/a.ts': cov({ '0': 0, '1': 0, '2': 0, '3': 0 }) }],
      '/repo',
    );
    const text = pc.formatReport(pc.evaluate(merged, changed), 80);
    expect(text).toContain('0/3');
    expect(text).toContain('3, 4, 11');
    expect(text).toContain('80%');
  });
});

describe('vitestCoverageArgs', () => {
  it('limits coverage to the changed files, relative to client/, and turns thresholds off for the slice', () => {
    const a = pc.vitestCoverageArgs(['client/src/a.ts', 'client/src/b/c.tsx']) as string[];
    expect(a).toContain('--coverage.include=src/a.ts');
    expect(a).toContain('--coverage.include=src/b/c.tsx');
    expect(a).toContain('--coverage.thresholds.statements=0');
    expect(pc.vitestCoverageArgs([])).toEqual([]);
  });

  it('the repo floor defines a patch threshold', () => {
    expect(pc.readMin()).toBeGreaterThanOrEqual(80);
  });
});
