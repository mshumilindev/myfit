import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OPEN_FIELDS } from './encryptedDoc';

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

/** The cycle is private: it must never reach the coach, Atlas facts or any note feed. */
describe('cycle stays private', () => {
  it('is a sealed document with only the stamp in the open', () => {
    expect([...OPEN_FIELDS.cycle]).toEqual(['updatedAt']);
  });
  it('is part of the migration lists', () => {
    // the sealed meta list of the key-exchange migration and the ordered migration list
    expect(src('./vaultIO.ts')).toMatch(/^\s*'cycle',$/m);
    expect(src('./vaultMigrate.ts')).toMatch(/^\s*'cycle',$/m);
  });
  it('is not mentioned by coach-share or Atlas fact builders', () => {
    for (const f of [
      './nicotineShare.ts',
      './alcoholShare.ts',
      './supplementsShare.ts',
      './coachEffectIcons.ts',
    ])
      expect(src(f).toLowerCase()).not.toContain('cycle');
    const store = src('./store.ts');
    const publish = store.slice(
      store.indexOf('function publishCoachShare'),
      store.indexOf('function publishCoachShare') + 2500,
    );
    expect(publish).not.toMatch(/state\.cycle|getCycle/);
    const facts = store.match(/buildChatFacts[\s\S]{0,1500}/)?.[0] ?? '';
    expect(facts).not.toMatch(/cycle/i);
  });
  it('commitCycle never calls publishCoachShare', () => {
    const store = src('./store.ts');
    const a = store.indexOf('function commitCycle');
    expect(store.slice(a, a + 600)).not.toContain('publishCoachShare');
  });
});
