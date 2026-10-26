import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs helper without types
import {
  COACH_CALLABLES,
  SLOW_MS,
  classifyCallableProbe,
  missingIndexes,
} from '../scripts/lib/coachSmoke.mjs';

describe('post-deploy Coach smoke (SPO-364)', () => {
  it('a deployed callable refuses an anonymous call with 4xx; 404 is "not deployed"; 5xx is broken; slow is slow', () => {
    expect(classifyCallableProbe({ status: 401, ms: 300 })).toMatchObject({
      ok: true,
      state: 'deployed',
    });
    expect(classifyCallableProbe({ status: 400, ms: 300 }).ok).toBe(true);
    expect(classifyCallableProbe({ status: 404, ms: 300 })).toMatchObject({
      ok: false,
      state: 'missing',
    });
    expect(classifyCallableProbe({ status: 503, ms: 300 })).toMatchObject({
      ok: false,
      state: 'broken',
    });
    expect(classifyCallableProbe({ status: 401, ms: SLOW_MS + 1 })).toMatchObject({
      ok: false,
      state: 'slow',
    });
  });

  it('every smoke callable is a real export of functions/src (the list cannot drift)', () => {
    const all = readTree('functions/src');
    for (const n of COACH_CALLABLES) expect(all, n).toMatch(new RegExp(`\\b${n}\\b`));
  });

  it('missingIndexes: finds a composite index the project lacks, ignores order of the list', () => {
    const wanted = JSON.parse(readFileSync('firestore.indexes.json', 'utf8'));
    expect(missingIndexes(wanted, { indexes: [...wanted.indexes].reverse() })).toEqual([]);
    const lacking = { indexes: wanted.indexes.slice(1) };
    expect(missingIndexes(wanted, lacking)).toHaveLength(1);
    expect(missingIndexes(wanted, {})).toHaveLength(wanted.indexes.length);
  });
});

function readTree(dir: string): string {
  return readdirSync(dir, { withFileTypes: true })
    .map((e) =>
      e.isDirectory()
        ? readTree(`${dir}/${e.name}`)
        : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')
          ? readFileSync(`${dir}/${e.name}`, 'utf8')
          : '',
    )
    .join('\n');
}
