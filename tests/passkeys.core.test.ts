import { describe, expect, it } from 'vitest';
import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';
import {
  loginOptionsCore,
  loginVerifyCore,
  PasskeyError,
  registerOptionsCore,
  registerVerifyCore,
  type ChallengeDoc,
  type PasskeyDoc,
  type PasskeyStore,
} from '../functions/src/passkeysCore';

const rp = { rpID: 'localhost', origin: 'http://localhost:5173' };
const b64u = (b: Uint8Array | Buffer) => Buffer.from(b).toString('base64url');
/** Minimal CBOR encoder (ints, bytes, text, maps): enough for a COSE key and an attestation object. */
function cbor(v: unknown): Buffer {
  const head = (major: number, n: number): Buffer => {
    if (n < 24) return Buffer.from([(major << 5) | n]);
    if (n < 256) return Buffer.from([(major << 5) | 24, n]);
    const b = Buffer.alloc(3);
    b[0] = (major << 5) | 25;
    b.writeUInt16BE(n, 1);
    return b;
  };
  if (typeof v === 'number') return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (typeof v === 'string') return Buffer.concat([head(3, Buffer.byteLength(v)), Buffer.from(v)]);
  if (ArrayBuffer.isView(v))
    return Buffer.concat([
      head(2, v.byteLength),
      Buffer.from(v.buffer, v.byteOffset, v.byteLength),
    ]);
  if (v instanceof Map)
    return Buffer.concat([head(5, v.size), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)])]);
  throw new Error('unsupported');
}
const sha256 = (b: Uint8Array | Buffer | string) => createHash('sha256').update(b).digest();

function memoryStore() {
  const challenges = new Map<string, ChallengeDoc>();
  const keys = new Map<string, PasskeyDoc>();
  const store: PasskeyStore = {
    putChallenge: async (id, d) => void challenges.set(id, d),
    takeChallenge: async (id) => {
      const d = challenges.get(id) ?? null;
      challenges.delete(id);
      return d;
    },
    getPasskey: async (id) => keys.get(id) ?? null,
    savePasskey: async (id, d) => void keys.set(id, d),
    updatePasskey: async (id, p) => void keys.set(id, { ...keys.get(id)!, ...p }),
    listPasskeys: async (uid) =>
      [...keys]
        .filter(([, d]) => d.userId === uid)
        .map(([id, d]) => ({ id, transports: d.transports })),
  };
  return { store, keys, challenges };
}

/** A software platform authenticator: ES256, "none" attestation, user verified. */
function authenticator() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const credId = randomBytes(16);
  const cose = cbor(
    new Map<number, number | Uint8Array>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(jwk.x!, 'base64url')],
      [-3, Buffer.from(jwk.y!, 'base64url')],
    ]),
  );
  const counterBytes = (n: number) => {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(n);
    return b;
  };
  const clientData = (type: string, challenge: string, origin = rp.origin) =>
    Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  return {
    id: b64u(credId),
    create(challenge: string, origin = rp.origin) {
      const idLen = Buffer.alloc(2);
      idLen.writeUInt16BE(credId.length);
      const authData = Buffer.concat([
        sha256(rp.rpID),
        Buffer.from([0x45]),
        counterBytes(0),
        Buffer.alloc(16),
        idLen,
        credId,
        Buffer.from(cose),
      ]);
      const attestationObject = cbor(
        new Map<string, unknown>([
          ['fmt', 'none'],
          ['attStmt', new Map()],
          ['authData', authData],
        ]),
      );
      return {
        id: b64u(credId),
        rawId: b64u(credId),
        type: 'public-key' as const,
        response: {
          clientDataJSON: b64u(clientData('webauthn.create', challenge, origin)),
          attestationObject: b64u(attestationObject),
          transports: ['internal' as const],
        },
        clientExtensionResults: {},
      };
    },
    get(
      challenge: string,
      counter: number,
      opts: { origin?: string; key?: KeyObject; id?: string } = {},
    ) {
      const cd = clientData('webauthn.get', challenge, opts.origin);
      const authData = Buffer.concat([sha256(rp.rpID), Buffer.from([0x05]), counterBytes(counter)]);
      const signature = sign(
        'sha256',
        Buffer.concat([authData, sha256(cd)]),
        opts.key ?? privateKey,
      );
      const id = opts.id ?? b64u(credId);
      return {
        id,
        rawId: id,
        type: 'public-key' as const,
        response: {
          authenticatorData: b64u(authData),
          clientDataJSON: b64u(cd),
          signature: b64u(signature),
          userHandle: b64u(Buffer.from('uA')),
        },
        clientExtensionResults: {},
      };
    },
  };
}

async function registered() {
  const m = memoryStore();
  const dev = authenticator();
  const now = 1_000_000;
  const opts = await registerOptionsCore(m.store, {
    uid: 'uA',
    userName: 'Anna',
    rp,
    challengeId: 'c-reg',
    now,
  });
  await registerVerifyCore(m.store, {
    uid: 'uA',
    rp,
    challengeId: 'c-reg',
    response: dev.create(opts.options.challenge),
    now,
  });
  return { ...m, dev, now };
}

const fails = async (p: Promise<unknown>, code: string) => {
  const e = await p.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(PasskeyError);
  expect((e as PasskeyError).code).toBe(code);
};

describe('passkeys: server rules with a software authenticator', () => {
  it('registers a passkey for the signed-in person and then signs them in', async () => {
    const r = await registered();
    expect(r.keys.get(r.dev.id)?.userId).toBe('uA');
    const lo = await loginOptionsCore(r.store, {
      userId: 'uA',
      rp,
      challengeId: 'c-login',
      now: r.now,
    });
    expect(lo.options.allowCredentials?.map((c) => c.id)).toEqual([r.dev.id]);
    const uid = await loginVerifyCore(r.store, {
      rp,
      challengeId: 'c-login',
      response: r.dev.get(lo.options.challenge, 1),
      now: r.now,
    });
    expect(uid).toBe('uA');
    expect(r.keys.get(r.dev.id)?.counter).toBe(1);
  });

  it('a challenge works once: replaying the same assertion is refused', async () => {
    const r = await registered();
    const lo = await loginOptionsCore(r.store, { userId: 'uA', rp, challengeId: 'c1', now: r.now });
    const resp = r.dev.get(lo.options.challenge, 1);
    await loginVerifyCore(r.store, { rp, challengeId: 'c1', response: resp, now: r.now });
    await fails(
      loginVerifyCore(r.store, { rp, challengeId: 'c1', response: resp, now: r.now }),
      'deadline-exceeded',
    );
  });

  it('refuses a stale counter (cloned authenticator)', async () => {
    const r = await registered();
    const l1 = await loginOptionsCore(r.store, { userId: 'uA', rp, challengeId: 'c1', now: r.now });
    await loginVerifyCore(r.store, {
      rp,
      challengeId: 'c1',
      response: r.dev.get(l1.options.challenge, 5),
      now: r.now,
    });
    const l2 = await loginOptionsCore(r.store, { userId: 'uA', rp, challengeId: 'c2', now: r.now });
    await fails(
      loginVerifyCore(r.store, {
        rp,
        challengeId: 'c2',
        response: r.dev.get(l2.options.challenge, 5),
        now: r.now,
      }),
      'unauthenticated',
    );
  });

  it('refuses a wrong origin', async () => {
    const r = await registered();
    const lo = await loginOptionsCore(r.store, { userId: 'uA', rp, challengeId: 'c1', now: r.now });
    await fails(
      loginVerifyCore(r.store, {
        rp,
        challengeId: 'c1',
        response: r.dev.get(lo.options.challenge, 1, { origin: 'https://evil.example' }),
        now: r.now,
      }),
      'unauthenticated',
    );
  });

  it('refuses a credential nobody registered, and one signed with another key', async () => {
    const r = await registered();
    const other = authenticator();
    const l1 = await loginOptionsCore(r.store, { userId: null, rp, challengeId: 'c1', now: r.now });
    await fails(
      loginVerifyCore(r.store, {
        rp,
        challengeId: 'c1',
        response: other.get(l1.options.challenge, 1),
        now: r.now,
      }),
      'unauthenticated',
    );
    const l2 = await loginOptionsCore(r.store, { userId: 'uA', rp, challengeId: 'c2', now: r.now });
    const forged = other.get(l2.options.challenge, 1, { id: r.dev.id });
    await fails(
      loginVerifyCore(r.store, { rp, challengeId: 'c2', response: forged, now: r.now }),
      'unauthenticated',
    );
  });

  it('refuses an expired challenge and a challenge issued to another person', async () => {
    const m = memoryStore();
    const dev = authenticator();
    const o = await registerOptionsCore(m.store, {
      uid: 'uA',
      userName: 'Anna',
      rp,
      challengeId: 'c1',
      now: 1000,
    });
    await fails(
      registerVerifyCore(m.store, {
        uid: 'uA',
        rp,
        challengeId: 'c1',
        response: dev.create(o.options.challenge),
        now: 1000 + 6 * 60 * 1000,
      }),
      'deadline-exceeded',
    );
    const o2 = await registerOptionsCore(m.store, {
      uid: 'uA',
      userName: 'Anna',
      rp,
      challengeId: 'c2',
      now: 1000,
    });
    await fails(
      registerVerifyCore(m.store, {
        uid: 'uB',
        rp,
        challengeId: 'c2',
        response: dev.create(o2.options.challenge),
        now: 1000,
      }),
      'permission-denied',
    );
    expect(m.keys.size).toBe(0);
  });
});
