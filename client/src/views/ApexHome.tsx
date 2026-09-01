/**
 * Apex — Home / Overview. The glanceable landing for the gamification app:
 * active challenge (ring), current streak, the closest strength rank, the
 * latest achievement, and the top of the milestone feed. Everything is derived
 * from the same training history — this screen just gathers it in one place.
 */
import { useMemo } from 'react';
import { fmtDayMonth, useT } from '../i18n';
import { Icon } from '../ui';
import { consistencyStreak, latestWeight, restDayKeys, dayKey, type StoreState } from '../store';
import {
  useChallenges,
  templateById,
  challengeCtx,
  challengeProgress,
  fmtChallengeValue,
} from '../challenges';
import { computeStandards } from '../standards';
import { computeFeats } from '../feats';
import type { Notif } from '../notifications';
import type { ApexTab } from './ApexApp';

function Ring({ pct, icon }: { pct: number; icon: string }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <div className="apx-ring">
      <svg width="58" height="58" viewBox="0 0 58 58" style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx="29"
          cy="29"
          r={r}
          fill="none"
          stroke="var(--color-neutral-800)"
          strokeWidth="5"
        />
        <circle
          cx="29"
          cy="29"
          r={r}
          fill="none"
          stroke="url(#apxg)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
        <defs>
          <linearGradient id="apxg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--color-accent-700)" />
            <stop offset="1" stopColor="var(--color-accent-200)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="apx-ring-ic">
        <Icon name={icon} weight="bold" />
      </span>
    </div>
  );
}

export function ApexHome({
  store,
  now,
  notifs,
  onTab,
}: {
  store: StoreState;
  now: number;
  notifs: Notif[];
  onTab: (t: ApexTab) => void;
}) {
  const { t, locale } = useT();
  const active = useChallenges();
  const finished = useMemo(
    () => store.workouts.filter((w) => w.finishedAt !== null),
    [store.workouts],
  );

  // Active challenge (the first one still running) → its live progress.
  const ctx = useMemo(
    () => challengeCtx(store, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.workouts, store.activities, store.bodyMetrics, store.restPeriods, now],
  );
  const activeCard = (() => {
    for (const ac of active) {
      if (ac.status !== 'active') continue;
      const tmpl = templateById(ac.templateId);
      if (!tmpl) continue;
      return { ac, tmpl, prog: challengeProgress(ac, tmpl, ctx) };
    }
    return null;
  })();

  const streak = useMemo(() => consistencyStreak(now), [now]);
  const weekDots = useMemo(() => {
    const activeDays = new Set<number>();
    for (const w of finished) activeDays.add(dayKey(w.startedAt));
    const rest = restDayKeys(store.restPeriods);
    const today = dayKey(now);
    // Monday-start current week.
    const mondayOffset = (new Date(now).getDay() + 6) % 7;
    const monday = today - mondayOffset;
    return Array.from({ length: 7 }, (_, i) => {
      const d = monday + i;
      if (d > today) return 'future';
      return activeDays.has(d) || rest.has(d) ? 'on' : 'off';
    });
  }, [finished, store.restPeriods, now]);

  // Closest strength rank (trained lift with the smallest gap to its next tier).
  const nextRank = useMemo(() => {
    const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? 0;
    const sex = store.bodyMetrics.sex === 'female' ? 'F' : 'M';
    if (!bodyKg || (store.bodyMetrics.sex !== 'male' && store.bodyMetrics.sex !== 'female'))
      return null;
    let best: { name: string; tier: string; toGo: number; progress: number } | null = null;
    for (const r of computeStandards(finished, bodyKg, sex).results) {
      if (!r.trained || r.nextIdx == null) continue;
      const label =
        r.system === 'rank' ? t.rankShort[r.tierIds[r.nextIdx]] : t.lvlShort[r.tierIds[r.nextIdx]];
      const toGo = Math.round(r.toGo ?? 0);
      if (!best || toGo < best.toGo)
        best = { name: r.name, tier: label, toGo, progress: r.progress };
    }
    return best;
  }, [finished, store.bodyMetrics, t]);

  // Latest unlocked achievement.
  const latestAward = useMemo(() => {
    const feats = computeFeats(finished);
    let best: { title: string; emoji: string; at: number } | null = null;
    for (const a of Object.values(feats.byGroup).flat()) {
      if (!a.unlocked || !a.unlockAt) continue;
      if (!best || a.unlockAt > best.at) best = { title: a.title, emoji: a.emoji, at: a.unlockAt };
    }
    return best;
  }, [finished]);

  const recent = notifs.slice(0, 3);
  const RECENT_ICON: Record<string, string> = {
    standard: 'trophy',
    pr: 'barbell',
    feat: 'medal',
    trend: 'chart-line-up',
    streak: 'fire',
    volume: 'check-circle',
    challenge: 'flag-banner',
  };
  const rel = (ts: number) => {
    const diff = now - ts;
    if (diff < 3600_000) return `${Math.max(1, Math.round(diff / 60000))}m`;
    if (diff < 6 * 3600_000) return `${Math.round(diff / 3600_000)}h`;
    return fmtDayMonth(ts, locale);
  };

  return (
    <div className="apx-home">
      <div className="apex-title">
        <h2 className="title-26">{t.apexName}</h2>
        <span className="apex-title-sub">{t.apexTagline}</span>
      </div>

      <div className="apx-sec-label">{t.apexActiveChallenge}</div>
      {activeCard ? (
        <button className="apx-card apx-active" onClick={() => onTab('challenges')}>
          <Ring pct={activeCard.prog.pct} icon={activeCard.tmpl.icon} />
          <div className="apx-active-main">
            <div className="apx-active-title">
              {activeCard.tmpl.title(t, activeCard.prog.target)}
            </div>
            <div className="apx-active-sub">
              <span className="apx-accent num">
                {fmtChallengeValue(activeCard.tmpl.unit, activeCard.prog.value, t)}
              </span>{' '}
              / {fmtChallengeValue(activeCard.tmpl.unit, activeCard.prog.target, t)}{' '}
              {t.chUnit[activeCard.tmpl.unit] ?? activeCard.tmpl.unit} ·{' '}
              {t.chDaysLeft(activeCard.prog.daysLeft)}
            </div>
          </div>
          <Icon name="caret-right" className="apx-go" />
        </button>
      ) : (
        <button className="apx-card apx-empty-card" onClick={() => onTab('challenges')}>
          <div className="apx-active-main">
            <div className="apx-active-title">{t.apexNoActive}</div>
            <div className="apx-active-sub">{t.apexStartOne}</div>
          </div>
          <Icon name="caret-right" className="apx-go" />
        </button>
      )}

      <div className="apx-card apx-streak">
        <span className="apx-streak-ic">
          <Icon name="fire" weight="fill" />
        </span>
        <div className="apx-streak-txt">
          <div className="apx-streak-n num">{t.notifStreakTitle(streak)}</div>
          <div className="apx-streak-lab">{t.apexThisWeek}</div>
        </div>
        <div className="apx-week">
          {weekDots.map((s, i) => (
            <span key={i} className={`apx-dot st-${s}`} />
          ))}
        </div>
      </div>

      {nextRank && (
        <>
          <div className="apx-sec-label">{t.apexNextRank}</div>
          <button className="apx-card apx-rank" onClick={() => onTab('ranks')}>
            <span className="apx-rank-ic">
              <Icon name="trophy" weight="bold" />
            </span>
            <div className="apx-rank-main">
              <div className="apx-rank-title">
                {nextRank.name} → {nextRank.tier}
              </div>
              <div className="apx-rank-bar">
                <span style={{ width: `${Math.round(nextRank.progress * 100)}%` }} />
              </div>
            </div>
            <span className="apx-accent num apx-rank-togo">+{nextRank.toGo} kg</span>
          </button>
        </>
      )}

      {latestAward && (
        <>
          <div className="apx-sec-label">{t.apexLatestAward}</div>
          <button className="apx-card apx-award" onClick={() => onTab('awards')}>
            <span className="apx-award-ic">
              {latestAward.emoji || <Icon name="medal" weight="fill" />}
            </span>
            <div className="apx-award-main">
              <div className="apx-award-title">{latestAward.title}</div>
              <div className="apx-award-sub">{fmtDayMonth(latestAward.at, locale)}</div>
            </div>
          </button>
        </>
      )}

      {recent.length > 0 && (
        <>
          <div className="apx-sec-head">
            <span className="apx-sec-label">{t.apexRecent}</span>
            <button className="apx-seeall" onClick={() => onTab('feed')}>
              {t.apexSeeAll}
            </button>
          </div>
          <div className="apx-recent">
            {recent.map((n) => (
              <button key={n.id} className="apx-recent-row" onClick={() => onTab('feed')}>
                <span className="apx-recent-ic">
                  <Icon name={RECENT_ICON[n.kind] ?? 'star'} weight="fill" />
                </span>
                <span className="apx-recent-title">{n.title}</span>
                <span className="apx-recent-time">{rel(n.ts)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
