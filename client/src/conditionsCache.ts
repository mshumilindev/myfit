/**
 * On-device copy of the chronic conditions (+ the general sharing default).
 *
 * The Firestore copy is sealed; this keeps the localStorage copy sealed too once the
 * auto vault has a key (in memory or from its IndexedDB cache, so offline starts work):
 *
 *  - key available  -> one sealed envelope under `spotter.conditions.enc`; the legacy
 *                      plaintext keys are removed only AFTER the sealed write succeeded.
 *  - no key yet     -> the old plaintext behaviour, so nothing the user entered is lost.
 *  - sealed copy exists but the key is not here yet -> the plaintext keys are touched only
 *                      when the user actually changed something meanwhile (merged on
 *                      hydrate); the sealed copy is never overwritten or dropped.
 */
import type { Vault } from './autoVault';
import { decryptJson, encryptJson, isEnvelope, type VaultEnvelope } from './vaultCrypto';

export const CONDITIONS_KEY = 'spotter.conditions';
export const CONDITIONS_SHARE_KEY = 'spotter.conditionsShare';
export const CONDITIONS_ENC_KEY = 'spotter.conditions.enc';

export interface ConditionsSnapshot<
  C extends { id: string; updatedAt?: number },
  S extends string,
> {
  conditions: C[];
  share: S;
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createConditionsCache<
  C extends { id: string; updatedAt?: number },
  S extends string,
>(deps: {
  vault: Pick<Vault, 'materialOrNull'>;
  storage?: () => Store;
  isShare: (v: unknown) => v is S;
}) {
  const st = (): Store | null => {
    try {
      return deps.storage ? deps.storage() : localStorage;
    } catch {
      return null;
    }
  };
  const hasEnc = () => {
    try {
      return !!st()?.getItem(CONDITIONS_ENC_KEY);
    } catch {
      return false;
    }
  };

  let bootJson: string | null = null; // state at boot, to tell "user edited meanwhile"
  let encAtBoot = hasEnc();
  let hydrated = false;
  let remoteConditions = false;
  let remoteShare = false;
  let seq = 0;
  let lastSealed: string | null = null;

  const writePlain = (s: ConditionsSnapshot<C, S>) => {
    try {
      st()?.setItem(CONDITIONS_KEY, JSON.stringify(s.conditions));
      st()?.setItem(CONDITIONS_SHARE_KEY, s.share);
    } catch {
      /* quota / private mode */
    }
  };
  const removePlain = () => {
    try {
      st()?.removeItem(CONDITIONS_KEY);
      st()?.removeItem(CONDITIONS_SHARE_KEY);
    } catch {
      /* nothing to remove */
    }
  };

  return {
    /** Call once with the state loaded synchronously at boot. */
    boot(s: ConditionsSnapshot<C, S>): void {
      bootJson = JSON.stringify(s);
      encAtBoot = hasEnc();
    },
    /** Firestore delivered the truth for conditions / the share default. */
    markRemote(what: 'conditions' | 'share'): void {
      if (what === 'conditions') remoteConditions = true;
      else remoteShare = true;
    },
    /** Persist the current state (call from the store's persist()). Never throws. */
    persist(s: ConditionsSnapshot<C, S>): void {
      const json = JSON.stringify(s);
      const m = deps.vault.materialOrNull();
      if (!m) {
        // Sealed copy present and not yet merged: don't clobber anything with stale state.
        if ((encAtBoot || hasEnc()) && (hydrated || json === bootJson)) return;
        writePlain(s);
        return;
      }
      if (json === lastSealed) return;
      const my = ++seq;
      void encryptJson(m.key, m.salt, { v: 1, ...s })
        .then((enc) => {
          if (my !== seq) return; // a newer state is being sealed
          const store = st();
          if (!store) return;
          store.setItem(CONDITIONS_ENC_KEY, JSON.stringify(enc));
          lastSealed = json;
          removePlain(); // only after the sealed copy is safely written
        })
        .catch(() => {
          writePlain(s); // sealing failed: keep the data rather than lose it
        });
    },
    /**
     * Once the key is available: decrypt the sealed copy and merge it into `current`
     * (Firestore's answer, when it already arrived, wins). Null = nothing to change.
     */
    async hydrate(current: ConditionsSnapshot<C, S>): Promise<ConditionsSnapshot<C, S> | null> {
      const m = deps.vault.materialOrNull();
      if (!m) return null;
      let stored: { conditions?: unknown; share?: unknown } | null = null;
      try {
        const raw = st()?.getItem(CONDITIONS_ENC_KEY);
        if (raw) {
          const enc = JSON.parse(raw) as unknown;
          if (isEnvelope(enc)) stored = await decryptJson(m.key, enc as VaultEnvelope);
        }
      } catch {
        stored = null; // wrong key / corrupted: keep what we have, never throw
      }
      hydrated = true;
      const edited = bootJson !== null && JSON.stringify(current) !== bootJson;
      let next = current;
      if (stored) {
        const byId = new Map<string, C>(current.conditions.map((c) => [c.id, c]));
        if (!remoteConditions && Array.isArray(stored.conditions)) {
          for (const c of stored.conditions as C[]) {
            const cur = byId.get(c.id);
            if (!cur || (c.updatedAt ?? 0) > (cur.updatedAt ?? 0)) byId.set(c.id, c);
          }
        }
        const share =
          !remoteShare && !edited && deps.isShare(stored.share) ? stored.share : current.share;
        next = { conditions: [...byId.values()], share };
      }
      const changed = JSON.stringify(next) !== JSON.stringify(current);
      // Migrate / re-seal whatever we now hold (this also removes legacy plaintext).
      lastSealed = null;
      this.persist(next);
      return changed ? next : null;
    },
    /** Reset / sign-out. */
    clear(): void {
      seq++;
      lastSealed = null;
      hydrated = false;
      encAtBoot = false;
      remoteConditions = false;
      remoteShare = false;
      bootJson = null;
      const store = st();
      try {
        store?.removeItem(CONDITIONS_ENC_KEY);
      } catch {
        /* nothing */
      }
      removePlain();
    },
  };
}
