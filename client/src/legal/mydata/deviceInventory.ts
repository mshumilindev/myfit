/**
 * What Spotter keeps in THIS browser (SPO-295 N7), computed from what is really there: `localStorage` keys grouped by
 * name, the IndexedDB databases the browser lists, Cache Storage and the browser's own usage estimate. Nothing here is a
 * fixed list of "what we would keep": a group with no key found is absent. Sizes: `localStorage` = 2 bytes per UTF-16 unit
 * of key + value (what browsers count); IndexedDB has no per-database size, so only the browser's total is shown, and only
 * when the browser reports it. Cookies are not read: Spotter's own storage is not cookies.
 */
import { SCOPE_PREFIX, isValidUid, type StorageBackend } from '../../accounts/scopedStorage';
import type { DeviceId } from '../../i18n/myData';

export type KeyGroup =
  | 'signin'
  | 'offline'
  | 'cache'
  | 'settings'
  | 'atlas'
  | 'consent'
  | 'reminders'
  | 'gymsearch'
  | 'other';

const SIGNIN = new Set([
  'spotter.activeAccount',
  'spotter.accounts',
  'spotter.uid',
  'spotter.username',
  'spotter.role',
  'spotter.loginId',
  'spotter.scopedAdopted',
]);
/** The local copy of the person's own entries (what `store.persist()` and the sleep sync keep for offline use). */
const OFFLINE = new Set([
  'spotter.state',
  'spotter.gyms',
  'spotter.sharedGyms',
  'spotter.restPeriods',
  'spotter.injuries',
  'spotter.conditions',
  'spotter.conditions.enc',
  'spotter.cycle',
  'spotter.cycle.enc',
  'spotter.nicotine',
  'spotter.nicotine.enc',
  'spotter.alcohol',
  'spotter.alcohol.enc',
  'spotter.supplements',
  'spotter.supplements.enc',
  'spotter.activities',
  'spotter.body',
  'spotter.sleeps',
  'spotter.sleep',
  'spotter.sleep.schedule',
  'spotter.sleep.settings',
  'spotter.sleepKind.v1',
  'spotter.sleepSynced.v1',
  'spotter.sleepTombstones.v1',
  'spotter.goals',
  'spotter.home',
  'spotter.mastery',
  'spotter.coach',
  'spotter.challenges',
  'spotter.fs.delete',
]);
const GYM_SEARCH = [
  'gym.addr.',
  'gym.catalog',
  'gym.google.',
  'gym.logo.',
  'gym.meta.',
  'gym.search.',
];

/** `u:<uid>:<key>` (an account's own scope) -> `<key>`; anything else as is. */
export function unscoped(key: string): string {
  if (!key.startsWith(SCOPE_PREFIX)) return key;
  const rest = key.slice(SCOPE_PREFIX.length);
  const at = rest.indexOf(':');
  return at > 0 && isValidUid(rest.slice(0, at)) ? rest.slice(at + 1) : key;
}

export function classifyKey(key: string): KeyGroup {
  const k = unscoped(key);
  if (k.startsWith('firebase:') || k.startsWith('firebase-') || k.startsWith('FCM_'))
    return 'signin';
  if (SIGNIN.has(k)) return 'signin';
  if (k.startsWith('spotter.cache.') || k === 'spotter.programMine') return 'cache';
  if (k.startsWith('spotter.atlas')) return 'atlas';
  // `consentQueue` / `consentRevokeQueue` / `consentLocalOff` are device-level keys: they stay after sign-out (kinds and versions only, bound to a uid)
  // so an unsent withdrawal is not lost; they leave with the account's deletion.
  if (k.startsWith('spotter.consent')) return 'consent';
  if (k.startsWith('spotter.push') || k === 'spotter.quietHours' || k.startsWith('spotter.notif.'))
    return 'reminders';
  if (GYM_SEARCH.some((p) => k.startsWith(p)) || k === 'spotter.lastPos') return 'gymsearch';
  if (OFFLINE.has(k)) return 'offline';
  if (
    k.startsWith('spotter.') ||
    k.startsWith('gym.') ||
    k.startsWith('sc.') ||
    k.startsWith('coach:')
  )
    return 'settings';
  return 'other';
}

export interface GroupStat {
  keys: number;
  bytes: number;
}

export function scanStorage(storage: StorageBackend | null): Partial<Record<KeyGroup, GroupStat>> {
  const out: Partial<Record<KeyGroup, GroupStat>> = {};
  if (!storage) return out;
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k === null) continue;
      const g = classifyKey(k);
      const v = storage.getItem(k) ?? '';
      const cur = out[g] ?? { keys: 0, bytes: 0 };
      cur.keys += 1;
      cur.bytes += (k.length + v.length) * 2;
      out[g] = cur;
    }
  } catch {
    /* storage went away while reading: what was counted so far is what is shown */
  }
  return out;
}

const IDB_KIND: Record<string, DeviceId> = {
  'spotter.coach.chat': 'idbCoachChat',
  'spotter.coach.sign': 'idbSigner',
  'spotter-avatars': 'idbAvatars',
  'spotter.vault': 'idbVault',
  'spotter.prefs': 'idbPrefs',
};

export function idbKind(name: string): DeviceId {
  if (name.startsWith('firestore/')) return 'idbFirestore';
  return IDB_KIND[name] ?? 'idbOther';
}

export interface InventoryEnv {
  storage: StorageBackend | null;
  idb: { databases?: () => Promise<{ name?: string }[]> } | null;
  estimate?: () => Promise<{ usage?: number }>;
  cacheKeys?: () => Promise<string[]>;
}

export interface Inventory {
  storage: Partial<Record<KeyGroup, GroupStat>>;
  /** IndexedDB databases found, by kind (count of databases). `null` = the browser does not list them. */
  idb: Partial<Record<DeviceId, number>> | null;
  /** Cache Storage caches found; null = not available here. */
  caches: number | null;
  /** The browser's own estimate of what this site uses in total, bytes; null = not reported. */
  usage: number | null;
}

function browserInventoryEnv(): InventoryEnv {
  let storage: StorageBackend | null;
  try {
    storage = typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    storage = null;
  }
  const nav = typeof navigator === 'undefined' ? null : navigator;
  return {
    storage,
    idb: typeof indexedDB === 'undefined' ? null : (indexedDB as unknown as InventoryEnv['idb']),
    estimate: nav?.storage?.estimate ? () => nav.storage.estimate() : undefined,
    cacheKeys: typeof caches === 'undefined' ? undefined : () => caches.keys(),
  };
}

async function safe<T>(f: (() => Promise<T>) | undefined): Promise<T | null> {
  if (!f) return null;
  try {
    return await f();
  } catch {
    return null;
  }
}

export async function readInventory(env: InventoryEnv = browserInventoryEnv()): Promise<Inventory> {
  const dbs = env.idb?.databases ? await safe(() => env.idb!.databases!()) : null;
  const idb: Inventory['idb'] = dbs
    ? dbs.reduce<Partial<Record<DeviceId, number>>>((acc, d) => {
        if (!d.name) return acc;
        const k = idbKind(d.name);
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {})
    : null;
  const names = await safe(env.cacheKeys);
  const est = await safe(env.estimate);
  return {
    storage: scanStorage(env.storage),
    idb,
    caches: names ? names.length : null,
    usage: typeof est?.usage === 'number' ? est.usage : null,
  };
}

/** "1.5 KB", "3 MB" with the locale's decimal mark. */
export function formatBytes(bytes: number, locale: string): string {
  const f = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(v);
  if (bytes < 1024) return `${f(bytes)} B`;
  if (bytes < 1024 * 1024) return `${f(bytes / 1024)} KB`;
  return `${f(bytes / (1024 * 1024))} MB`;
}
