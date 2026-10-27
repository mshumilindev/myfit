/**
 * On-device copy of the person's own data, sealed (SPO-216).
 *
 * `store.persist()` used to write workouts, gyms, injuries, body, sleeps, activities, rest periods, goals, home sets,
 * mastery and the Atlas settings to `localStorage` as readable JSON. This keeps the same boot cache but only as a sealed
 * envelope under `<legacy key>.enc`, sealed with the vault key (like `conditionsCache.ts` / `cycleCache.ts`), with ONE
 * difference: there is no plaintext fallback.
 *
 *  - key available  -> the value is sealed and written to `<key>.enc`; the legacy plaintext key is removed only AFTER
 *                      the sealed write succeeded (migration; idempotent: nothing left to move the second time).
 *  - no key yet     -> nothing is written. The data is in memory and in Firestore (whose writes wait for the key, see
 *                      `vaultIO.prepareWrite`); a legacy plaintext copy that is already there is only READ at boot and
 *                      is sealed + removed the moment the key arrives. Sealing failed -> the plaintext is kept.
 *  - sealed copy exists but not merged yet -> `persist` does not overwrite it; `hydrate` merges first.
 *
 * `hydrate` runs when the vault key becomes available (from memory or from its IndexedDB cache, so offline starts work).
 * A Firestore answer that already arrived (`markRemote`) always wins over the on-device copy: the cache is only a faster
 * boot, never the truth, so a stale copy cannot bring back what was deleted elsewhere.
 */
import type { Vault } from './autoVault';
import { decryptJson, encryptJson, isEnvelope, type VaultEnvelope } from './vaultCrypto';

export const SEALED_SUFFIX = '.enc';
export const sealedKeyOf = (key: string): string => `${key}${SEALED_SUFFIX}`;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface MergeContext {
  /** Firestore already delivered the truth for this field. */
  remote: boolean;
  /** The value changed since boot (the person edited, or the server answered). */
  edited: boolean;
}

export interface SealedField<T> {
  /** The synchronous boot value: the legacy plaintext copy (migration read), else `fallback`. */
  load(fallback: T): T;
  /** Call once with the value loaded at boot. */
  boot(value: T): void;
  /** Firestore delivered the truth for this field. */
  markRemote(): void;
  /** Persist the current value. Never throws, never writes plaintext. */
  persist(value: T): void;
  /** Once the key is available: open the sealed copy and merge it into `current`. Null = nothing to change. */
  hydrate(current: T): Promise<T | null>;
  /** Reset / sign-out: remove both copies. */
  clear(): void;
  /** Resolves when every started seal has finished (tests, sign-out). */
  flush(): Promise<void>;
}

export function createSealedState(deps: {
  vault: Pick<Vault, 'materialOrNull'>;
  storage?: () => Store;
}) {
  const st = (): Store | null => {
    try {
      return deps.storage ? deps.storage() : localStorage;
    } catch {
      return null;
    }
  };
  return {
    field<T>(spec: {
      key: string;
      /** Combine the on-device value with `current` (already in memory). Not called when Firestore answered first. */
      merge: (current: T, stored: unknown, ctx: MergeContext) => T;
    }): SealedField<T> {
      const encKey = sealedKeyOf(spec.key);
      const hasEnc = (): boolean => {
        try {
          return !!st()?.getItem(encKey);
        } catch {
          return false;
        }
      };
      let bootJson: string | null = null;
      let encAtBoot = hasEnc();
      let hydrated = false;
      let remote = false;
      let seq = 0;
      // The value last handed to the sealer (written or still being sealed). Comparing against what is already
      // written would let an older in-flight seal land after a newer value that happens to equal the written one.
      let wanted: string | null = null;
      const pending = new Set<Promise<void>>();

      const removePlain = () => {
        try {
          st()?.removeItem(spec.key);
        } catch {
          /* nothing to remove */
        }
      };

      const persist = (value: T): void => {
        const m = deps.vault.materialOrNull();
        if (!m) return; // no key: memory + Firestore only, never plaintext
        if (encAtBoot && !hydrated) return; // the sealed copy is merged first, then re-sealed by `hydrate`
        const json = JSON.stringify(value);
        if (json === wanted) return;
        wanted = json;
        const my = ++seq;
        const p: Promise<void> = encryptJson(m.key, m.salt, { v: 1, d: value })
          .then((enc) => {
            if (my !== seq) return; // a newer value is being sealed
            const store = st();
            if (!store) return;
            store.setItem(encKey, JSON.stringify(enc));
            removePlain(); // only after the sealed copy is safely written
          })
          .catch(() => {
            if (my === seq) wanted = null; // sealing/quota failed: the legacy copy (if any) stays; the next persist retries
          })
          .finally(() => void pending.delete(p));
        pending.add(p);
      };

      return {
        load(fallback) {
          try {
            const raw = st()?.getItem(spec.key);
            return raw ? (JSON.parse(raw) as T) : fallback;
          } catch {
            return fallback;
          }
        },
        boot(value) {
          bootJson = JSON.stringify(value);
          encAtBoot = hasEnc();
        },
        markRemote() {
          remote = true;
        },
        persist,
        async hydrate(current) {
          const m = deps.vault.materialOrNull();
          if (!m) return null;
          let stored: unknown;
          try {
            const raw = st()?.getItem(encKey);
            if (raw) {
              const enc = JSON.parse(raw) as unknown;
              if (isEnvelope(enc))
                stored = (await decryptJson<{ v: number; d: unknown }>(m.key, enc as VaultEnvelope))
                  ?.d;
            }
          } catch {
            stored = undefined; // wrong key / corrupted: keep what we have, never throw
          }
          hydrated = true;
          const edited = bootJson !== null && JSON.stringify(current) !== bootJson;
          const next =
            stored === undefined ? current : spec.merge(current, stored, { remote, edited });
          const changed = JSON.stringify(next) !== JSON.stringify(current);
          wanted = null;
          persist(next); // seals whatever we hold now and removes the legacy plaintext copy
          return changed ? next : null;
        },
        clear() {
          seq++;
          wanted = null;
          hydrated = false;
          encAtBoot = false;
          remote = false;
          bootJson = null;
          try {
            st()?.removeItem(encKey);
          } catch {
            /* nothing */
          }
          removePlain();
        },
        async flush() {
          while (pending.size) await Promise.all([...pending]);
        },
      };
    },
  };
}

// --- merge helpers -------------------------------------------------------------------------------------------------

/** Lists of records with an `id`: Firestore wins; otherwise the union, an item already in memory beating the stored one. */
export function mergeById<T extends { id: string }>(
  current: T[],
  stored: unknown,
  ctx: MergeContext,
  keep: (item: T) => boolean = () => true,
): T[] {
  if (ctx.remote || !Array.isArray(stored)) return current;
  const have = new Set(current.map((x) => x.id));
  const add = (stored as T[]).filter(
    (x) => x && typeof x.id === 'string' && !have.has(x.id) && keep(x),
  );
  return add.length ? [...current, ...add] : current;
}

/** One document: Firestore wins; otherwise the newer of the two (see below). */
export function mergeSingleton<T extends { updatedAt?: number }>(
  current: T,
  stored: unknown,
  ctx: MergeContext,
  normalize: (raw: unknown) => T = (raw) => raw as T,
): T {
  if (ctx.remote || !stored || typeof stored !== 'object') return current;
  const s = normalize(stored);
  // Newer wins. Untouched since boot and no stamps on either side -> the sealed copy (the legacy plaintext is only a
  // migration source and may be older); with stamps, a legacy copy written later by an old client is not lost.
  const cs = current.updatedAt ?? 0;
  const ss = s.updatedAt ?? 0;
  if (!ctx.edited) return cs > ss ? current : s;
  return ss > cs ? s : current;
}
