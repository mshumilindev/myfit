import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workoutStrengthStats, volume30d } from '../functions/src/aggregates';

// Server aggregates must keep working when the workout body is sealed and only `stats` is open.
describe('aggregates with sealed workouts', () => {
  it('falls back to the open stats when exercises are encrypted', () => {
    const w = {
      id: 'w',
      startedAt: Date.now(),
      finishedAt: null,
      stats: { volumeKg: 1200, sets: 9 },
    };
    expect(workoutStrengthStats(w)).toEqual({ sets: 9, volumeKg: 1200 });
    expect(volume30d([w])).toBe(1200);
  });
  it('still computes from exercises when they are present', () => {
    expect(
      workoutStrengthStats({ id: 'w', startedAt: 1, finishedAt: null, exercises: [] }),
    ).toEqual({
      sets: 0,
      volumeKg: 0,
    });
  });
});

describe('firestore rules for the vault', () => {
  const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
  it('grants are owner-only and coach keys carry only a public JWK', () => {
    expect(rules).toMatch(
      /match \/grants\/\{coachId\}\s*\{\s*allow read, write: if isSelf\(userId\);/,
    );
    const block = rules.slice(rules.indexOf('match /coachKeys/'));
    expect(block).toContain("hasOnly(['pub', 'updatedAt'])");
    expect(block).toContain("hasOnly(['kty', 'crv', 'x', 'y', 'ext', 'key_ops'])"); // no private scalar "d"
    expect(block).not.toMatch(/'d'/);
  });
});

import { vaultKeyFor } from '../functions/src/vault';

describe('vault key derivation', () => {
  const master = Buffer.alloc(32, 7).toString('base64');
  it('is deterministic per account and differs between accounts', () => {
    const a = vaultKeyFor(master, 'uid-a');
    expect(vaultKeyFor(master, 'uid-a')).toEqual(a);
    expect(vaultKeyFor(master, 'uid-b').key).not.toBe(a.key);
    expect(Buffer.from(a.key, 'base64')).toHaveLength(32);
    expect(Buffer.from(a.salt, 'base64')).toHaveLength(16);
  });
  it('a different master gives a different key, and a short master is refused', () => {
    const other = Buffer.alloc(32, 9).toString('base64');
    expect(vaultKeyFor(other, 'uid-a').key).not.toBe(vaultKeyFor(master, 'uid-a').key);
    expect(() => vaultKeyFor('c2hvcnQ=', 'uid-a')).toThrow();
  });
});
