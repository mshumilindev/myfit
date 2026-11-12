// @vitest-environment node
/**
 * SPO-552 (owner 10.11): a plan only reminds. It never creates or changes a record in the history (workouts, home sets,
 * activities, sleep, nutrition…). Static guard over the Planner sources: they write to Firestore only under their own
 * paths, and take from the store only what reads (or the share republish, which is not history).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DIR = `${process.cwd()}/src/planner`;
const sources = readdirSync(DIR)
  .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => [f, readFileSync(`${DIR}/${f}`, 'utf8')] as const);

const OWN = new Set(['plannerEvents', 'plannerAlerts', 'meta']);
const READ_ONLY_STORE = new Set([
  'getStoreState',
  'subscribeStore',
  'useStore',
  'uuid',
  'republishCoachShare',
]);

describe('Planner never writes to the history', () => {
  it('has sources to check, and the guard sees the real writes', () => {
    expect(sources.length).toBeGreaterThan(10);
    const sync = sources.find(([f]) => f === 'sync.ts')![1];
    const hits = [
      ...sync.matchAll(/(?:setDoc|deleteDoc)\(\s*doc\(db,\s*'users',\s*\w+,\s*'(\w+)'/g),
    ];
    expect(hits.map((m) => m[1]).sort()).toEqual(['meta', 'plannerEvents', 'plannerEvents']);
  });

  it.each(sources)('%s: Firestore writes stay inside the Planner paths', (_f, src) => {
    for (const m of src.matchAll(
      /(?:setDoc|updateDoc|deleteDoc|addDoc)\(\s*(?:doc|collection)\(db,\s*'users',\s*\w+,\s*'(\w+)'(?:,\s*'(\w+)')?/g,
    )) {
      expect(OWN.has(m[1]), `${_f}: writes users/…/${m[1]}`).toBe(true);
      if (m[1] === 'meta') expect(m[2], `${_f}: meta/${m[2]}`).toBe('planner');
    }
  });

  it.each(sources)('%s: takes only reading helpers from the store', (_f, src) => {
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\.\/store'/g))
      for (const name of m[1]
        .split(',')
        .map((s) => s.trim().replace(/^type\s+/, ''))
        .filter(Boolean))
        expect(READ_ONLY_STORE.has(name), `${_f}: imports ${name} from the store`).toBe(true);
  });
});
