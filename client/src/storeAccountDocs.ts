/**
 * The account-side wiring of the settings and small values that used to live only on the device (SPO-385, 388, 391):
 * exercise settings (`meta/exercisePrefs`), Today-widget values (`meta/widgetData` + `meta/prefs.weeklyGoal`) and the
 * started challenges (`meta/challenges`). The decisions (what wins, what is added) are in the pure modules
 * `exercisePrefsSync`, `today/widgetSync`, `challengesState`; this file only connects them to the store, which hands in
 * what it owns (`writeMetaDoc`, `writePrefsFields`, applying a value to its state). Split out of store.ts to keep it small.
 */
import {
  applyRemoteChallenges,
  getChallenges,
  getChallengesAt,
  onChallengesEdit,
  reconcileChallenges,
  resetChallenges,
} from './challengesState';
import {
  TW_AT_KEY,
  TW_PREFS_FIELD,
  TW_SEALED_IDS,
  applyTwRemote,
  normalizeTw,
  onTwEdit,
  readTwAt,
  reconcileTwBundle,
  reconcileTwPref,
} from './today/widgetSync';
import {
  normalizeExercisePrefs,
  reconcileExercisePrefs,
  type ExercisePrefs,
} from './exercisePrefsSync';
import { normalizeSleepPrefs, reconcileSleepPrefs, type SleepPrefs } from './sleepPrefsSync';
import { watchSealedMeta, type SealedMetaName } from './storeMeta';

// When the exercise settings were last changed on this device: the stamp for last-write-wins with the account.
const EX_PREFS_AT_KEY = 'spotter.exercisePrefsAt';
// Same for the sleep schedule and switches (SPO-397).
const SLEEP_PREFS_AT_KEY = 'spotter.sleepPrefsAt';

export interface AccountDocDeps {
  writeMetaDoc(name: SealedMetaName, value: object, stamp?: number): void;
  writePrefsFields(fields: Record<string, unknown>): void;
  onWriteError(e: unknown): void;
  /** The exercise settings as the store holds them now. */
  readExercisePrefs(): unknown;
  /** Change them on the device (state + cache + re-render); not a user edit, nothing is written. */
  patchExercisePrefs(patch: Partial<ExercisePrefs>): void;
  /** The sleep schedule and switches as the store holds them now. */
  readSleepPrefs(): unknown;
  /** Change them on the device (state + cache + auto-start queue); not a user edit, nothing is written. */
  patchSleepPrefs(prefs: SleepPrefs): void;
}

function readStamp(key: string = EX_PREFS_AT_KEY): number {
  try {
    const n = Number(JSON.parse(localStorage.getItem(key) ?? '0'));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}
function saveStamp(n: number, key: string = EX_PREFS_AT_KEY): void {
  try {
    localStorage.setItem(key, JSON.stringify(n));
  } catch {
    /* private mode: kept for this session */
  }
}

export function createAccountDocs(d: AccountDocDeps) {
  let exAt = readStamp();
  let sleepAt = readStamp(SLEEP_PREFS_AT_KEY);
  const currentSleep = (): SleepPrefs => normalizeSleepPrefs(d.readSleepPrefs());
  const current = (): ExercisePrefs => normalizeExercisePrefs(d.readExercisePrefs());

  function writeExercisePrefsDoc(): void {
    if (!exAt) {
      exAt = Date.now();
      saveStamp(exAt);
    }
    d.writeMetaDoc('exercisePrefs', current(), exAt);
  }
  /** A change the person made to one of these settings: stamp it, keep it on the device, send it to the account. */
  function setExercisePrefs(patch: Partial<ExercisePrefs>): void {
    exAt = Date.now();
    saveStamp(exAt);
    d.patchExercisePrefs(patch);
    writeExercisePrefsDoc();
  }

  function writeSleepPrefsDoc(): void {
    if (!sleepAt) {
      sleepAt = Date.now();
      saveStamp(sleepAt, SLEEP_PREFS_AT_KEY);
    }
    d.writeMetaDoc('sleepPrefs', currentSleep(), sleepAt);
  }
  /** A change the person made to the sleep schedule or switches: stamp it and send it to the account (state is already set). */
  function onSleepPrefsEdit(): void {
    sleepAt = Date.now();
    saveStamp(sleepAt, SLEEP_PREFS_AT_KEY);
    writeSleepPrefsDoc();
  }

  function twValue(id: string): unknown {
    try {
      const raw = localStorage.getItem(`spotter.tw.${id}`);
      return raw ? normalizeTw(id, JSON.parse(raw)) : undefined;
    } catch {
      return undefined;
    }
  }
  function writeWidgetData(): void {
    const at = readTwAt();
    const values: Record<string, unknown> = {};
    const stamps: Record<string, number> = {};
    for (const id of TW_SEALED_IDS) {
      const v = twValue(id);
      if (v !== undefined && at[id]) {
        values[id] = v;
        stamps[id] = at[id];
      }
    }
    d.writeMetaDoc('widgetData', { values, at: stamps });
  }
  function writeChallengesDoc(): void {
    d.writeMetaDoc('challenges', { list: getChallenges() }, getChallengesAt() || Date.now());
  }

  onChallengesEdit(() => writeChallengesDoc());
  onTwEdit((id, value, at) => {
    const field = TW_PREFS_FIELD[id];
    if (field) d.writePrefsFields({ [field]: value ?? null, [`${field}UpdatedAt`]: at });
    else writeWidgetData();
  });

  /** The weekly goal rides in `meta/prefs`: handle a snapshot of that document. */
  function syncTwPrefsFromDoc(data: Record<string, unknown>): void {
    for (const [id, field] of Object.entries(TW_PREFS_FIELD)) {
      const remoteAt = field + 'UpdatedAt' in data ? Number(data[field + 'UpdatedAt']) || 0 : null;
      const hasField = field in data && remoteAt !== null;
      const r = reconcileTwPref(readTwAt()[id] ?? 0, hasField ? remoteAt : null);
      if (r.apply) {
        const v = normalizeTw(id, data[field]);
        if (v !== undefined) applyTwRemote(id, v, remoteAt ?? 0);
      }
      if (r.push) {
        d.writePrefsFields({
          [field]: twValue(id) ?? null,
          [`${field}UpdatedAt`]: readTwAt()[id] ?? Date.now(),
        });
      }
    }
  }

  /** Listeners on the three sealed documents; returns the unsubscribe. */
  function watch(uid: string): () => void {
    const offs = [
      watchSealedMeta<Record<string, unknown>>(
        uid,
        'exercisePrefs',
        (items, info) => {
          if (!items.length && info.locked) return;
          const data = items[0];
          const r = reconcileExercisePrefs(
            { at: exAt, prefs: current() },
            data
              ? { at: typeof data.updatedAt === 'number' ? data.updatedAt : 0, raw: data }
              : null,
          );
          if (r.apply) {
            exAt = r.apply.at;
            saveStamp(exAt);
            d.patchExercisePrefs(r.apply.prefs);
          }
          if (r.push) writeExercisePrefsDoc();
        },
        d.onWriteError,
      ),
      watchSealedMeta<Record<string, unknown>>(
        uid,
        'sleepPrefs',
        (items, info) => {
          if (!items.length && info.locked) return;
          const data = items[0];
          const r = reconcileSleepPrefs(
            { at: sleepAt, prefs: currentSleep() },
            data
              ? { at: typeof data.updatedAt === 'number' ? data.updatedAt : 0, raw: data }
              : null,
          );
          if (r.apply) {
            sleepAt = r.apply.at;
            saveStamp(sleepAt, SLEEP_PREFS_AT_KEY);
            d.patchSleepPrefs(r.apply.prefs);
          }
          if (r.push) writeSleepPrefsDoc();
        },
        d.onWriteError,
      ),
      watchSealedMeta<Record<string, unknown>>(
        uid,
        'widgetData',
        (items, info) => {
          if (!items.length && info.locked) return;
          const data = items[0];
          const remote =
            data &&
            data.values &&
            typeof data.values === 'object' &&
            data.at &&
            typeof data.at === 'object'
              ? {
                  values: data.values as Record<string, unknown>,
                  at: data.at as Record<string, number>,
                }
              : null;
          const r = reconcileTwBundle(readTwAt(), remote);
          for (const [id, a] of Object.entries(r.apply)) applyTwRemote(id, a.value, a.at);
          if (r.push) writeWidgetData();
        },
        d.onWriteError,
      ),
      watchSealedMeta<Record<string, unknown>>(
        uid,
        'challenges',
        (items, info) => {
          if (!items.length && info.locked) return;
          const data = items[0];
          const r = reconcileChallenges(
            { at: getChallengesAt(), list: getChallenges() },
            data
              ? { at: typeof data.updatedAt === 'number' ? data.updatedAt : 0, raw: data.list }
              : null,
          );
          if (r.apply) applyRemoteChallenges(r.apply.list, r.apply.at);
          if (r.push) writeChallengesDoc();
        },
        d.onWriteError,
      ),
    ];
    return () => offs.forEach((off) => off());
  }

  /** Sign-out / device wipe: forget these values and their stamps. */
  function reset(): void {
    exAt = 0;
    sleepAt = 0;
    try {
      localStorage.removeItem(EX_PREFS_AT_KEY);
      localStorage.removeItem(SLEEP_PREFS_AT_KEY);
      localStorage.removeItem(TW_AT_KEY);
      for (const id of [...TW_SEALED_IDS, ...Object.keys(TW_PREFS_FIELD)])
        localStorage.removeItem(`spotter.tw.${id}`);
    } catch {
      /* private mode */
    }
    resetChallenges();
  }

  return { setExercisePrefs, onSleepPrefsEdit, syncTwPrefsFromDoc, watch, reset };
}
