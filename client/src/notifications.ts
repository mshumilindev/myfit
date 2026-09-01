/**
 * Milestone notifications — a derived "inbox" of noteworthy training events,
 * computed from history (no server): new strength-standard tiers, personal
 * records, unlocked achievements, positive trends, streak milestones, and the
 * weekly volume goal. Each event has a stable id and a best-effort timestamp;
 * "unread" is everything newer than the last-seen timestamp the viewer stored.
 *
 * This is separate from the server-pushed org/role `Notice` strip — those are
 * account notices; these are personal milestones.
 */
import { useSyncExternalStore } from 'react';
import {
  useStore,
  isStrengthExercise,
  topSet,
  setTopWeight,
  latestWeight,
  consistencyStreak,
} from './store';
import { computeStandards } from './standards';
import { computeFeats } from './feats';
import { computeTrends } from './trends';
import { LANDMARKS, VOLUME_MUSCLES, classifyZone, weeklyMuscleSets } from './volume';
import { fmtKg, fmtShortDate, fmtWeekday, type LocaleId } from './i18n';
import type { useT } from './i18n';
import { templateById, type ActiveChallenge } from './challenges';

type T = ReturnType<typeof useT>['t'];

export type NotifKind = 'standard' | 'pr' | 'feat' | 'trend' | 'streak' | 'volume' | 'challenge';

export interface Notif {
  id: string;
  kind: NotifKind;
  ts: number;
  title: string;
  subtitle: string;
  /** Hash route to open on tap (routed by App's hashchange handler). */
  nav?: string;
}

const DAY = 24 * 3600 * 1000;
const STREAK_MILESTONES = [7, 14, 30, 50, 100, 150, 200, 300, 365, 500, 730, 1000];

/** Monday-start week key for the volume-goal event id. */
function weekKey(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

type Store = ReturnType<typeof useStore>;

/** Compute the current milestone feed, newest first (capped). */
export function computeNotifs(
  store: Store,
  now: number,
  t: T,
  challenges: ActiveChallenge[] = [],
): Notif[] {
  const finished = store.workouts.filter((w) => w.finishedAt !== null);
  const out: Notif[] = [];

  // --- Completed challenges (posted when a challenge is finished).
  for (const ac of challenges) {
    if (ac.status !== 'done') continue;
    const tmpl = templateById(ac.templateId);
    if (!tmpl) continue;
    out.push({
      id: `challenge:${ac.id}`,
      kind: 'challenge',
      ts: ac.completedAt ?? now,
      title: t.notifChallengeTitle(tmpl.title(t, ac.target)),
      subtitle: t.notifChallengeSub,
      nav: '#/challenges',
    });
  }

  if (finished.length === 0) {
    out.sort((a, b) => b.ts - a.ts);
    return out.slice(0, 400);
  }

  const lastWorkoutTs = finished.reduce((m, w) => Math.max(m, w.finishedAt ?? w.startedAt), 0);

  // --- Personal records: each session that set a new all-time top-set weight.
  const chron = [...finished].sort((a, b) => a.startedAt - b.startedAt);
  const bestByName = new Map<string, number>();
  for (const w of chron) {
    for (const ex of w.exercises) {
      if (!isStrengthExercise(ex)) continue;
      const lt = store.exerciseLoadTypes[ex.name];
      if (lt === 'assist' || lt === 'band') continue;
      const top = topSet(ex.sets);
      if (!top) continue;
      const wgt = setTopWeight(top);
      if (wgt <= 0) continue;
      const key = ex.name.toLowerCase();
      const prev = bestByName.get(key) ?? 0;
      if (wgt > prev) {
        if (prev > 0) {
          out.push({
            id: `pr:${key}:${w.id}`,
            kind: 'pr',
            ts: top.loggedAt ?? w.finishedAt ?? w.startedAt,
            title: t.notifPrTitle(ex.name),
            subtitle: `${fmtKg(wgt)} · ${t.notifPrUp(fmtKg(wgt - prev))}`,
            nav: `#/exercise/${encodeURIComponent(ex.name)}`,
          });
        }
        bestByName.set(key, wgt);
      }
    }
  }

  // --- Strength standards: current tier per trained discipline.
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? 0;
  const sex = store.bodyMetrics.sex === 'female' ? 'F' : 'M';
  for (const r of computeStandards(finished, bodyKg, sex).results) {
    if (!r.trained || r.achievedIdx < 0) continue;
    const tierId = r.tierIds[r.achievedIdx];
    const tierLabel = r.system === 'rank' ? t.rankShort[tierId] : t.lvlShort[tierId];
    out.push({
      id: `std:${r.key}:${tierId}`,
      kind: 'standard',
      ts: lastWorkoutTs,
      title: `${r.name} → ${tierLabel}`,
      subtitle: `${fmtKg(r.best)} · ${t.notifStandardSub}`,
      nav: `#/feats/standards?f=std-${encodeURIComponent(r.key)}`,
    });
  }

  // --- Achievements: every unlocked feat, dated by its unlock time.
  const feats = computeFeats(finished);
  for (const ach of Object.values(feats.byGroup).flat()) {
    if (!ach.unlocked) continue;
    out.push({
      id: `feat:${ach.key}`,
      kind: 'feat',
      ts: ach.unlockAt ?? lastWorkoutTs,
      title: ach.title,
      subtitle: t.notifFeatSub,
      nav: `#/feats?f=feat-${encodeURIComponent(ach.key)}`,
    });
  }

  // --- Positive trends (the good-news insights only). Dated at the last session
  // (not `now`) so they don't re-surface as "new" every time the app is opened.
  const trends = computeTrends(finished, store.bodyMetrics, now);
  if (trends.ready) {
    for (const ins of trends.insights) {
      if (ins.level !== 'good') continue;
      out.push({
        id: `trend:${ins.key}`,
        kind: 'trend',
        ts: lastWorkoutTs,
        title: ins.headline ?? ins.kicker ?? ins.detail,
        subtitle: ins.detail,
        nav: '#/trends',
      });
    }
  }

  // --- Streak milestones (consecutive-day streak crossing a threshold).
  const streak = consistencyStreak(now);
  const milestone = [...STREAK_MILESTONES].reverse().find((m) => streak >= m);
  if (milestone) {
    out.push({
      id: `streak:${milestone}`,
      kind: 'streak',
      ts: lastWorkoutTs,
      title: t.notifStreakTitle(milestone),
      subtitle: t.notifStreakSub,
    });
  }

  // --- Weekly volume goal: every landmarked muscle in its productive range+.
  const per = weeklyMuscleSets(finished, now, 7);
  const allProductive = VOLUME_MUSCLES.every((m) => {
    const lm = LANDMARKS[m];
    if (!lm) return true;
    const z = classifyZone(per.get(m) ?? 0, lm);
    return z === 'productive' || z === 'high' || z === 'over';
  });
  if (allProductive) {
    out.push({
      id: `volume:${weekKey(now)}`,
      kind: 'volume',
      ts: lastWorkoutTs,
      title: t.notifVolumeTitle,
      subtitle: t.notifVolumeSub,
      nav: '#/progress/volume',
    });
  }

  out.sort((a, b) => b.ts - a.ts);
  return out.slice(0, 400);
}

// --- Seen-state (per-event record) — per device, in localStorage. ------------
/**
 * Read tracking, redesigned to stop the feed re-flooding. The earlier model was
 * a capped set of "seen" ids: with a long history it overflowed the cap and
 * evicted the ids of the always-present summary events (current standard tier,
 * streak, weekly-volume goal), which sit at the top of the feed because their
 * timestamp is the last workout — so they resurfaced as "new" on every open.
 *
 * Instead we keep a small record per event id: a timestamp FROZEN at first
 * sight (so a milestone keeps the date it actually happened and never jumps to
 * "now" when you train again) and a seen flag. The map is reconciled against the
 * live feed each compute — new ids are added (unread, or silently seen on the
 * very first run), the timestamp of a known id is reused, and the whole thing is
 * capped by recency so a feed member is never the one evicted.
 */
export interface NotifMeta {
  /** Event timestamp, frozen the first time we saw this id. */
  ts: number;
  seen: boolean;
}
export type NotifState = Record<string, NotifMeta>;

const STATE_KEY = 'spotter.notif.state';
export const NOTIF_INIT_KEY = 'spotter.notif.init';
/** How many event records to retain (far past the visible feed, so nothing on
 *  screen is ever evicted). */
const MAX_STATE = 1000;
/** How many events the feed shows. */
const FEED_CAP = 120;

export function loadNotifState(): NotifState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as NotifState) : {};
  } catch {
    return {};
  }
}

export function saveNotifState(state: NotifState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota — ignore */
  }
}

/**
 * Reconcile the freshly computed events against the stored state: freeze each
 * id's timestamp at first sight, carry its seen flag (a brand-new id is unread,
 * unless this is the very first run, when the whole existing history is
 * baselined as read), then cap by recency. Returns the display feed (stamped
 * with the stable timestamps, newest first) and the next state to persist.
 */
export function reconcileNotifs(
  raw: Notif[],
  prev: NotifState,
  firstRun: boolean,
): { notifs: Notif[]; state: NotifState } {
  const next: NotifState = {};
  for (const n of raw) {
    const ex = prev[n.id];
    next[n.id] = { ts: ex?.ts ?? n.ts, seen: ex?.seen ?? firstRun };
  }
  let entries = Object.entries(next);
  if (entries.length > MAX_STATE) {
    entries = entries.sort((a, b) => b[1].ts - a[1].ts).slice(0, MAX_STATE);
  }
  const state: NotifState = Object.fromEntries(entries);
  const notifs = raw
    .filter((n) => state[n.id])
    .map((n) => ({ ...n, ts: state[n.id].ts }))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, FEED_CAP);
  return { notifs, state };
}

/** Mark specific ids read (viewport entry). Returns the same object when nothing
 *  changed so callers can skip a needless persist/render. */
export function markSeen(state: NotifState, ids: string[]): NotifState {
  let changed = false;
  const next: NotifState = { ...state };
  for (const id of ids) {
    const m = next[id];
    if (m && !m.seen) {
      next[id] = { ts: m.ts, seen: true };
      changed = true;
    }
  }
  return changed ? next : state;
}

/** Mark everything currently known read ("mark all read"). */
export function markAllSeen(state: NotifState): NotifState {
  let changed = false;
  const next: NotifState = { ...state };
  for (const id in next) {
    if (!next[id].seen) {
      next[id] = { ts: next[id].ts, seen: true };
      changed = true;
    }
  }
  return changed ? next : state;
}

export function unreadCount(state: NotifState, notifs: Notif[]): number {
  return notifs.reduce((n, x) => n + (state[x.id]?.seen ? 0 : 1), 0);
}

export function isSeen(state: NotifState, id: string): boolean {
  return !!state[id]?.seen;
}

// --- Reactive store: the reconciled feed + read state ------------------------
// A tiny external store (mirrors store.ts) so the read state can be a fold over
// renders — new events added, seen flags carried — without reading refs during
// render or setting state in an effect. The app feeds it the freshly computed
// events from an effect (`syncNotifs`); views subscribe with `useNotifs`.
let storeState: NotifState = loadNotifState();
let storeFeed: Notif[] = [];
let firstRun: boolean = (() => {
  try {
    return !localStorage.getItem(NOTIF_INIT_KEY);
  } catch {
    return true;
  }
})();
let snapshot: { notifs: Notif[]; state: NotifState } = { notifs: storeFeed, state: storeState };
const notifListeners = new Set<() => void>();

function emitNotifs(): void {
  snapshot = { notifs: storeFeed, state: storeState };
  notifListeners.forEach((l) => l());
}

/** Reconcile freshly computed events into the store (call from an effect). */
export function syncNotifs(raw: Notif[]): void {
  const { notifs, state } = reconcileNotifs(raw, storeState, firstRun);
  if (firstRun) {
    try {
      localStorage.setItem(NOTIF_INIT_KEY, '1');
    } catch {
      /* private mode — ignore */
    }
    firstRun = false;
  }
  const feedSame =
    notifs.length === storeFeed.length &&
    notifs.every((n, i) => storeFeed[i]?.id === n.id && storeFeed[i]?.ts === n.ts);
  const stateSame = sameSeen(state, storeState);
  storeState = state;
  storeFeed = notifs;
  saveNotifState(state);
  if (!feedSame || !stateSame) emitNotifs();
}

/** Shallow equality on the seen flags + key set (ts is frozen, so ignore it). */
function sameSeen(a: NotifState, b: NotifState): boolean {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  for (const k of ak) if (!b[k] || b[k].seen !== a[k].seen) return false;
  return true;
}

export function markNotifsSeen(ids: string[]): void {
  const next = markSeen(storeState, ids);
  if (next !== storeState) {
    storeState = next;
    saveNotifState(next);
    emitNotifs();
  }
}

export function markAllNotifsSeen(): void {
  const next = markAllSeen(storeState);
  if (next !== storeState) {
    storeState = next;
    saveNotifState(next);
    emitNotifs();
  }
}

/** Reactive: the current feed + read state. */
export function useNotifs(): { notifs: Notif[]; state: NotifState } {
  return useSyncExternalStore(
    (cb) => {
      notifListeners.add(cb);
      return () => notifListeners.delete(cb);
    },
    () => snapshot,
  );
}

/** Relative label for the feed: "just now" / "3h" / weekday / short date. */
export function notifTime(ts: number, now: number, t: T, locale: LocaleId): string {
  const diff = now - ts;
  if (diff < 60_000) return t.justNow;
  if (diff < 3_600_000) return t.minAgo(Math.round(diff / 60_000));
  if (diff < 6 * 3600_000) return `${Math.round(diff / 3_600_000)}h`;
  if (diff < 7 * DAY) return fmtWeekday(ts, locale);
  return fmtShortDate(ts, locale);
}
