/**
 * The exclusion contract (owner 10.11): see exclusion.ts. A not-installed add-on counts for nothing anywhere; the data stays.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { ADDONS } from './manifest';
import { EXCLUSION } from './exclusion';
import {
  apexRanksAvailable,
  atlasAvailable,
  goalsAvailable,
  playbookAvailable,
  sleepAvailable,
} from './featureGates';
import { addonAvailable, addonsPref, isAddonBase } from './enabledSet';

const SRC = join(__dirname, '..');

describe('every add-on declares how it is switched off', () => {
  it('the manifest and the exclusion table list the same ids', () => {
    expect(Object.keys(EXCLUSION).sort()).toEqual(ADDONS.map((a) => a.id).sort());
  });

  for (const a of ADDONS) {
    it(`${a.id}: the enforcing files exist and still name it`, () => {
      const e = EXCLUSION[a.id];
      expect(e, `no exclusion declared for ${a.id}`).toBeTruthy();
      expect(e.via.length).toBeGreaterThan(0);
      for (const f of e.files) {
        const path = join(SRC, f);
        expect(existsSync(path), `${f} is gone`).toBe(true);
        const text = readFileSync(path, 'utf8');
        const words = [a.id, ...(e.names ?? [])];
        expect(
          words.some((w) => text.includes(w)),
          `${f} no longer names ${a.id} (looked for ${words.join(', ')})`,
        ).toBe(true);
      }
    });
  }
});

describe('with nothing installed, nothing optional is available', () => {
  beforeEach(() => addonsPref.reset());
  for (const role of ['member', 'trainer', 'admin'] as const) {
    it(`${role}: every add-on or module that is not part of the role's base is off`, () => {
      const leaking = ADDONS.filter((a) => (a.kind === 'addon' || a.kind === 'module') && !a.soon)
        .filter((a) => !isAddonBase(a.id, role))
        .filter((a) => addonAvailable(a.id, role))
        .map((a) => a.id);
      expect(leaking, 'available although not installed').toEqual([]);
    });
  }
});

describe('the gates answer "off" with nothing installed', () => {
  beforeEach(() => addonsPref.reset());
  it('feature gates for Playbook, Apex ranks, Goals, Sleep and Atlas are all false', () => {
    expect(playbookAvailable()).toBe(false);
    expect(apexRanksAvailable()).toBe(false);
    expect(goalsAvailable()).toBe(false);
    expect(sleepAvailable()).toBe(false);
    expect(atlasAvailable()).toBe(false);
  });
});
