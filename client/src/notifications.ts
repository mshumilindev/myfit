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

type T = ReturnType<typeof useT>['t'];

export type NotifKind = 'standard' | 'pr' | 'feat' | 'trend' | 'streak' | 'volume';

export interface Notif {
  id: string;
  kind: NotifKind;
  ts: number;
  title: string;
  subtitle: string;
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
export function computeNotifs(store: Store, now: number, t: T): Notif[] {
  const finished = store.workouts.filter((w) => w.finishedAt !== null);
  const out: Notif[] = [];
  if (finished.length === 0) return out;

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
    });
  }

  out.sort((a, b) => b.ts - a.ts);
  return out.slice(0, 50);
}

// --- Seen-state (last-seen timestamp) — per device, in localStorage. ---------
const SEEN_KEY = 'spotter.notif.seenTs';

export function loadSeenTs(): number | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw != null ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function saveSeenTs(ts: number): void {
  try {
    localStorage.setItem(SEEN_KEY, String(ts));
  } catch {
    /* private mode / quota — ignore */
  }
}

/** Unread = events newer than the last-seen mark. Null (never opened) reads as
 *  zero — the first load baselines silently rather than dumping all of history. */
export function unreadCount(notifs: Notif[], seenTs: number | null): number {
  if (seenTs == null) return 0;
  return notifs.reduce((n, x) => n + (x.ts > seenTs ? 1 : 0), 0);
}

export function isUnread(n: Notif, seenTs: number | null): boolean {
  return seenTs != null && n.ts > seenTs;
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
