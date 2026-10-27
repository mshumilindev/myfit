import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HUB_ANNOUNCEMENTS, HUB_SURFACES } from './HubSlot';

const SRC = join(__dirname, '..');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'node_modules' ? [] : files(p);
    return /\.tsx$/.test(n) && !/\.(test|stories)\./.test(n) ? [p] : [];
  });
}
const used = files(SRC)
  .map((f) => readFileSync(f, 'utf8'))
  .flatMap((src) => [...src.matchAll(/<HubSlot surface="(\w+)"/g)].map((m) => m[1]));

describe('hub slots (SPO-355)', () => {
  it('every hub surface mounts exactly one slot', () => {
    for (const id of Object.keys(HUB_SURFACES)) {
      expect(
        used.filter((u) => u === id),
        `<HubSlot surface="${id}" /> count`,
      ).toHaveLength(1);
    }
  });

  it('no slot names a surface that is not registered', () => {
    expect(used.filter((u) => !(u in HUB_SURFACES))).toEqual([]);
  });

  it('every announcement names registered surfaces and has a unique id', () => {
    const ids = HUB_ANNOUNCEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of HUB_ANNOUNCEMENTS) {
      expect(a.surfaces.length).toBeGreaterThan(0);
      for (const s of a.surfaces) expect(s in HUB_SURFACES).toBe(true);
    }
  });
});
