/**
 * Apex rows of the milestone feed (completed challenges, strength-standard tiers, unlocked feats). Kept out of
 * `notifications.ts` so the Apex code (challenge templates, standards, feats) is a lazy chunk fetched only while the
 * Apex add-on is installed (SPO-500 I8). `useApexNotifRows` does the lazy load.
 */
import { latestWeight } from './store';
import type { useStore } from './store';
import { computeStandards } from './standards';
import { computeFeats } from './feats';
import { templateById, type ActiveChallenge } from './challenges';
import { fmtKg } from './i18n';
import type { useT } from './i18n';
import type { Notif } from './notifications';

type T = ReturnType<typeof useT>['t'];
type Store = ReturnType<typeof useStore>;

export interface ApexNotifModules {
  /** Mastery add-on installed: off = no challenge, standard or feat rows. */
  mastery: boolean;
  /** Apex modules: ranks and awards each switch their own rows off. */
  ranks: boolean;
  awards: boolean;
}

export function computeApexNotifs(
  store: Store,
  now: number,
  t: T,
  challenges: ActiveChallenge[],
  modules: ApexNotifModules,
): Notif[] {
  const { mastery, ranks, awards } = modules;
  const out: Notif[] = [];
  for (const ac of mastery ? challenges : []) {
    if (ac.status !== 'done') continue;
    const tmpl = templateById(ac.templateId);
    if (!tmpl) continue;
    out.push({
      id: `challenge:${ac.id}`,
      kind: 'challenge',
      ts: ac.completedAt ?? now,
      title: t.notifChallengeTitle(tmpl.title(t, ac.target)),
      subtitle: t.notifChallengeSub,
      nav: '#/apex/challenges',
    });
  }
  const finished = store.workouts.filter((w) => w.finishedAt !== null);
  if (finished.length === 0) return out;
  const lastWorkoutTs = finished.reduce((m, w) => Math.max(m, w.finishedAt ?? w.startedAt), 0);

  // --- Strength standards: current tier per trained discipline.
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? 0;
  const sex = store.bodyMetrics.sex === 'female' ? 'F' : 'M';
  for (const r of mastery && ranks ? computeStandards(finished, bodyKg, sex).results : []) {
    if (!r.trained || r.achievedIdx < 0) continue;
    const tierId = r.tierIds[r.achievedIdx];
    const tierLabel = r.system === 'rank' ? t.rankShort[tierId] : t.lvlShort[tierId];
    out.push({
      id: `std:${r.key}:${tierId}`,
      kind: 'standard',
      ts: lastWorkoutTs,
      title: `${r.name} → ${tierLabel}`,
      subtitle: `${fmtKg(r.best)} · ${t.notifStandardSub}`,
      nav: `#/apex/ranks?f=std-${encodeURIComponent(r.key)}`,
    });
  }

  // --- Achievements: every unlocked feat, dated by its unlock time.
  const feats = mastery && awards ? computeFeats(finished) : null;
  for (const ach of Object.values(feats?.byGroup ?? {}).flat()) {
    if (!ach.unlocked) continue;
    out.push({
      id: `feat:${ach.key}`,
      kind: 'feat',
      ts: ach.unlockAt ?? lastWorkoutTs,
      title: ach.title,
      subtitle: t.notifFeatSub,
      nav: `#/apex/awards?f=feat-${encodeURIComponent(ach.key)}`,
    });
  }
  return out;
}
