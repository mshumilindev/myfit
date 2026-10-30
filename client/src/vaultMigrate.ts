/**
 * One-time migration of existing plaintext documents into sealed ones, one collection at a
 * time, in the same place. Each document is sealed, opened again and compared with the
 * original before it is written, so a crypto or shape problem can never lose data. The
 * plaintext originals are returned as a backup the user can download first.
 */
import { isSealed, sealDoc, unsealDoc, type SealedCollection } from './encryptedDoc';
import type { Vault } from './autoVault';

/**
 * Version of the order below. Bump it when a collection is ADDED: the "migrated" marker is kept per version, so every
 * account runs the migration again once (already sealed documents are skipped, so it is cheap and idempotent).
 */
export const MIGRATION_VERSION = 2;

/** Every collection `sealDoc` can seal (SPO-218: a document written before the vault was ready must not stay open). */
export const MIGRATION_ORDER: SealedCollection[] = [
  'workouts',
  'gyms',
  'restPeriods',
  'injuries',
  'activities',
  'atlasChat',
  'sleeps',
  'body',
  'conditions',
  'coachShare',
  'conditionPrefs',
  'nicotine',
  'cycle',
  'alcohol',
  'supplements',
  'goals',
  'home',
  'mastery',
  'coach',
  'exercisePrefs',
  'sleepPrefs',
  'widgetData',
  'challenges',
  'atlasChatState',
];

export interface MigratePorts {
  list(collection: SealedCollection): Promise<{ id: string; data: Record<string, unknown> }[]>;
  write(collection: SealedCollection, id: string, data: Record<string, unknown>): Promise<void>;
  /** Adds derived open fields (e.g. workout `stats`) before sealing. */
  enrich?(collection: SealedCollection, data: Record<string, unknown>): Record<string, unknown>;
}

export interface MigrateResult {
  collection: SealedCollection;
  migrated: number;
  alreadySealed: number;
  failed: { id: string; reason: string }[];
  /** Plaintext originals of the documents that were migrated. */
  backup: { id: string; data: Record<string, unknown> }[];
}

/** Key-order-independent JSON (sealing moves open fields first, so order differs). */
function stable(x: unknown): string {
  return JSON.stringify(x, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
}

export async function migrateCollection(
  collection: SealedCollection,
  vault: Vault,
  ports: MigratePorts,
  onProgress?: (done: number, total: number) => void,
): Promise<MigrateResult> {
  const { key, salt } = vault.material(); // throws when locked: never migrate blind
  const docs = await ports.list(collection);
  const res: MigrateResult = { collection, migrated: 0, alreadySealed: 0, failed: [], backup: [] };
  let done = 0;
  onProgress?.(0, docs.length);
  for (const { id, data } of docs) {
    try {
      if (isSealed(data)) {
        res.alreadySealed++;
      } else {
        const full = ports.enrich ? ports.enrich(collection, data) : data;
        const sealed = await sealDoc(collection, full, key, salt);
        const back = await unsealDoc<Record<string, unknown>>(sealed, key);
        if (stable(back) !== stable(JSON.parse(JSON.stringify(full))))
          throw new Error('round-trip mismatch');
        await ports.write(collection, id, sealed);
        res.backup.push({ id, data });
        res.migrated++;
      }
    } catch (e) {
      res.failed.push({ id, reason: e instanceof Error ? e.message : String(e) });
    }
    onProgress?.(++done, docs.length);
  }
  return res;
}

/** Undo for one collection from its backup (plaintext written back in place). */
export async function rollbackCollection(
  collection: SealedCollection,
  backup: MigrateResult['backup'],
  ports: Pick<MigratePorts, 'write'>,
): Promise<number> {
  for (const { id, data } of backup) await ports.write(collection, id, data);
  return backup.length;
}

/** Runs every collection in order; stops at the first one with failures. */
export async function migrateAll(
  vault: Vault,
  ports: MigratePorts,
  onProgress?: (collection: SealedCollection, done: number, total: number) => void,
): Promise<{ results: MigrateResult[]; ok: boolean }> {
  const results: MigrateResult[] = [];
  for (const c of MIGRATION_ORDER) {
    const r = await migrateCollection(c, vault, ports, (d, t) => onProgress?.(c, d, t));
    results.push(r);
    if (r.failed.length) return { results, ok: false };
  }
  return { results, ok: true };
}
