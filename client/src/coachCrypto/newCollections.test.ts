// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  NEW_COLLECTIONS,
  PLAN_MAX_BYTES,
  SCHEDULE_MAX_BYTES,
  splitFields,
  type NewCollectionName,
} from './newCollections';
import { VaultLockedError, openSealed, sealOrThrow, sealedWrite } from './sealOrThrow';
import { readyVault, unsetVault } from '../testVault';
import { pairedRings, trainer } from './testHelpers';

const names = Object.keys(NEW_COLLECTIONS) as NewCollectionName[];

/** A believable document for each collection: every declared field filled. */
const fullDoc = (n: NewCollectionName): Record<string, unknown> =>
  Object.fromEntries(
    [...NEW_COLLECTIONS[n].open, ...NEW_COLLECTIONS[n].enc].map((f) => [f, `secret-${f}-value`]),
  );

describe('NEW_COLLECTIONS registry (R-BE-KEY-3)', () => {
  it('declares every field exactly once: open XOR enc', () => {
    for (const n of names) {
      const { open, enc } = NEW_COLLECTIONS[n];
      const all = [...open, ...enc];
      expect(new Set(all).size, n).toBe(all.length);
      expect(enc as readonly string[], n).not.toContain('enc');
      expect(open as readonly string[], n).not.toContain('enc');
    }
  });

  it('registers the planned collections', () => {
    expect(names.sort()).toEqual(
      [
        'calendarSettings',
        'clientNotes',
        'conversations',
        'decisions',
        'evidence',
        'keyring',
        'liveSessions',
        'messages',
        'notes',
        'plans',
        'requests',
        'schedules',
        'selfCoach',
        'shares',
        'signalState',
        'versions',
      ].sort(),
    );
  });

  it('keeps user text out of the open lists', () => {
    const secretish = [
      'text',
      'note',
      'notes',
      'name',
      'athleteName',
      'gymName',
      'message',
      'share',
      'anchor',
      'sys',
      'title',
      'body',
      'summary',
      'reason',
      'diff',
      'proposed',
      'slotRef',
      'rows',
      'view',
    ];
    for (const n of names) {
      const open = NEW_COLLECTIONS[n].open as readonly string[];
      for (const f of secretish) expect(open, `${n}.${f}`).not.toContain(f);
    }
  });

  it('seals ck / dek collections: every field is open-listed or inside enc, nothing else readable', async () => {
    const v = await readyVault();
    const t = await trainer();
    const rings = await pairedRings(t);
    for (const n of names) {
      const spec = NEW_COLLECTIONS[n];
      if (spec.key === 'none') continue;
      const doc = fullDoc(n);
      if ((spec.open as readonly string[]).includes('keyEpoch')) doc.keyEpoch = 1;
      const src = {
        vault: v,
        ring: rings.client,
        ctx: { messageId: 'id1', fromUid: 'u1', at: 1700000000000 },
      };
      const sealed = await sealOrThrow(n, doc, src);
      const keys = Object.keys(sealed).filter((k) => k !== 'enc');
      expect(sealed.enc, n).toBeDefined();
      for (const k of keys) expect(spec.open as readonly string[], `${n}.${k}`).toContain(k);
      for (const f of spec.enc) {
        expect(sealed, `${n}.${f}`).not.toHaveProperty(f);
        expect(JSON.stringify(sealed), `${n}.${f}`).not.toContain(`secret-${f}-value`);
      }
      const back = await openSealed(n, sealed, src);
      for (const f of spec.enc) expect(back[f], `${n}.${f}`).toBe(`secret-${f}-value`);
    }
  });

  it('refuses an undeclared field instead of guessing where it belongs', () => {
    expect(() => splitFields('messages', { id: 'm', text: 't', oops: 1 })).toThrow(
      'undeclared-field:messages.oops',
    );
    expect(() => splitFields('messages', { id: 'm', enc: { v: 1 } })).toThrow('undeclared-field');
  });

  it('conversations carry no user text and no enc', async () => {
    const v = await readyVault();
    const out = await sealOrThrow(
      'conversations',
      { clientId: 'c', trainerId: 't', unread: {} },
      { vault: v },
    );
    expect(out).toEqual({ clientId: 'c', trainerId: 't', unread: {} });
    await expect(
      sealOrThrow('conversations', { clientId: 'c', text: 'hi' }, { vault: v }),
    ).rejects.toThrow();
  });
});

describe('sealOrThrow (R-BE-KEY-4)', () => {
  const ctx = { messageId: 'm1', fromUid: 'u1', at: 1700000000000 };

  it('throws vault-locked when the vault is not ready, for every sealed collection', async () => {
    const locked = await unsetVault();
    const rings = await pairedRings(await trainer());
    for (const n of names) {
      if (NEW_COLLECTIONS[n].key === 'none') continue;
      await expect(
        sealOrThrow(n, fullDoc(n), { vault: locked, ring: rings.client, ctx }),
      ).rejects.toMatchObject({ code: 'vault-locked', message: 'vault-locked' });
    }
    await expect(sealOrThrow('clientNotes', { id: 'n' }, { vault: locked })).rejects.toBeInstanceOf(
      VaultLockedError,
    );
  });

  it('never reaches the writer when sealing throws: nothing hits Firestore', async () => {
    const locked = await unsetVault();
    const rings = await pairedRings(await trainer());
    const write = vi.fn(async () => undefined);
    await expect(
      sealedWrite(
        'messages',
        { id: 'm1', from: 'u1', at: 1, text: 'private' },
        { vault: locked, ring: rings.client, ctx },
        write,
      ),
    ).rejects.toThrow('vault-locked');
    expect(write).not.toHaveBeenCalled();
    // key missing (vault ready, CK not yet unwrapped) also blocks, with a distinct reason
    await expect(
      sealedWrite(
        'messages',
        { id: 'm1', from: 'u1', at: 1, text: 'private' },
        { vault: await readyVault(), ring: null, ctx },
        write,
      ),
    ).rejects.toThrow('chat-key-missing');
    expect(write).not.toHaveBeenCalled();
  });

  it('writes sealed data once the vault is ready, and the writer sees no plaintext', async () => {
    const v = await readyVault();
    const rings = await pairedRings(await trainer());
    const seen: Record<string, unknown>[] = [];
    await sealedWrite(
      'messages',
      { id: 'm1', from: 'u1', at: 1700000000000, v: 1, kind: 'text', text: 'my knee hurts' },
      { vault: v, ring: rings.client, ctx },
      async (d) => void seen.push(d),
    );
    expect(JSON.stringify(seen[0])).not.toContain('knee');
    expect(Object.keys(seen[0]).sort()).toEqual(['at', 'enc', 'from', 'id', 'keyEpoch', 'v']);
    expect(seen[0].keyEpoch).toBe(1);
  });

  it('a sealed message opens only in its own context, epoch and with the trainer key', async () => {
    const v = await readyVault();
    const t = await trainer();
    const rings = await pairedRings(t);
    const sealed = await sealOrThrow(
      'messages',
      { id: 'm1', from: 'u1', at: 1700000000000, v: 1, text: 'hi' },
      { vault: v, ring: rings.client, ctx },
    );
    const asTrainer = { vault: v, ring: rings.trainer, ctx };
    expect((await openSealed('messages', sealed, asTrainer)).text).toBe('hi');
    await expect(
      openSealed('messages', sealed, { ...asTrainer, ctx: { ...ctx, fromUid: 'u2' } }),
    ).rejects.toThrow();
    await expect(openSealed('notes', sealed, asTrainer)).rejects.toThrow();
    await expect(openSealed('messages', { ...sealed, keyEpoch: 2 }, asTrainer)).rejects.toThrow(
      'epoch-mismatch',
    );
    await expect(
      sealOrThrow('messages', { id: 'm1', keyEpoch: 9 }, { vault: v, ring: rings.client, ctx }),
    ).rejects.toThrow('epoch-mismatch');
  });

  it('dek collections round-trip through the owner vault', async () => {
    const v = await readyVault();
    const s = await sealOrThrow(
      'clientNotes',
      {
        id: 'n1',
        clientId: 'c',
        at: 1,
        updatedAt: 2,
        text: 'tight hamstring',
        anchor: { kind: 'x' },
      },
      { vault: v },
    );
    expect(JSON.stringify(s)).not.toContain('hamstring');
    expect(await openSealed('clientNotes', s, { vault: v })).toMatchObject({
      text: 'tight hamstring',
      clientId: 'c',
    });
    await expect(openSealed('clientNotes', s, { vault: await readyVault() })).rejects.toThrow();
  });
});

// Drift guard: the rules' key lists may only name fields the registry declares.
describe('firestore.rules vs NEW_COLLECTIONS', () => {
  const rules = readFileSync(new URL('../../../firestore.rules', import.meta.url), 'utf8');
  const block = (re: RegExp) => {
    const m = re.exec(rules);
    if (!m) throw new Error(`rules block not found: ${re}`);
    let depth = 0;
    for (let i = rules.indexOf('{', m.index); i < rules.length; i++) {
      if (rules[i] === '{') depth++;
      if (rules[i] === '}' && --depth === 0) return rules.slice(m.index, i + 1);
    }
    throw new Error('unbalanced');
  };
  const listed = (txt: string) =>
    [...txt.matchAll(/hasOnly\(\[([^\]]*)\]\)/g)].flatMap((m) =>
      [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]),
    );

  const cases: [NewCollectionName, RegExp][] = [
    ['messages', /match \/messages\/\{mid\}/],
    ['notes', /match \/notes\/\{nid\}/],
    ['requests', /match \/requests\/\{rid\}/],
    ['schedules', /match \/schedules\/\{clientId\}/],
    ['keyring', /match \/keyring\/\{epoch\}/],
    ['plans', /match \/plans\/\{clientId\} \{/],
    ['versions', /match \/versions\/\{n\}/],
  ];
  it.each(cases)('%s: every field in a hasOnly list is declared (open or enc)', (n, re) => {
    const txt = block(re);
    const ok = new Set<string>([...NEW_COLLECTIONS[n].open, ...NEW_COLLECTIONS[n].enc, 'enc']);
    for (const f of listed(txt)) expect(ok.has(f), `${n}: ${f}`).toBe(true);
  });

  it('the message ciphertext cap in the rules is below 11000 chars (matches the envelope test)', () => {
    expect(rules).toMatch(/ct\.size\(\) < 11000/);
  });

  it('plans and versions seal up to PLAN_MAX_BYTES and the rules allow that many base64 characters', () => {
    expect(NEW_COLLECTIONS.plans.maxBytes).toBe(PLAN_MAX_BYTES);
    expect(NEW_COLLECTIONS.versions.maxBytes).toBe(PLAN_MAX_BYTES);
    const limit = Number(/function sealedCkPlan[\s\S]*?ct\.size\(\) < (\d+)/.exec(rules)?.[1]);
    // 4-byte length header + payload, padded to 64, then base64 (+ the 16 byte GCM tag)
    const padded = Math.ceil((4 + PLAN_MAX_BYTES) / 64) * 64 + 16;
    expect(Math.ceil(padded / 3) * 4).toBeLessThan(limit);
    // the rules file keeps the small cap for everything else, and the plan blocks use the big one
    const plansBlock = rules.slice(rules.indexOf('match /plans/{clientId}'));
    expect(plansBlock.slice(0, plansBlock.indexOf('liveSessions'))).not.toMatch(/sealedCk\(/);
  });

  it('schedules seal up to SCHEDULE_MAX_BYTES and the rules allow that many base64 characters (drift)', () => {
    expect(NEW_COLLECTIONS.schedules.maxBytes).toBe(SCHEDULE_MAX_BYTES);
    const limit = Number(/function sealedCkSchedule[\s\S]*?ct\.size\(\) < (\d+)/.exec(rules)?.[1]);
    const padded = Math.ceil((4 + SCHEDULE_MAX_BYTES) / 64) * 64 + 16;
    expect(Math.ceil(padded / 3) * 4).toBeLessThan(limit);
    // 1 MiB Firestore document limit with room for the open fields
    expect(limit).toBeLessThan(1_000_000);
    const block = rules.slice(rules.indexOf('match /schedules/{clientId}'));
    const sched = block.slice(0, block.indexOf('match /plans/'));
    expect(sched).toMatch(/sealedCkSchedule\(/);
    expect(sched).not.toMatch(/sealedCk\(/);
  });
});
