import { useSyncExternalStore } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
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

function startStreams(u: string) {
  stopStreams();
  set({ loading: true, failed: false });
  unsubs.push(
    onSnapshot(
      metaRef(u, 'nutritionLog'),
      (d) => {
        const data = d.exists() ? (d.data() as { entries?: Entry[] }) : {};
        set({ entries: sortByTime(data.entries ?? []), loading: false, failed: false });
      },
      () => set({ loading: false, failed: true }),
    ),
    onSnapshot(
      metaRef(u, 'nutritionFoods'),
      (d) => set({ customFoods: d.exists() ? ((d.data() as { foods?: Food[] }).foods ?? []) : [] }),
      () => undefined,
    ),
    onSnapshot(
      metaRef(u, 'nutritionGoal'),
      (d) => set({ goal: d.exists() ? (d.data() as Goal) : null }),
      () => undefined,
    ),
    onSnapshot(
      metaRef(u, 'nutritionProfile'),
      (d) => set({ profile: d.exists() ? (d.data() as NutritionProfile) : null }),
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
onAuthChange((user) => {
  if (user) {
    set({ authReady: true, uid: user.uid, username: user.displayName ?? null });
    startStreams(user.uid);
  } else {
    stopStreams();
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

function writeLog(entries: Entry[]) {
  set({ entries: sortByTime(entries) }); // optimistic; snapshot confirms
  if (state.uid) setDoc(metaRef(state.uid, 'nutritionLog'), { entries }).catch(onWriteError);
}
function writeFoods(foods: Food[]) {
  set({ customFoods: foods });
  if (state.uid) setDoc(metaRef(state.uid, 'nutritionFoods'), { foods }).catch(onWriteError);
}

export const store = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get: () => state,

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
    set({ goal });
    if (state.uid) setDoc(metaRef(state.uid, 'nutritionGoal'), goal).catch(onWriteError);
  },

  setProfile(patch: Partial<NutritionProfile>) {
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
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function entriesForDay(s: AppState, day: string): Entry[] {
  return s.entries.filter((e) => e.day === day);
}
