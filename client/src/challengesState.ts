/**
 * The started challenges (SPO-391): a small reactive list that lives in `localStorage` (`spotter.challenges`, the cache)
 * and in one sealed document `users/{uid}/meta/challenges` (`list` + `updatedAt`, last-write-wins by one stamp kept in
 * `spotter.challengesAt`). A leaf: no store import, so store.ts can own the Firestore side without a cycle
 * (challenges.ts imports store.ts).
 */
import { useSyncExternalStore } from 'react';

export interface ActiveChallenge {
  id: string;
  templateId: string;
  startedAt: number;
  endsAt: number;
  target: number;
  status: 'active' | 'done' | 'given-up';
  /** When it was completed (status flips to 'done'). */
  completedAt?: number | null;
  /** Whether the completion screen has been acknowledged. */
  celebrated?: boolean;
}

export const CH_KEY = 'spotter.challenges';
export const CH_AT_KEY = 'spotter.challengesAt';
const MAX_CHALLENGES = 200;

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** A stored or received list to a safe one: a malformed entry is dropped, never repaired by guessing. */
export function normalizeChallenges(raw: unknown): ActiveChallenge[] {
  if (!Array.isArray(raw)) return [];
  const out: ActiveChallenge[] = [];
  const seen = new Set<string>();
  for (const c of raw) {
    if (!isObj(c)) continue;
    const { id, templateId, startedAt, endsAt, target, status } = c;
    if (typeof id !== 'string' || !id || seen.has(id)) continue;
    if (typeof templateId !== 'string' || !templateId) continue;
    if (!num(startedAt) || !num(endsAt) || !num(target)) continue;
    if (status !== 'active' && status !== 'done' && status !== 'given-up') continue;
    seen.add(id);
    const one: ActiveChallenge = { id, templateId, startedAt, endsAt, target, status };
    if (c.completedAt === null || num(c.completedAt))
      one.completedAt = c.completedAt as number | null;
    if (typeof c.celebrated === 'boolean') one.celebrated = c.celebrated;
    out.push(one);
    if (out.length >= MAX_CHALLENGES) break;
  }
  return out;
}

export interface ChallengesDecision {
  apply?: { at: number; list: ActiveChallenge[] };
  push?: true;
}
/**
 * A snapshot of the account's document arrived (`remote` null = none yet).
 * none yet: keep this device's list and send it once; a newer local edit wins; otherwise the account's list replaces ours.
 */
export function reconcileChallenges(
  local: { at: number; list: ActiveChallenge[] },
  remote: { at: number; raw: unknown } | null,
): ChallengesDecision {
  if (!remote) return local.list.length ? { push: true } : {};
  if (local.at > remote.at) return { push: true };
  if (local.at === remote.at) return {};
  const theirs = normalizeChallenges(remote.raw);
  // First contact (this device never edited or synced the list): the account's challenges stand untouched; only the ones
  // this device has and the account lacks (by id) are added, then written back. Nothing the account holds is overwritten.
  if (local.at === 0 && local.list.length) {
    const have = new Set(theirs.map((c) => c.id));
    const extra = local.list.filter((c) => !have.has(c.id));
    if (extra.length) return { apply: { at: remote.at, list: [...theirs, ...extra] }, push: true };
  }
  return { apply: { at: remote.at, list: theirs } };
}

function readList(): ActiveChallenge[] {
  try {
    const raw = localStorage.getItem(CH_KEY);
    return raw ? normalizeChallenges(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}
function readAt(): number {
  try {
    return Number(localStorage.getItem(CH_AT_KEY)) || 0;
  } catch {
    return 0;
  }
}

let activeList: ActiveChallenge[] = readList();
let activeAt = readAt();
const listeners = new Set<() => void>();
const editListeners = new Set<(list: ActiveChallenge[], at: number) => void>();

function save(): void {
  try {
    localStorage.setItem(CH_KEY, JSON.stringify(activeList));
    localStorage.setItem(CH_AT_KEY, String(activeAt));
  } catch {
    /* private mode / quota — ignore */
  }
}
const emit = (): void => listeners.forEach((l) => l());

export const getChallenges = (): ActiveChallenge[] => activeList;
export const getChallengesAt = (): number => activeAt;

/** The person changed the list: stamp it, keep it on the device, tell the account sync. */
export function commitChallenges(next: ActiveChallenge[]): void {
  activeList = next;
  activeAt = Math.max(Date.now(), activeAt + 1);
  save();
  emit();
  editListeners.forEach((l) => l(activeList, activeAt));
}
/** Local edits only (a list that came from the account never fires this). */
export function onChallengesEdit(fn: (list: ActiveChallenge[], at: number) => void): () => void {
  editListeners.add(fn);
  return () => editListeners.delete(fn);
}
/** Take the account's list: stored with its stamp, widgets refresh, no edit event (no echo). */
export function applyRemoteChallenges(list: ActiveChallenge[], at: number): void {
  activeList = list;
  activeAt = at;
  save();
  emit();
}
/** Sign-out / account change: nothing of the previous person stays in memory or storage. */
export function resetChallenges(): void {
  activeList = [];
  activeAt = 0;
  try {
    localStorage.removeItem(CH_KEY);
    localStorage.removeItem(CH_AT_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

/** Reactive: the list of started challenges. */
export function useChallenges(): ActiveChallenge[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => activeList,
  );
}
