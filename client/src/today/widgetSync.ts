/**
 * Widget values that follow the person to another device (SPO-388). They are the `useLocal` values of a few Today
 * widgets, kept in `spotter.tw.<id>`:
 *   • `weekly-goal` is a setting — the field `weeklyGoal` (+ `weeklyGoalUpdatedAt`) in `users/{uid}/meta/prefs`;
 *   • `lr-balance` (left/right test results), `one-rm-calc` (the last calculator input), `pr-forecast` (targets) and
 *     `rep-prs` (the lift last picked) are the person's own numbers — one sealed document `users/{uid}/meta/widgetData`.
 * Each id has its own last-write-wins stamp in `spotter.twAt`. Pure helpers plus a tiny in-page event hub; store.ts
 * owns the Firestore side.
 */

export const TW_PREFS_FIELD: Record<string, string> = { 'weekly-goal': 'weeklyGoal' };
export const TW_SEALED_IDS = ['lr-balance', 'one-rm-calc', 'pr-forecast', 'rep-prs'] as const;
const SEALED = new Set<string>(TW_SEALED_IDS);
export const TW_AT_KEY = 'spotter.twAt';
const key = (id: string) => `spotter.tw.${id}`;

export const isSyncedTw = (id: string): boolean => id in TW_PREFS_FIELD || SEALED.has(id);

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** A received or stored value to a safe shape; `undefined` when it is not usable (never guessed). */
export function normalizeTw(id: string, v: unknown): unknown {
  switch (id) {
    case 'weekly-goal':
      return v === null ? null : num(v) && Number.isInteger(v) && v >= 1 && v <= 14 ? v : undefined;
    case 'rep-prs':
      return typeof v === 'string' && v.length <= 120 ? v : undefined;
    case 'one-rm-calc':
      if (!isObj(v) || !num(v.weight) || !num(v.reps)) return undefined;
      return {
        weight: v.weight,
        reps: v.reps,
        lift: typeof v.lift === 'string' ? v.lift : null,
        label: typeof v.label === 'string' ? v.label : null,
      };
    case 'pr-forecast': {
      if (!isObj(v)) return undefined;
      const out: Record<string, number> = {};
      for (const [k, x] of Object.entries(v)) if (num(x)) out[k] = x;
      return out;
    }
    case 'lr-balance': {
      if (!Array.isArray(v)) return undefined;
      return v
        .filter(
          (x): x is { name: string; l: number; r: number; at: number } =>
            isObj(x) && typeof x.name === 'string' && num(x.l) && num(x.r) && num(x.at),
        )
        .slice(0, 200)
        .map((x) => ({ name: x.name, l: x.l, r: x.r, at: x.at }));
    }
    default:
      return undefined;
  }
}

/* ---- stamps ---- */
/** A value saved before stamps existed: sent to the account when it has none, never wins over a real value there. */
export const TW_LEGACY_STAMP = 1;
export function readTwAt(): Record<string, number> {
  const out: Record<string, number> = {};
  try {
    const raw = localStorage.getItem(TW_AT_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    if (isObj(v)) for (const [k, x] of Object.entries(v)) if (num(x)) out[k] = x;
    for (const id of [...Object.keys(TW_PREFS_FIELD), ...TW_SEALED_IDS]) {
      if (out[id] === undefined && localStorage.getItem(key(id)) !== null)
        out[id] = TW_LEGACY_STAMP;
    }
  } catch {
    /* private mode: whatever was read */
  }
  return out;
}
export function stampTw(id: string, at: number): void {
  try {
    localStorage.setItem(TW_AT_KEY, JSON.stringify({ ...readTwAt(), [id]: at }));
  } catch {
    /* private mode */
  }
}

/* ---- in-page hubs ---- */
const localSubs = new Set<() => void>();
/** The widgets' own subscription (every `useLocal` instance re-reads when any value changes). */
export function subscribeTwLocal(cb: () => void): () => void {
  localSubs.add(cb);
  return () => {
    localSubs.delete(cb);
  };
}
export function notifyTwLocal(): void {
  localSubs.forEach((l) => l());
}

type EditListener = (id: string, value: unknown, at: number) => void;
const editSubs = new Set<EditListener>();
/** Local edits of synced widgets only (a value that came from the account never fires this). */
export function onTwEdit(fn: EditListener): () => void {
  editSubs.add(fn);
  return () => {
    editSubs.delete(fn);
  };
}
export function emitTwEdit(id: string, value: unknown, at: number): void {
  if (!isSyncedTw(id)) return;
  editSubs.forEach((l) => l(id, value, at));
}

/** Take a value from the account: store it with its stamp and refresh the widgets. No edit event. */
export function applyTwRemote(id: string, value: unknown, at: number): void {
  try {
    localStorage.setItem(key(id), JSON.stringify(value));
  } catch {
    /* private mode */
  }
  stampTw(id, at);
  notifyTwLocal();
}

/* ---- reconcile ---- */
export function reconcileTwPref(
  localAt: number,
  remoteAt: number | null,
): { apply?: true; push?: true } {
  if (remoteAt === null) return localAt > 0 ? { push: true } : {};
  if (remoteAt > localAt) return { apply: true };
  if (localAt > remoteAt) return { push: true };
  return {};
}

export interface TwBundle {
  values: Record<string, unknown>;
  at: Record<string, number>;
}
/** This device's stored value of a synced widget (normalized), or undefined. */
export function readTwValue(id: string): unknown {
  try {
    const raw = localStorage.getItem(key(id));
    return raw === null ? undefined : normalizeTw(id, JSON.parse(raw));
  } catch {
    return undefined;
  }
}

type LrRow = { name: string; l: number; r: number; at: number };
/** The account's left/right results plus the ones only this device has (same name and time = the same result). */
function unionLr(theirs: unknown, mine: unknown): LrRow[] | null {
  if (!Array.isArray(theirs) || !Array.isArray(mine)) return null;
  const have = new Set((theirs as LrRow[]).map((x) => `${x.name}|${x.at}`));
  const extra = (mine as LrRow[]).filter((x) => !have.has(`${x.name}|${x.at}`));
  if (!extra.length) return null;
  return [...(theirs as LrRow[]), ...extra].sort((a, b) => a.at - b.at).slice(-200);
}

export function reconcileTwBundle(
  localAt: Record<string, number>,
  remote: TwBundle | null,
  localValue: (id: string) => unknown = readTwValue,
  now: number = Date.now(),
): { apply: Record<string, { value: unknown; at: number }>; push: boolean } {
  const apply: Record<string, { value: unknown; at: number }> = {};
  let push = false;
  for (const id of TW_SEALED_IDS) {
    const l = localAt[id] ?? 0;
    const r = remote?.at?.[id];
    if (typeof r !== 'number') {
      if (l > 0) push = true;
      continue;
    }
    if (r > l) {
      const value = normalizeTw(id, remote?.values?.[id]);
      if (value === undefined) continue;
      // A result list saved before stamps existed is added to, never replaced (results are the person's own numbers).
      const merged =
        l === TW_LEGACY_STAMP && id === 'lr-balance' ? unionLr(value, localValue(id)) : null;
      if (merged) {
        apply[id] = { value: merged, at: Math.max(r + 1, now) };
        push = true;
      } else apply[id] = { value, at: r };
    } else if (l > r) push = true;
  }
  return { apply, push };
}
