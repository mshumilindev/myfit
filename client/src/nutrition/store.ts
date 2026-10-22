import { useSyncExternalStore } from 'react';
import { deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { currentUid, getUsername } from '../api';
import {
  healthSnapshot,
  healthVersion,
  isHealthOn,
  subscribeHealth,
} from '../data/healthConsentGate';
import { onAuthChange, watchRole } from './auth';
import { sumMacros } from './calc';
import { db } from './firebase';
import type {
  AppState,
  Entry,
  Food,
  Goal,
  Lang,
  LoggedItem,
  NutritionProfile,
  SpotterBody,
} from './types';

const LANG_KEY = 'spotter-nutrition/lang';

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null;
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  const l = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2);
  return (['en', 'uk', 'pl', 'lt', 'et'] as const).includes(l as Lang) ? (l as Lang) : 'en';
}

const SIGNED_OUT: AppState = {
  authReady: false,
  uid: null,
  username: null,
  role: 'member',
  loading: false,
  failed: false,
  entries: [],
  customFoods: [],
  goal: null,
  profile: null,
  spotterBody: null,
  lang: detectLang(),
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
};

let state: AppState = { ...SIGNED_OUT };
const listeners = new Set<() => void>();
let unsubs: (() => void)[] = [];

function emit() {
  listeners.forEach((l) => l());
}
function set(next: Partial<AppState>) {
  state = { ...state, ...next };
  emit();
}

function stopStreams() {
  unsubs.forEach((u) => u());
  unsubs = [];
}

/**
 * Nutrition data lives in singleton `meta/*` documents (arrays), exactly like
 * My Fit stores body metrics at meta/body. This keeps it under the users/{uid}
 * rules My Fit already ships (no separate rules deploy) and gets the same
 * offline caching via Firestore persistentLocalCache.
 */
function metaRef(u: string, name: string) {
  return doc(db, 'users', u, 'meta', name);
}

function sortByTime(entries: Entry[]): Entry[] {
  return entries.slice().sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1));
}

/** The four singleton documents of the food feature. */
const FOOD_DOCS = ['nutritionLog', 'nutritionFoods', 'nutritionGoal', 'nutritionProfile'] as const;
type FoodDoc = (typeof FOOD_DOCS)[number];
/** Documents that have delivered their first snapshot on this stream (until then "nothing stored" is not an answer). */
const seenDocs = new Set<FoodDoc>();
let loadWaiters: (() => void)[] = [];
/** Documents the person deleted: a snapshot that still carries data for one is the old data, so it is deleted again. */
const wipedDocs = new Set<FoodDoc>();

function markSeen(name: FoodDoc) {
  seenDocs.add(name);
  if (seenDocs.size >= FOOD_DOCS.length) loadWaiters.splice(0).forEach((w) => w());
}

/**
 * A snapshot of `name` arrived. True when it must be ignored: the document was deleted by the person and this snapshot
 * (read before the delete reached the server) still has data, so it is removed again instead of refilling the screen.
 * The first empty snapshot after a delete (or a write of the person's own) ends the guard.
 */
function ignoreAfterWipe(u: string, name: FoodDoc, exists: boolean): boolean {
  if (!wipedDocs.has(name)) return false;
  if (!exists) {
    wipedDocs.delete(name);
    return false;
  }
  deleteDoc(metaRef(u, name)).catch(onWriteError);
  return true;
}

function startStreams(u: string) {
  stopStreams();
  seenDocs.clear();
  set({ loading: true, failed: false });
  unsubs.push(
    onSnapshot(
      metaRef(u, 'nutritionLog'),
      (d) => {
        markSeen('nutritionLog');
        if (ignoreAfterWipe(u, 'nutritionLog', d.exists())) return;
        const data = d.exists() ? (d.data() as { entries?: Entry[] }) : {};
        set({ entries: sortByTime(data.entries ?? []), loading: false, failed: false });
      },
      () => set({ loading: false, failed: true }),
    ),
    onSnapshot(
      metaRef(u, 'nutritionFoods'),
      (d) => {
        markSeen('nutritionFoods');
        if (ignoreAfterWipe(u, 'nutritionFoods', d.exists())) return;
        set({ customFoods: d.exists() ? ((d.data() as { foods?: Food[] }).foods ?? []) : [] });
      },
      () => undefined,
    ),
    onSnapshot(
      metaRef(u, 'nutritionGoal'),
      (d) => {
        markSeen('nutritionGoal');
        if (ignoreAfterWipe(u, 'nutritionGoal', d.exists())) return;
        set({ goal: d.exists() ? (d.data() as Goal) : null });
      },
      () => undefined,
    ),
    onSnapshot(
      metaRef(u, 'nutritionProfile'),
      (d) => {
        markSeen('nutritionProfile');
        if (ignoreAfterWipe(u, 'nutritionProfile', d.exists())) return;
        set({ profile: d.exists() ? (d.data() as NutritionProfile) : null });
      },
      () => undefined,
    ),
    onSnapshot(
      metaRef(u, 'body'),
      (d) => set({ spotterBody: d.exists() ? (d.data() as SpotterBody) : null }),
      () => undefined,
    ),
  );
}

// --- auth wiring (module singleton) ---------------------------------------
/**
 * Non-blocking start: the suite already has a signed-in session cached on this device (`spotter.uid`), so the app
 * adopts it at once and the shell renders from the Firestore local cache. Firebase Auth's restore (which can hang
 * on a dead network) only CONFIRMS it later: same uid keeps the running streams, no uid signs out.
 */
const cachedUid = currentUid();
if (cachedUid) {
  state = { ...state, uid: cachedUid, username: getUsername() };
  startStreams(cachedUid);
}

onAuthChange((user) => {
  if (user) {
    const same = state.uid === user.uid && unsubs.length > 0;
    set({ authReady: true, uid: user.uid, username: user.displayName ?? state.username ?? null });
    if (!same) startStreams(user.uid);
  } else {
    stopStreams();
    seenDocs.clear();
    wipedDocs.clear();
    state = { ...SIGNED_OUT, authReady: true, lang: state.lang };
    emit();
  }
});
watchRole((role) => set({ role }));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => set({ online: true }));
  window.addEventListener('offline', () => set({ online: false }));
}

function onWriteError(err: unknown) {
  console.error('[nutrition] write failed', err);
}

/**
 * The food log is a health feature (SPO-290): without consent nothing is written. That includes removing a single entry
 * or food (they are writes of the whole document); what works while the feature is off is the bulk delete,
 * `deleteNutritionData`, which is the delete offered when consent is withdrawn.
 */
const canWrite = (): boolean => isHealthOn('nutrition');

function writeLog(entries: Entry[]) {
  if (!canWrite()) return;
  wipedDocs.delete('nutritionLog');
  set({ entries: sortByTime(entries) }); // optimistic; snapshot confirms
  if (state.uid) setDoc(metaRef(state.uid, 'nutritionLog'), { entries }).catch(onWriteError);
}
function writeFoods(foods: Food[]) {
  if (!canWrite()) return;
  wipedDocs.delete('nutritionFoods');
  set({ customFoods: foods });
  if (state.uid) setDoc(metaRef(state.uid, 'nutritionFoods'), { foods }).catch(onWriteError);
}

let exposedMemo: { raw: AppState; v: number; out: AppState } | null = null;
/** What the screens see: without the `nutrition` consent the food log, goal and profile are not shown or used. */
function exposed(): AppState {
  const v = healthVersion();
  if (exposedMemo === null || exposedMemo.raw !== state || exposedMemo.v !== v) {
    const on = healthSnapshot().on.nutrition;
    exposedMemo = {
      raw: state,
      v,
      out: on ? state : { ...state, entries: [], customFoods: [], goal: null, profile: null },
    };
  }
  return exposedMemo.out;
}
subscribeHealth(emit);

/**
 * Deletes everything stored for the food log, goal and profile (the four `meta/nutrition*` documents) and empties the
 * in-memory copy. Works while the feature is off: it is the delete offered when consent is withdrawn (SPO-290).
 */
export function deleteNutritionData(): void {
  const u = state.uid;
  // Marked before anything else: even a snapshot that is still on its way (or the first one, when the person deletes
  // before the streams have answered) must not put the data back; it is deleted again when it arrives.
  for (const name of FOOD_DOCS) wipedDocs.add(name);
  set({ entries: [], customFoods: [], goal: null, profile: null });
  if (!u) return;
  // Queued by Firestore's offline persistence like every other write; never awaited (offline it resolves only later).
  for (const name of FOOD_DOCS) deleteDoc(metaRef(u, name)).catch(onWriteError);
}

/** Anything of the food feature is stored (raw), whatever the consent says. Only meaningful once `nutritionLoaded()`. */
export const hasNutritionData = (): boolean =>
  state.entries.length > 0 || state.customFoods.length > 0 || !!state.goal || !!state.profile;

/** RAW food log, foods, goal and profile, for the data copy only (Art. 15 / 20, no consent needed to give a person their own data back). Never shown. */
export const storedNutrition = (): Pick<
  AppState,
  'entries' | 'customFoods' | 'goal' | 'profile'
> => ({
  entries: state.entries,
  customFoods: state.customFoods,
  goal: state.goal,
  profile: state.profile,
});

/** How long to wait for the first snapshots before answering without them (offline with nothing cached). */
const NUTRITION_LOAD_WAIT_MS = 4000;

/**
 * Resolves true once all four documents have delivered their first snapshot (or at once when there is no account to
 * read); false when they have not within `waitMs`. Whether anything is stored is not known before that: an empty
 * state at start is "not loaded yet", not "nothing there".
 */
export function nutritionLoaded(waitMs: number = NUTRITION_LOAD_WAIT_MS): Promise<boolean> {
  if (!state.uid || seenDocs.size >= FOOD_DOCS.length) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      loadWaiters = loadWaiters.filter((w) => w !== done);
      resolve(false);
    }, waitMs);
    loadWaiters.push(done);
  });
}

export const store = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get: exposed,

  retry() {
    if (state.uid) startStreams(state.uid);
  },

  addEntry(input: {
    type: Entry['type'];
    name: string;
    emoji?: string;
    items: LoggedItem[];
    alcoholG?: number;
    approx?: boolean;
    day: string;
    at?: string;
  }): Entry {
    const entry: Entry = {
      id: uid(),
      type: input.type,
      name: input.name,
      emoji: input.emoji,
      items: input.items,
      macros: sumMacros(input.items),
      alcoholG: input.alcoholG,
      approx: input.approx,
      loggedAt: input.at ?? new Date().toISOString(),
      day: input.day,
    };
    writeLog([entry, ...state.entries]);
    return entry;
  },

  deleteEntry(id: string) {
    writeLog(state.entries.filter((e) => e.id !== id));
  },

  restoreEntry(entry: Entry) {
    writeLog([entry, ...state.entries.filter((e) => e.id !== entry.id)]);
  },

  updateEntry(entry: Entry) {
    const next = { ...entry, macros: sumMacros(entry.items) };
    writeLog(state.entries.map((e) => (e.id === entry.id ? next : e)));
  },

  addCustomFood(food: Omit<Food, 'id' | 'custom'>): Food {
    const f: Food = { ...food, id: uid(), custom: true };
    writeFoods([f, ...state.customFoods]);
    return f;
  },

  deleteCustomFood(id: string) {
    writeFoods(state.customFoods.filter((f) => f.id !== id));
  },

  setGoal(goal: Goal) {
    if (!canWrite()) return;
    wipedDocs.delete('nutritionGoal');
    set({ goal });
    if (state.uid) setDoc(metaRef(state.uid, 'nutritionGoal'), goal).catch(onWriteError);
  },

  setProfile(patch: Partial<NutritionProfile>) {
    if (!canWrite()) return;
    wipedDocs.delete('nutritionProfile');
    const next = { ...(state.profile ?? {}), ...patch };
    set({ profile: next });
    if (state.uid)
      setDoc(metaRef(state.uid, 'nutritionProfile'), next, { merge: true }).catch(onWriteError);
  },

  setLang(lang: Lang) {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* ignore */
    }
    set({ lang });
  },
};

export function useStore(): AppState {
  return useSyncExternalStore(store.subscribe, exposed, exposed);
}

export function entriesForDay(s: AppState, day: string): Entry[] {
  return s.entries.filter((e) => e.day === day);
}
