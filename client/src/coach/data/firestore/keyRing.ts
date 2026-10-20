/**
 * Conversation key rings for the real adapters (plan-security C.2). One provider per signed-in user.
 *
 *  CLIENT  creates the conversation key (CK) on the device, keeps it sealed under the vault DEK
 *          (`users/{uid}/meta/chatKeys`, one entry per `cid:epoch`, so every device and every old epoch can be
 *          opened), wraps it for the trainer's SIGNED public key and publishes `conversations/{cid}.ck`.
 *          A new epoch starts when the relationship was re-linked (`coaching.keyEpoch`), when the client asks to
 *          reset or the 90-day flag `rotateDue` is set; a trainer key change (`keyStale`) re-wraps the same CK.
 *  TRAINER opens the published wrap with their private key. Only the CURRENT epoch is available (the unwrapped root
 *          is non-extractable and cannot be kept), so history from earlier epochs shows as unverified after a rotation.
 *
 * KEY RING OF PAST EPOCHS. A rotation inside a running relationship (reset, 90-day flag, trainer key change) keeps the
 * trainer able to read the history they legitimately held: the client device wraps every earlier epoch of the CURRENT
 * LINK PERIOD for the trainer's signed key into `conversations/{cid}/keyring/{epoch}` (the same wrap format as `ck`,
 * AAD-bound to cid, epoch and the trainer key fingerprint). A new link period starts when the relationship was ended
 * and re-created (the end function deleted `ck` and the whole keyring): the client records that epoch as the period
 * `floor` in its sealed key store and never wraps anything below it, so a removed trainer who is linked again gets the
 * new epochs only. A different trainer is a different conversation id: nothing of the old one is reachable. Rules: only
 * the client writes the ring, only the active parties read it; the end function deletes it.
 *
 * The client device creates the key as soon as it sees its own active conversation without one (ringBook, right
 * after the accept; idempotent), so the trainer never waits for the first chat message.
 *
 * Nothing is ever written in plaintext: a locked vault throws `vault-locked` before any write.
 */
import type { Vault } from '../../../autoVault';
import { fingerprint } from '../../../vaultGrants';
import { b64, decryptJson, encryptJson, isEnvelope, unb64 } from '../../../vaultCrypto';
import type { CoachKeyRecord } from '../../../vaultShare';
import {
  createChatWrap,
  isChatWrap,
  newConversationKeyBytes,
  openChatKey,
  ringFromBytes,
  type ChatKeyRing,
} from '../../../coachCrypto/conversationKey';
import { VaultLockedError } from '../../../coachCrypto/sealOrThrow';
import type { FsApi, Raw } from './fsApi';
import { trustedCoachPub, type ServerSigning } from './trust';

export interface RingDeps {
  fs: FsApi;
  vault: Vault;
  uid: string;
  side: 'client' | 'trainer';
  /** trainer: the signed-in coach's own record (private half sealed with the vault key) */
  loadOwnCoachKey?: () => Promise<CoachKeyRecord | null>;
  signing: () => Promise<ServerSigning | null>;
}

export interface RingProvider {
  /** Ring to READ a document of this epoch; null when this device does not hold it. */
  forEpoch(cid: string, epoch: number): Promise<ChatKeyRing | null>;
  /** Ring to WRITE now (the current epoch). The client creates and publishes the key when needed. */
  current(cid: string): Promise<ChatKeyRing>;
  /** Rings of the epochs BEFORE `current` this device can open (client: its key store above the period floor; trainer: the key ring). */
  past(cid: string, current: number): Promise<Map<number, ChatKeyRing>>;
  /**
   * CLIENT only: lend the raw key bytes of one epoch to `fn` (to derive and wrap the schedule and request sub-keys for a
   * manager) and zero them afterwards. `null` when this device does not hold that epoch (or on the trainer side).
   */
  withRawKey?<T>(
    cid: string,
    epoch: number,
    fn: (raw: Uint8Array) => Promise<T>,
  ): Promise<T | null>;
  /** Drop every cached key (sign-out, relationship end). */
  forget(): void;
}

const keysPath = (uid: string) => `users/${uid}/meta/chatKeys`;
type KeyMap = Record<string, string>;
/** first epoch of the current link period, per conversation */
type FloorMap = Record<string, number>;
const ringPath = (cid: string, epoch: number) => `conversations/${cid}/keyring/${epoch}`;

export function createRingProvider(d: RingDeps): RingProvider {
  const rings = new Map<string, Promise<ChatKeyRing | null>>();
  let keys: KeyMap | null = null;
  let floors: FloorMap = {};
  const published = new Set<string>(); // `${cid}:${epoch}:${fp}` the ring was verified complete for, this session

  const material = () => {
    const m = d.vault.materialOrNull();
    if (!m) throw new VaultLockedError();
    return m;
  };

  async function loadKeys(): Promise<KeyMap> {
    const m = material();
    if (keys) return keys;
    const raw = await d.fs.get(keysPath(d.uid));
    const body =
      raw && isEnvelope(raw.enc)
        ? await decryptJson<{ keys: KeyMap; floor?: FloorMap }>(m.key, raw.enc)
        : null;
    floors = { ...(body?.floor ?? {}) };
    keys = body?.keys ?? {};
    return keys;
  }
  async function persist(nextKeys: KeyMap, nextFloors: FloorMap): Promise<void> {
    const m = material();
    await d.fs.set(keysPath(d.uid), {
      v: 1,
      enc: await encryptJson(m.key, m.salt, { keys: nextKeys, floor: nextFloors }),
    });
    keys = nextKeys;
    floors = nextFloors;
  }
  async function saveKey(id: string, rawB64: string, floorOf?: { cid: string; epoch: number }) {
    const cur = { ...(await loadKeys()), [id]: rawB64 };
    await persist(cur, floorOf ? { ...floors, [floorOf.cid]: floorOf.epoch } : floors);
  }
  async function saveFloor(cid: string, epoch: number): Promise<void> {
    await persist(await loadKeys(), { ...floors, [cid]: epoch });
  }

  const remember = (id: string, p: Promise<ChatKeyRing | null>) => {
    rings.set(id, p);
    p.then((r) => {
      if (!r) rings.delete(id); // retry later (offline / not published yet)
    }).catch(() => rings.delete(id));
    return p;
  };

  async function ringFromStore(cid: string, epoch: number): Promise<ChatKeyRing | null> {
    const k = (await loadKeys())[`${cid}:${epoch}`];
    return k ? ringFromBytes(cid, epoch, unb64(k)) : null;
  }

  async function trainerRing(cid: string, epoch: number): Promise<ChatKeyRing | null> {
    const conv = await d.fs.get(`conversations/${cid}`);
    let wrap: unknown = conv?.ck;
    if (!conv || conv.trainerId !== d.uid || !isChatWrap(wrap)) return null;
    if (wrap.epoch < epoch) return null; // an epoch that does not exist yet
    if (wrap.epoch > epoch) {
      // an earlier epoch: only through the key ring the client device published for this trainer key
      const row = await d.fs.get(ringPath(cid, epoch));
      wrap = row?.ck;
      if (!isChatWrap(wrap) || wrap.epoch !== epoch) return null;
    }
    const rec = await d.loadOwnCoachKey?.();
    if (!rec) return null;
    try {
      return await openChatKey(wrap, cid, rec, material().key);
    } catch {
      return null; // wrong key pair (rotated) or tampered: the client device re-wraps
    }
  }

  const get = (cid: string, epoch: number) => {
    const id = `${cid}:${epoch}`;
    return (
      rings.get(id) ??
      remember(id, d.side === 'client' ? ringFromStore(cid, epoch) : trainerRing(cid, epoch))
    );
  };

  async function clientCurrent(cid: string): Promise<ChatKeyRing> {
    material();
    const conv = await d.fs.get(`conversations/${cid}`);
    if (!conv || conv.clientId !== d.uid) throw new Error('no-conversation');
    const coaching = await d.fs.get(`coaching/${d.uid}`);
    const cur = Number(conv.keyEpoch ?? 0);
    let want = Math.max(Number(coaching?.keyEpoch ?? 1), cur, 1);
    if (conv.rotateDue === true && cur >= want) want = cur + 1;
    const hadWrap = isChatWrap(conv.ck);
    let upToDate = cur === want && hadWrap && conv.keyStale !== true;
    if (!upToDate && cur === want && hadWrap && conv.keyStale === true) {
      // the flag may lag behind the wrap (the server clears it a moment after the re-wrap): a wrap that already
      // carries the fingerprint of the trainer's current SIGNED key is current, and the rules refuse the same one twice
      const signed = await trustedCoachPub(
        await d.fs.get(`coachKeys/${String(conv.trainerId)}`),
        String(conv.trainerId),
        await d.signing(),
      );
      if (signed && (conv.ck as { fp?: unknown }).fp === (await fingerprint(signed)))
        upToDate = true;
    }
    if (upToDate) {
      const r = await get(cid, want);
      if (r) {
        await publishPast(cid, want, null, conv).catch(() => undefined);
        return r;
      }
      want = cur + 1; // the key of this epoch is not on any device any more: start a new epoch
    }

    // Wrap for the trainer's SIGNED key only; anything else is refused (key substitution).
    const pub = await trustedCoachPub(
      await d.fs.get(`coachKeys/${String(conv.trainerId)}`),
      String(conv.trainerId),
      await d.signing(),
    );
    if (!pub) throw new Error('untrusted-trainer-key');

    const store = await loadKeys();
    const known = store[`${cid}:${want}`];
    const raw = known ? unb64(known) : newConversationKeyBytes();
    // a conversation without a published wrap (first link, or re-linked after the end function removed it) starts a NEW
    // link period; a rotation or trainer-key re-wrap inside a running one keeps the period (legacy: it began at `cur`)
    const floor = hadWrap ? (floors[cid] ?? Math.max(1, cur)) : want;
    if (!known) await saveKey(`${cid}:${want}`, b64(raw), { cid, epoch: floor });
    else if (floors[cid] !== floor) await saveFloor(cid, floor);
    const wrap = await createChatWrap(raw, cid, want, pub);
    await d.fs.update(`conversations/${cid}`, { ck: wrap as unknown as Raw, keyEpoch: want });
    rings.delete(`${cid}:${want}`);
    const ring = await ringFromBytes(cid, want, raw);
    remember(`${cid}:${want}`, Promise.resolve(ring));
    await publishPast(cid, want, pub, conv).catch(() => undefined);
    return ring;
  }

  /**
   * One creation at a time per conversation on this device: the book (right after accept) and a chat send can both ask
   * for the key in the same tick; they share one run. Across devices the rules decide (`ckStep`: the first wrap of an
   * epoch wins, the other device's write is refused and it adopts the published epoch on its next call).
   */
  const inflight = new Map<string, Promise<ChatKeyRing>>();
  function clientCurrentOnce(cid: string): Promise<ChatKeyRing> {
    const running = inflight.get(cid);
    if (running) return running;
    const run = clientCurrent(cid).finally(() => inflight.delete(cid));
    inflight.set(cid, run);
    return run;
  }

  /**
   * Client: make sure the trainer's key ring holds a wrap, for the CURRENT trainer key, of every earlier epoch of this
   * link period that this device has. Idempotent (verified once per session and key), best effort: a failure never
   * blocks chat, and a trainer who has no wrap simply sees that history as unverified.
   */
  async function publishPast(cid: string, epoch: number, pubIn: JsonWebKey | null, conv: Raw) {
    const store = await loadKeys();
    const floor = floors[cid] ?? epoch;
    const wanted: number[] = [];
    for (let e = floor; e < epoch; e++) if (store[`${cid}:${e}`]) wanted.push(e);
    if (!wanted.length) return;
    const pub =
      pubIn ??
      (await trustedCoachPub(
        await d.fs.get(`coachKeys/${String(conv.trainerId)}`),
        String(conv.trainerId),
        await d.signing(),
      ));
    if (!pub) return;
    const fp = await fingerprint(pub);
    const mark = `${cid}:${epoch}:${fp}`;
    if (published.has(mark)) return;
    const rows = await d.fs.getDocs(`conversations/${cid}/keyring`, {});
    const have = new Map(rows.map((r) => [r.id, r.data]));
    for (const e of wanted) {
      const cur = have.get(String(e))?.ck as { fp?: unknown } | undefined;
      if (cur?.fp === fp) continue;
      const raw = unb64(store[`${cid}:${e}`]);
      const wrap = await createChatWrap(raw, cid, e, pub);
      raw.fill(0);
      await d.fs.set(ringPath(cid, e), {
        epoch: e,
        ck: wrap as unknown as Raw,
        at: d.fs.now(),
      });
    }
    published.add(mark);
  }

  async function trainerCurrent(cid: string): Promise<ChatKeyRing> {
    material();
    const conv = await d.fs.get(`conversations/${cid}`);
    if (!conv || conv.trainerId !== d.uid) throw new Error('no-conversation');
    if (!isChatWrap(conv.ck)) throw new Error('chat-key-missing'); // "Setting up secure chat…"
    const r = await get(cid, conv.ck.epoch);
    if (!r) throw new Error('chat-key-missing');
    return r;
  }

  async function past(cid: string, current: number): Promise<Map<number, ChatKeyRing>> {
    const out = new Map<number, ChatKeyRing>();
    let epochs: number[];
    if (d.side === 'client') {
      // the client holds every epoch it ever created or received, whatever the link period
      const store = await loadKeys();
      epochs = Object.keys(store)
        .filter((k) => k.startsWith(`${cid}:`))
        .map((k) => Number(k.slice(cid.length + 1)))
        .filter((e) => Number.isInteger(e) && e < current);
    } else {
      const rows = await d.fs.getDocs(`conversations/${cid}/keyring`, {});
      epochs = rows.map((r) => Number(r.id)).filter((e) => Number.isInteger(e) && e < current);
    }
    await Promise.all(
      epochs.map(async (e) => {
        const r = await get(cid, e).catch(() => null);
        if (r) out.set(e, r);
      }),
    );
    return out;
  }

  return {
    forEpoch: (cid, epoch) => get(cid, epoch),
    past,
    async withRawKey(cid, epoch, fn) {
      if (d.side !== 'client') return null;
      const k = (await loadKeys())[`${cid}:${epoch}`];
      if (!k) return null;
      const raw = unb64(k);
      try {
        return await fn(raw);
      } finally {
        raw.fill(0);
      }
    },
    current: (cid) => (d.side === 'client' ? clientCurrentOnce(cid) : trainerCurrent(cid)),
    forget() {
      rings.clear();
      keys = null;
      floors = {};
      published.clear();
    },
  };
}
