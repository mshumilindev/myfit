/** The server backstop for the kept Atlas chat copy (SPO-392): envelope format, key choice, the 30-day rule, safety checks. */
import { describe, expect, it, vi } from 'vitest';
import { RETENTION_DAYS as CLIENT_DAYS } from '../../client/src/atlas/chatSyncCore';
import { encryptJson, importRawKey } from '../../client/src/vaultCrypto';
import {
  RETENTION_DAYS,
  isEnvelope,
  openEnvelope,
  retentionExpired,
  sweepAtlasChat,
  withdrawnAtOf,
  type AtlasRetentionPorts,
  type Envelope,
} from '../../functions/src/atlasChatRetentionCore';
import { openWithMaster } from '../../functions/src/atlasChatRetention';
import { vaultKeyFor } from '../../functions/src/vault';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 30, 12);
const MASTER = Buffer.alloc(32, 7).toString('base64');

/** Seals exactly like the app does (client `vaultCrypto.encryptJson`, WebCrypto). */
async function seal(uid: string, data: unknown, kv = 1): Promise<Envelope> {
  const { key, salt } = vaultKeyFor(MASTER, uid, kv);
  return (await encryptJson(await importRawKey(key, false), salt, data)) as Envelope;
}

describe('envelope and rules', () => {
  it('the period equals the client one', () => {
    expect(RETENTION_DAYS).toBe(CLIENT_DAYS);
  });

  it('opens what the app sealed, and refuses a wrong key or a damaged envelope', async () => {
    const env = await seal('u1', { clearedAt: 5, withdrawnAt: 9 });
    const { key } = vaultKeyFor(MASTER, 'u1', 1);
    expect(openEnvelope(env, key)).toEqual({ clearedAt: 5, withdrawnAt: 9 });
    expect(() => openEnvelope(env, vaultKeyFor(MASTER, 'u2', 1).key)).toThrow();
    expect(() => openEnvelope({ ...env, ct: 'AAAA' }, key)).toThrow('bad-envelope');
    expect(() => openEnvelope(env, 'AAAA')).toThrow('bad-envelope');
    expect(isEnvelope(env)).toBe(true);
    expect(isEnvelope({ v: 2 })).toBe(false);
    expect(isEnvelope(null)).toBe(false);
  });

  it('picks the key version by the envelope salt, newest first', async () => {
    const old = await seal('u1', { withdrawnAt: 1 }, 1);
    expect(openWithMaster(MASTER, 3, 'u1', old)).toEqual({ withdrawnAt: 1 });
    const fresh = await seal('u1', { withdrawnAt: 2 }, 3);
    expect(openWithMaster(MASTER, 3, 'u1', fresh)).toEqual({ withdrawnAt: 2 });
    expect(() => openWithMaster(MASTER, 3, 'u1', { ...old, salt: 'zzzz' })).toThrow(
      'no-key-for-salt',
    );
    expect(openWithMaster(MASTER, Number.NaN, 'u1', old)).toEqual({ withdrawnAt: 1 });
  });

  it('withdrawnAt and the expiry', () => {
    expect(withdrawnAtOf({ withdrawnAt: 10 })).toBe(10);
    for (const bad of [null, {}, { withdrawnAt: 0 }, { withdrawnAt: '5' }, { withdrawnAt: NaN }])
      expect(withdrawnAtOf(bad)).toBeNull();
    expect(retentionExpired(NOW - 30 * DAY, NOW)).toBe(true);
    expect(retentionExpired(NOW - 30 * DAY + 1, NOW)).toBe(false);
    expect(retentionExpired(NOW + DAY, NOW)).toBe(false);
  });
});

interface Acc {
  state?: unknown;
  consent?: { action: string; at: number } | null;
  plain?: boolean;
}

async function fakePorts(accs: Record<string, Acc>) {
  const states = new Map<string, Record<string, unknown>>();
  for (const [uid, a] of Object.entries(accs)) {
    if (a.state === undefined) continue;
    states.set(uid, a.plain ? { updatedAt: 1 } : { updatedAt: 1, enc: await seal(uid, a.state) });
  }
  const deleted: string[] = [];
  const ports: AtlasRetentionPorts = {
    userIds: async () => Object.keys(accs),
    readStates: async (uids) => new Map([...states].filter(([u]) => uids.includes(u))),
    latestConsent: async (u) => accs[u].consent ?? null,
    open: async (u, env) => openEnvelope(env, vaultKeyFor(MASTER, u, 1).key),
    deleteChat: async (u) => void deleted.push(u),
  };
  return { ports, deleted };
}

describe('sweepAtlasChat', () => {
  const W = { action: 'withdraw', at: NOW - 40 * DAY };
  it('deletes only: withdrawn long enough ago AND the newest consent is still a withdrawal', async () => {
    const { ports, deleted } = await fakePorts({
      due: { state: { withdrawnAt: NOW - 31 * DAY }, consent: W },
      young: { state: { withdrawnAt: NOW - 10 * DAY }, consent: W },
      turnedOnAgain: {
        state: { withdrawnAt: NOW - 31 * DAY },
        consent: { action: 'grant', at: NOW - DAY },
      },
      noRecord: { state: { withdrawnAt: NOW - 31 * DAY }, consent: null },
      neverWithdrawn: {
        state: { clearedAt: 4, withdrawnAt: null },
        consent: { action: 'grant', at: 1 },
      },
      noState: {},
    });
    const r = await sweepAtlasChat(ports, NOW);
    expect(deleted).toEqual(['due']);
    expect(r).toEqual({ checked: 5, deleted: 1, failed: 0 });
  });

  it('skips a state that is not sealed, counts a failure and goes on with the others', async () => {
    const { ports, deleted } = await fakePorts({
      plain: { state: {}, plain: true, consent: W },
      broken: { state: { withdrawnAt: NOW - 31 * DAY }, consent: W },
      fine: { state: { withdrawnAt: NOW - 31 * DAY }, consent: W },
    });
    const open = ports.open;
    ports.open = vi.fn(async (u, env) => {
      if (u === 'broken') throw new Error('boom');
      return open(u, env);
    });
    const r = await sweepAtlasChat(ports, NOW);
    expect(deleted).toEqual(['fine']);
    expect(r).toEqual({ checked: 3, deleted: 1, failed: 1 });
  });

  it('is bounded per run and reads accounts in chunks', async () => {
    const accs: Record<string, Acc> = {};
    for (let i = 0; i < 450; i++)
      accs[`u${i}`] = { state: { withdrawnAt: NOW - 31 * DAY }, consent: W };
    const { ports, deleted } = await fakePorts(accs);
    const spy = vi.spyOn(ports, 'readStates');
    expect((await sweepAtlasChat(ports, NOW, 250)).deleted).toBe(250);
    expect(deleted).toHaveLength(250);
    expect(spy.mock.calls[0][0]).toHaveLength(200);
    const all = await fakePorts(accs);
    expect((await sweepAtlasChat(all.ports, NOW, 1000)).deleted).toBe(450);
  });
});
