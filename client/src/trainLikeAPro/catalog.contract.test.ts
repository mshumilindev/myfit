import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOG } from './catalog';
import { isBuiltInExercise } from '../data/exercises';
import { activityType } from '../activities';
import { ADDONS } from '../addons/manifest';

describe('Train like a pro catalog contract', () => {
  it('has unique slugs and every required field', () => {
    expect(CATALOG.length).toBe(48);
    expect(new Set(CATALOG.map((e) => e.id)).size).toBe(CATALOG.length);
    for (const e of CATALOG) {
      expect(e.id).toMatch(/^[a-z0-9-]+$/);
      for (const f of [e.who, e.title, e.origin.label]) expect(f.trim().length).toBeGreaterThan(2);
      expect(e.levels.length).toBeGreaterThan(0);
      expect(e.goals.length).toBeGreaterThan(0);
      expect(e.era).toBeTruthy();
      expect(e.daysPerWeek).toBeGreaterThan(0);
      expect(e.weeks).toBeGreaterThan(0);
      expect(e.items.length).toBeGreaterThan(0);
    }
  });

  it('every exercise resolves to the exercise catalog (own ones are flagged)', () => {
    const bad: string[] = [];
    for (const e of CATALOG)
      for (const r of e.items)
        if (!r.custom && !isBuiltInExercise(r.name)) bad.push(`${e.id}: ${r.name}`);
    expect(bad).toEqual([]);
  });

  it('keeps data language-neutral: no Cyrillic anywhere in the entries', () => {
    expect(JSON.stringify(CATALOG)).not.toMatch(/[А-Яа-яІіЇїЄєҐґ]/);
  });

  it('days, positions and activities are valid; needs name real add-ons', () => {
    const ids = new Set(ADDONS.map((a) => a.id));
    for (const e of CATALOG) {
      for (const r of e.items) {
        expect(r.day).toBeGreaterThanOrEqual(1);
        expect(r.day).toBeLessThanOrEqual(7);
        expect(r.bare || (r.sets > 0 && r.reps > 0)).toBe(true);
      }
      for (const a of e.activities) expect(activityType(a.type)).toBeTruthy();
      for (const n of e.needs) expect(ids.has(n)).toBe(true);
      expect(e.needs.includes('supersets')).toBe(e.items.some((r) => r.groupId));
      expect(e.needs.includes('periodization')).toBe(e.weeks > 1);
    }
  });

  it('data lives only in the lazy chunk folder', () => {
    const root = join(__dirname, '..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, f.name);
        if (f.isDirectory()) {
          if (p.includes(`${join('src', 'trainLikeAPro')}`)) continue;
          walk(p);
        } else if (/\.(ts|tsx)$/.test(f.name) && !/\.test\./.test(f.name)) {
          if (/trainLikeAPro\/catalog['"/]/.test(readFileSync(p, 'utf8'))) offenders.push(p);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
