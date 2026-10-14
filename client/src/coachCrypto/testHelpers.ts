/** Test helpers: two real people with real vault keys, a conversation id, and a shared ring. */
import { b64, importRawKey } from '../vaultCrypto';
import { createCoachKey, type CoachKeyRecord } from '../vaultShare';
import {
  createChatWrap,
  newConversationKeyBytes,
  openChatKey,
  ringFromBytes,
  type ChatKeyRing,
} from './conversationKey';

export const CID = 'abcdefghijklmnopqrstuvwxyz'.slice(0, 26);
export const CID2 = 'bcdefghijklmnopqrstuvwxyza'.slice(0, 26);

export async function person() {
  const rnd = (n: number) => b64(globalThis.crypto.getRandomValues(new Uint8Array(n)));
  return { salt: rnd(16), key: await importRawKey(rnd(32), true) };
}

export async function trainer(): Promise<{
  key: CryptoKey;
  salt: string;
  rec: CoachKeyRecord;
}> {
  const p = await person();
  return { ...p, rec: await createCoachKey(p.key, p.salt) };
}

/** Client generates a CK, wraps it for the trainer; both end up with a ring on the same CK. */
export async function pairedRings(
  t: Awaited<ReturnType<typeof trainer>>,
  cid = CID,
  epoch = 1,
): Promise<{ client: ChatKeyRing; trainer: ChatKeyRing }> {
  const raw = newConversationKeyBytes();
  const wrap = await createChatWrap(raw, cid, epoch, t.rec.pub);
  const client = await ringFromBytes(cid, epoch, raw);
  return { client, trainer: await openChatKey(wrap, cid, t.rec, t.key) };
}
