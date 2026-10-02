/**
 * On-device copy of the alcohol document (entries + settings).
 *
 * Same discipline as `conditionsCache.ts`: the Firestore copy is sealed, so the localStorage
 * copy is sealed too once the vault has a key.
 *
 *  - key available  -> one sealed envelope under `spotter.alcohol.enc`; the plaintext key
 *                      is removed only AFTER the sealed write succeeded.
 *  - no key yet     -> plaintext under `spotter.alcohol` as a fallback, so nothing the
 *                      user entered is lost. It is migrated into the envelope as soon as a
 *                      key exists.
 *  - sealed copy exists but the key is not here yet -> plaintext is touched only when the
 *                      user changed something meanwhile; the sealed copy is never dropped.
 */
import type { Vault } from './autoVault';
import { emptyAlcoholState, normalizeAlcohol } from './alcohol';
import type { AlcoholState } from './types';
import { decryptJson, encryptJson, isEnvelope, type VaultEnvelope } from './vaultCrypto';

export const ALCOHOL_KEY = 'spotter.alcohol';
export const ALCOHOL_ENC_KEY = 'spotter.alcohol.enc';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createAlcoholCache(deps: {
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
  const hasEnc = (): boolean => {
    try {
      return !!st()?.getItem(ALCOHOL_ENC_KEY);
    } catch {
      return false;
    }
  };

  let bootJson: string | null = null;
  let encAtBoot = hasEnc();
  let hydrated = false;
  let remote = false;
  let seq = 0;
  let lastSealed: string | null = null;

  const writePlain = (s: AlcoholState) => {
    try {
      st()?.setItem(ALCOHOL_KEY, JSON.stringify(s));
    } catch {
      /* quota / private mode */
    }
  };
  const removePlain = () => {
    try {
      st()?.removeItem(ALCOHOL_KEY);
    } catch {
      /* nothing to remove */
    }
  };

  return {
    /** The synchronous boot value: the plaintext fallback copy, or an empty document. */
    load(): AlcoholState {
      try {
        const raw = st()?.getItem(ALCOHOL_KEY);
        return raw ? normalizeAlcohol(JSON.parse(raw)) : emptyAlcoholState();
      } catch {
        return emptyAlcoholState();
      }
    },
    /** Call once with the state loaded at boot. */
    boot(s: AlcoholState): void {
      bootJson = JSON.stringify(s);
      encAtBoot = hasEnc();
    },
    /** Firestore delivered the truth: it wins over an older on-device copy. */
    markRemote(): void {
      remote = true;
    },
    /** Persist the current state (call from the store's persist()). Never throws. */
    persist(s: AlcoholState): void {
      if (s.updatedAt === 0) return; // never saved (or wiped): nothing to keep on the device
      const json = JSON.stringify(s);
      const m = deps.vault.materialOrNull();
      if (!m) {
        if ((encAtBoot || hasEnc()) && (hydrated || json === bootJson)) return;
        writePlain(s);
        return;
      }
      if (json === lastSealed) return;
      const my = ++seq;
      void encryptJson(m.key, m.salt, { v: 1, ...s })
        .then((enc) => {
          if (my !== seq) return;
          const store = st();
          if (!store) return;
          store.setItem(ALCOHOL_ENC_KEY, JSON.stringify(enc));
          lastSealed = json;
          removePlain();
        })
        .catch(() => {
          writePlain(s); // sealing failed: keep the data rather than lose it
        });
    },
    /**
     * Once the key is available: open the sealed copy and take it when it is newer than
     * `current` (a Firestore answer that already arrived wins). Null = nothing to change.
     */
    async hydrate(current: AlcoholState): Promise<AlcoholState | null> {
      const m = deps.vault.materialOrNull();
      if (!m) return null;
      let stored: AlcoholState | null = null;
      try {
        const raw = st()?.getItem(ALCOHOL_ENC_KEY);
        if (raw) {
          const enc = JSON.parse(raw) as unknown;
          if (isEnvelope(enc))
            stored = normalizeAlcohol(await decryptJson(m.key, enc as VaultEnvelope));
        }
      } catch {
        stored = null; // wrong key / corrupted: keep what we have, never throw
      }
      hydrated = true;
      const next = stored && !remote && stored.updatedAt > current.updatedAt ? stored : current;
      const changed = JSON.stringify(next) !== JSON.stringify(current);
      lastSealed = null;
      this.persist(next); // seals whatever we hold now and removes the plaintext copy
      return changed ? next : null;
    },
    /** Reset / sign-out / "Delete alcohol data". */
    clear(): void {
      seq++;
      lastSealed = null;
      hydrated = false;
      encAtBoot = false;
      remote = false;
      bootJson = null;
      try {
        st()?.removeItem(ALCOHOL_ENC_KEY);
      } catch {
        /* nothing */
      }
      removePlain();
    },
  };
}
