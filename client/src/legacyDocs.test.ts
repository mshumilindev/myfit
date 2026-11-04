// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readyVault, unsetVault } from './testVault';
import { OPEN_FIELDS, isSealed, sealDoc, unsealDoc, type SealedCollection } from './encryptedDoc';
import { MIGRATION_ORDER, migrateAll, rollbackCollection, type MigratePorts } from './vaultMigrate';
import { LEGACY_DOCS } from './__fixtures__/legacyDocs';

/** SPO-65: documents written by old versions stay readable, are migrated without loss, and are never rewritten twice. */
const COLLECTIONS = Object.keys(OPEN_FIELDS) as SealedCollection[];
const fixture = (c: SealedCollection) => {
  const [id, doc] = LEGACY_DOCS[c] as readonly [string, Record<string, unknown>];
  return { id, doc };
};

function store() {
  const data = new Map<string, Record<string, unknown>>();
  for (const c of COLLECTIONS) {
    const { id, doc } = fixture(c);
    data.set(`${c}/${id}`, structuredClone(doc));
  }
  let writes = 0;
  const ports: MigratePorts = {
    list: async (c) =>
      [...data.entries()]
        .filter(([k]) => k.startsWith(`${c}/`))
        .map(([k, d]) => ({ id: k.slice(c.length + 1), data: d })),
    write: async (c, id, d) => {
      writes++;
      data.set(`${c}/${id}`, d);
    },
    enrich: (_c, d) => d,
  };
  return { data, ports, writes: () => writes };
}

describe('legacy documents (SPO-65)', () => {
  it('there is exactly one legacy fixture per sealable collection, and the migration order covers them all', () => {
    expect(Object.keys(LEGACY_DOCS).sort()).toEqual([...COLLECTIONS].sort());
    expect([...MIGRATION_ORDER].sort()).toEqual([...COLLECTIONS].sort());
  });

  it('every fixture is plaintext (no envelope) and carries all of its open fields that exist', () => {
    for (const c of COLLECTIONS) {
      const { doc } = fixture(c);
      expect(isSealed(doc), c).toBe(false);
      expect(typeof doc.updatedAt, c).toBe('number');
    }
  });

  it('the current reader returns each legacy document unchanged, even while the vault is locked', async () => {
    const locked = await unsetVault();
    expect(locked).toBeTruthy();
    for (const c of COLLECTIONS) {
      const { doc } = fixture(c);
      expect(await unsealDoc(structuredClone(doc), null), c).toEqual(doc);
    }
  });

  it('migration seals every fixture; reading the sealed result gives back the original, nothing lost', async () => {
    const v = await readyVault();
    const { data, ports } = store();
    const r = await migrateAll(v, ports);
    expect(r.ok).toBe(true);
    for (const c of COLLECTIONS) {
      const { id, doc } = fixture(c);
      const stored = data.get(`${c}/${id}`)!;
      expect(isSealed(stored), c).toBe(true);
      // open fields stay readable, everything else is hidden
      for (const k of OPEN_FIELDS[c] as readonly string[])
        if (k in doc) expect(stored[k], `${c}.${k}`).toEqual(doc[k]);
      expect(await unsealDoc(stored, v.material().key), c).toEqual(doc);
    }
  });

  it('already-logged data is not rewritten: a second run writes nothing and the stored bytes are identical', async () => {
    const v = await readyVault();
    const { data, ports, writes } = store();
    await migrateAll(v, ports);
    const after = writes();
    const snapshot = JSON.stringify([...data.entries()]);
    const second = await migrateAll(v, ports);
    expect(second.results.reduce((n, x) => n + x.migrated, 0)).toBe(0);
    expect(writes()).toBe(after);
    expect(JSON.stringify([...data.entries()])).toBe(snapshot);
  });

  it('a mixed collection (one legacy, one already sealed) migrates only the legacy document', async () => {
    const v = await readyVault();
    const { data, ports } = store();
    const { key, salt } = v.material();
    const sealedAlready = await sealDoc(
      'gyms',
      { id: 'g-new', updatedAt: 5, name: 'Sealed gym' },
      key,
      salt,
    );
    data.set('gyms/g-new', sealedAlready as unknown as Record<string, unknown>);
    const r = await migrateAll(v, ports);
    const gyms = r.results.find((x) => x.collection === 'gyms')!;
    expect(gyms).toMatchObject({ migrated: 1, alreadySealed: 1, failed: [] });
    expect(data.get('gyms/g-new')).toEqual(sealedAlready);
  });

  it('rollback restores each legacy fixture byte for byte', async () => {
    const v = await readyVault();
    const { data, ports } = store();
    const r = await migrateAll(v, ports);
    for (const res of r.results) await rollbackCollection(res.collection, res.backup, ports);
    for (const c of COLLECTIONS) {
      const { id, doc } = fixture(c);
      expect(data.get(`${c}/${id}`), c).toEqual(doc);
    }
  });
});
