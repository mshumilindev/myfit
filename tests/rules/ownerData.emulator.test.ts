/**
 * SPO-58: parity between the repo's rules interpreter (ownerData.rules.test.ts) and the REAL Firestore emulator.
 * Same table (`ownerData.rows.ts`), same expectations: whoever is not the owner reaches nothing; the owner reads exactly
 * what the table lists; the sealed meta documents accept an envelope and refuse plaintext. If the interpreter and the
 * emulator ever disagree, this file is the one that goes red.
 *
 * Needs the emulator (Java 21). Without it the suite is SKIPPED. Run: `npm run test:rules`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROWS, SEALED_META, env, stamped, type Row } from './ownerData.rows';

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
if (!HOST) {
  describe('owner data on the emulator (SKIPPED: FIRESTORE_EMULATOR_HOST is not set; run via firebase emulators:exec)', () =>
    it.skip('emulator unavailable', () => {}));
}
const suite = describe.skipIf(!HOST);

const OWNER = 'owner1';
const segs = (p: string) => p.split('/');

suite('owner data rules on the emulator (SPO-58)', () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let T: any; // RulesTestEnvironment
  let rt: any; // @firebase/rules-unit-testing
  let fs: any; // firebase/firestore
  /* eslint-enable @typescript-eslint/no-explicit-any */

  beforeAll(async () => {
    const rtName = '@firebase/rules-unit-testing';
    rt = await import(/* @vite-ignore */ rtName);
    fs = await import('firebase/firestore');
    const [host, port] = HOST!.split(':');
    T = await rt.initializeTestEnvironment({
      projectId: 'demo-spotter',
      firestore: {
        rules: readFileSync(resolve('firestore.rules'), 'utf8'),
        host,
        port: Number(port),
      },
    });
  });
  afterAll(async () => T?.cleanup());

  const who = {
    'signed out': () => T.unauthenticatedContext().firestore(),
    'another member': () => T.authenticatedContext('mallory', { role: 'member' }).firestore(),
    'a trainer': () => T.authenticatedContext('trainer1', { role: 'trainer' }).firestore(),
    'an admin': () => T.authenticatedContext('admin1', { role: 'admin' }).firestore(),
  } as const;
  const owner = () => T.authenticatedContext(OWNER, { role: 'member' }).firestore();

  async function seed(row: Row) {
    await T.clearFirestore();
    await T.withSecurityRulesDisabled(async (ctx: { firestore(): unknown }) => {
      const db = ctx.firestore();
      // live profiles back the role claims (the rules check the live user document)
      await fs.setDoc(fs.doc(db, 'users', 'trainer1'), { role: 'trainer', status: 'active' });
      await fs.setDoc(fs.doc(db, 'users', 'admin1'), { role: 'admin', status: 'active' });
      await fs.setDoc(fs.doc(db, 'users', 'mallory'), { role: 'member', status: 'active' });
      await fs.setDoc(fs.doc(db, 'users', OWNER), {
        role: 'member',
        status: 'active',
        firstName: 'A',
        lastName: 'B',
        username: 'owner',
      });
      await fs.setDoc(
        fs.doc(db, 'users', OWNER, ...segs(row.path)),
        row.before ?? { ...(row.valid ?? {}), updatedAt: 1 },
      );
    });
  }
  const docRef = (db: unknown, row: Row) => fs.doc(db, 'users', OWNER, ...segs(row.path));
  const colRef = (db: unknown, row: Row) =>
    fs.collection(db, 'users', OWNER, ...segs(row.path).slice(0, -1));

  describe.each(ROWS.map((r) => [r.pattern, r] as const))('%s', (_p, row) => {
    it.each(Object.keys(who) as (keyof typeof who)[])(
      '%s cannot read, list or write it',
      async (n) => {
        await seed(row);
        const db = who[n]();
        await rt.assertFails(fs.getDoc(docRef(db, row)));
        await rt.assertFails(fs.getDocs(colRef(db, row)));
        await rt.assertFails(fs.setDoc(docRef(db, row), row.valid ?? { updatedAt: 9 }));
        await rt.assertFails(fs.deleteDoc(docRef(db, row)));
      },
    );

    it('the owner reads and lists exactly as the table says', async () => {
      await seed(row);
      const db = owner();
      const check = (ok: boolean, p: Promise<unknown>) =>
        ok ? rt.assertSucceeds(p) : rt.assertFails(p);
      await check(row.owner.includes('get'), fs.getDoc(docRef(db, row)));
      await check(row.owner.includes('list'), fs.getDocs(colRef(db, row)));
    });
  });

  describe('sealed meta documents accept an envelope and refuse plaintext', () => {
    const rows = ROWS.filter((r) => SEALED_META.some((m) => r.pattern === `/meta/${m}`));
    it.each(rows.map((r) => [r.pattern, r] as const))('%s', async (_p, row) => {
      await T.clearFirestore();
      const db = owner();
      const ref = docRef(db, row);
      await rt.assertSucceeds(fs.setDoc(ref, stamped()));
      await rt.assertFails(fs.setDoc(ref, { ...stamped(), note: 'secret' }));
      await rt.assertFails(fs.setDoc(ref, { updatedAt: 5, name: 'secret' }));
      await rt.assertFails(fs.setDoc(ref, { updatedAt: 5, enc: { ...env(), v: 2 } }));
      await rt.assertFails(fs.setDoc(ref, { updatedAt: 5, enc: { ...env(), extra: 1 } }));
      expect(true).toBe(true);
    });
  });
});
