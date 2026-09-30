// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createCoachKey, createGrant, isGrant, openGrant } from './vaultShare';
import { b64, decryptJson, encryptJson, importRawKey } from './vaultCrypto';
import { sealDoc, unsealDoc } from './encryptedDoc';

async function person() {
  const rnd = (n: number) => b64(globalThis.crypto.getRandomValues(new Uint8Array(n)));
  return { salt: rnd(16), key: await importRawKey(rnd(32), true) };
}

describe('coach grants', () => {
  it('a coach reads what the athlete sealed, using only their own vault key', async () => {
    const athlete = await person();
    const coach = await person();
    const rec = await createCoachKey(coach.key, coach.salt);
    const grant = await createGrant(athlete.key, athlete.salt, rec.pub);
    expect(isGrant(grant)).toBe(true);

    const sealed = await sealDoc(
      'injuries',
      { id: 'i', updatedAt: 1, name: 'Knee', note: 'private' },
      athlete.key,
      athlete.salt,
    );
    const opened = await openGrant(grant, rec, coach.key);
    expect(opened.salt).toBe(athlete.salt);
    expect(await unsealDoc(sealed, opened.key)).toEqual({
      id: 'i',
      updatedAt: 1,
      name: 'Knee',
      note: 'private',
    });
  });

  it('the grant itself reveals nothing and is different every time', async () => {
    const athlete = await person();
    const coach = await person();
    const rec = await createCoachKey(coach.key, coach.salt);
    const a = await createGrant(athlete.key, athlete.salt, rec.pub);
    const b = await createGrant(athlete.key, athlete.salt, rec.pub);
    expect(a.ct).not.toBe(b.ct);
    expect(JSON.stringify(rec)).not.toContain('"d"'); // private scalar never appears in the record
  });

  it('another coach cannot open it', async () => {
    const athlete = await person();
    const coach = await person();
    const other = await person();
    const rec = await createCoachKey(coach.key, coach.salt);
    const otherRec = await createCoachKey(other.key, other.salt);
    const grant = await createGrant(athlete.key, athlete.salt, rec.pub);
    await expect(openGrant(grant, otherRec, other.key)).rejects.toThrow();
  });

  it('a coach with the wrong vault key cannot unwrap their private key', async () => {
    const athlete = await person();
    const coach = await person();
    const rec = await createCoachKey(coach.key, coach.salt);
    const grant = await createGrant(athlete.key, athlete.salt, rec.pub);
    const stranger = await person();
    await expect(openGrant(grant, rec, stranger.key)).rejects.toThrow();
  });

  it('the coach key cannot encrypt new athlete data (decrypt only)', async () => {
    const athlete = await person();
    const coach = await person();
    const rec = await createCoachKey(coach.key, coach.salt);
    const { key } = await openGrant(
      await createGrant(athlete.key, athlete.salt, rec.pub),
      rec,
      coach.key,
    );
    await expect(encryptJson(key, athlete.salt, { x: 1 })).rejects.toThrow();
    const env = await encryptJson(athlete.key, athlete.salt, { x: 1 });
    expect(await decryptJson(key, env)).toEqual({ x: 1 });
  });
});
