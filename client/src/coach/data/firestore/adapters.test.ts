// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { b64 } from '../../../vaultCrypto';
import { fingerprint } from '../../../vaultGrants';
import { createCoachKey } from '../../../vaultShare';
import { readyVault } from '../../../testVault';
import type { ChatMessage } from '../../chat/types';
import { createFirestoreChatPort } from './chatPort';
import { createRingProvider } from './keyRing';
import { createMemoryFs } from './memoryFs';
import { coachKeySigPayload, createServerSigningLoader } from './trust';
import { liftsFromView, totalsFromRead, workoutsToLifts } from './worldMap';
import { toPortError } from './errors';

const CID = 'abcdefghijklmnopqrstuvwxyz';
const T = 'trainer-1';
const C = 'client-1';
const NOW = 1_800_000_000_000;

async function world() {
  const fs = createMemoryFs(NOW);
  // the server signing key (Ed25519), public half published in config/coachSigning
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  fs.seed('config/coachSigning', {
    alg: 'Ed25519',
    kid: 'srv1',
    pub: `-----BEGIN PUBLIC KEY-----\n${b64(spki)}\n-----END PUBLIC KEY-----`,
  });
  const tv = await readyVault();
  const cv = await readyVault();
  const m = tv.materialOrNull()!;
  const rec = await createCoachKey(m.key, m.salt);
  const sig = async (updatedAt: number) =>
    b64(
      new Uint8Array(
        await crypto.subtle.sign(
          { name: 'Ed25519' },
          pair.privateKey,
          new TextEncoder().encode(
            coachKeySigPayload(T, await fingerprint(rec.pub), updatedAt, 'srv1'),
          ),
        ),
      ),
    );
  fs.seed(`coachKeys/${T}`, { pub: rec.pub, updatedAt: NOW, kid: 'srv1', sig: await sig(NOW) });
  fs.seed(`conversations/${CID}`, {
    clientId: C,
    trainerId: T,
    active: true,
    keyEpoch: 1,
    lastAt: null,
    unread: {},
  });
  fs.seed(`coaching/${C}`, { keyEpoch: 1, trainerId: T, status: 'active' });
  const signing = createServerSigningLoader(fs);
  const mk = (uid: string, side: 'client' | 'trainer', vault: typeof tv) => {
    const rings = createRingProvider({
      fs,
      vault,
      uid,
      side,
      signing,
      loadOwnCoachKey: async () => rec,
    });
    return createFirestoreChatPort({ fs, vault, uid, side, rings });
  };
  return { fs, client: mk(C, 'client', cv), trainer: mk(T, 'trainer', tv), rec };
}

const draft = (id: string, text: string, at: number) => ({
  id,
  at,
  text,
  state: 'sending' as const,
});

describe('firestore chat port (memory store)', () => {
  it('client sends sealed, trainer reads it; nothing readable is stored', async () => {
    const w = await world();
    await w.client.send(CID, draft('m1', 'my shoulder hurts', NOW) as never);
    expect(w.fs.dump()).not.toContain('shoulder');
    const got = await new Promise<ChatMessage[]>((res, rej) => {
      const off = w.trainer.subscribeMessages(
        CID,
        (l) => {
          if (l.length) {
            off();
            res(l);
          }
        },
        rej,
      );
    });
    expect(got[0]).toMatchObject({
      id: 'm1',
      from: 'client',
      body: { kind: 'text', text: 'my shoulder hurts' },
    });
    expect(got[0].unverified).toBeFalsy();
  });

  it('a retried send of a message that already exists is a success', async () => {
    const w = await world();
    await w.client.send(CID, draft('m1', 'a', NOW) as never);
    await expect(w.client.send(CID, draft('m1', 'a', NOW) as never)).resolves.toBeUndefined();
  });

  it('refuses to wrap the key for an unsigned trainer key', async () => {
    const w = await world();
    const cur = await w.fs.get(`coachKeys/${T}`);
    w.fs.seed(`coachKeys/${T}`, { ...cur!, sig: 'AAAA' });
    await expect(w.client.send(CID, draft('m1', 'x', NOW) as never)).rejects.toThrow(
      'untrusted-trainer-key',
    );
  });

  it('the trainer cannot send before the client published the key', async () => {
    const w = await world();
    await expect(w.trainer.send(CID, draft('m1', 'x', NOW) as never)).rejects.toThrow(
      'chat-key-missing',
    );
  });

  it('a tampered ciphertext is shown as unverified without content', async () => {
    const w = await world();
    await w.client.send(CID, draft('m1', 'hello there', NOW) as never);
    const path = `conversations/${CID}/messages/m1`;
    const d = (await w.fs.get(path))!;
    w.fs.seed(path, { ...d, at: (d.at as number) + 5000 });
    const got = await new Promise<ChatMessage[]>((res, rej) => {
      const off = w.trainer.subscribeMessages(
        CID,
        (l) => {
          if (l.length) {
            off();
            res(l);
          }
        },
        rej,
      );
    });
    expect(got[0].unverified).toBe(true);
    expect(JSON.stringify(got[0])).not.toContain('hello');
  });
});

describe('world mapping and errors', () => {
  it('maps effects totals and full workouts', () => {
    expect(totalsFromRead({ state: 'locked' }, NOW)).toBeUndefined();
    const t = totalsFromRead(
      { state: 'ok', level: 'full', asOf: NOW, docs: [{ startedAt: NOW - 86_400_000 }] },
      NOW,
    )!;
    expect(t.daysSinceLast).toBe(1);
    expect(liftsFromView({})).toBeUndefined();
    expect(workoutsToLifts([])).toEqual([]);
  });
  it('maps errors to port codes', () => {
    expect(toPortError({ status: 403 }).code).toBe('forbidden');
    expect(toPortError({ code: 'functions/unavailable' }).code).toBe('offline');
    expect(toPortError({ name: 'VaultLockedError' }).code).toBe('vault-locked');
  });
});

describe('signature payload parity with functions/src/coach/service.ts', () => {
  it('uses the exact strings the server signs', async () => {
    const { signKeySigPayload } = await import('./trust');
    expect(coachKeySigPayload('u1', 'fp', 5, 'k1')).toBe('coachkey|1|k1|u1|fp|5');
    expect(signKeySigPayload('s1', 'u1', 'k1', 'PUB')).toBe('signkey|1|s1|u1|k1|PUB');
  });
});
