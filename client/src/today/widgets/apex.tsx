import { useMemo, type ReactNode } from 'react';
import {
  Widget,
  WidgetBar,
  WidgetBars,
  WidgetDelta,
  WidgetDots,
  WidgetList,
  WidgetRing,
  WidgetEmpty,
} from '../../components/ui/Widget';
import { Button } from '../../components/ui/Button';
import { consistencyStreak, dayKey, latestWeight, type StoreState } from '../../store';
import { fmtDayMonth, getLocale, type LocaleId } from '../../i18n';
import {
  useChallenges,
  templateById,
  challengeCtx,
  challengeProgress,
  fmtChallengeValue,
} from '../../challenges';
import {
  computeMastery,
  MASTERY_RANKS,
  AXIS_WEIGHT,
  sublevelRoman,
  type AxisKey,
  type MasteryResult,
} from '../../mastery';
import {
  computeFeats,
  CATEGORIES,
  featLabel,
  fmtAchValue,
  type Ach,
  type FeatGroup,
  type FeatsResult,
} from '../../feats';
import { computeStandards, type DiscResult } from '../../standards';
import { useNotifs, unreadCount, notifTime } from '../../notifications';
import type { Workout } from '../../types';
import type { WidgetCtx, WidgetDef } from '../registry';
import type { WidgetSize } from '../../components/ui/Widget';
import { axs, type ApexStrings } from './apex.strings';
import { DAY, pct, signed } from './format';

/* ---------- Shared, memoised reads (several widgets share one computation) ---------- */

type Strings = WidgetCtx['t'];

function finishedOf(store: StoreState): Workout[] {
  return store.workouts.filter((w) => w.finishedAt !== null);
}

/** computeFeats once per workouts array + locale (tier titles are localised). */
let featsMemo: { key: Workout[]; locale: LocaleId; res: FeatsResult } | null = null;
function featsOf(store: StoreState): FeatsResult {
  const locale = getLocale();
  if (!featsMemo || featsMemo.key !== store.workouts || featsMemo.locale !== locale)
    featsMemo = { key: store.workouts, locale, res: computeFeats(finishedOf(store)) };
  return featsMemo.res;
}

interface MasteryRead {
  m: MasteryResult;
  /** Rating change over the last 7 days (null while there is nothing to compare). */
  weekDelta: number | null;
  /** Finished sessions in the last 7 days. */
  sessions7: number;
}
let masteryMemo: { deps: unknown[]; res: MasteryRead } | null = null;
/** computeMastery now and a week ago (for the pace), once per data change / hour. */
function masteryOf(store: StoreState, now: number): MasteryRead {
  const hour = Math.floor(now / 3_600_000);
  const deps = [
    store.workouts,
    store.bodyMetrics,
    store.sleeps,
    store.sleepSettings,
    store.mastery,
    hour,
  ];
  if (masteryMemo && masteryMemo.deps.every((d, i) => d === deps[i])) return masteryMemo.res;
  const opts = {
    trainingSinceYear: store.mastery.sinceYear,
    trainingPattern: store.mastery.pattern,
  };
  const m = computeMastery(store, now, opts);
  const weekAgo = now - 7 * DAY;
  const before = store.workouts.filter((w) => w.finishedAt !== null && w.finishedAt <= weekAgo);
  const sessions7 = store.workouts.filter(
    (w) => w.finishedAt !== null && w.finishedAt > weekAgo,
  ).length;
  const weekDelta =
    before.length > 0
      ? m.rating - computeMastery({ ...store, workouts: before }, weekAgo, opts).rating
      : null;
  const res = { m, weekDelta, sessions7 };
  masteryMemo = { deps, res };
  return res;
}

interface StandardsRead {
  /** 'body' = sex / body weight missing; 'lift' = no main lift logged yet. */
  missing: 'body' | 'lift' | null;
  trained: DiscResult[];
  closest: DiscResult | null;
  bodyKg: number;
}
let standardsMemo: { w: Workout[]; b: unknown; res: StandardsRead } | null = null;
function standardsOf(store: StoreState): StandardsRead {
  if (standardsMemo && standardsMemo.w === store.workouts && standardsMemo.b === store.bodyMetrics)
    return standardsMemo.res;
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? 0;
  const hasSex = store.bodyMetrics.sex === 'male' || store.bodyMetrics.sex === 'female';
  let res: StandardsRead = { missing: 'body', trained: [], closest: null, bodyKg };
  if (bodyKg > 0 && hasSex) {
    const sex = store.bodyMetrics.sex === 'female' ? 'F' : 'M';
    const trained = computeStandards(finishedOf(store), bodyKg, sex).results.filter(
      (r) => r.trained,
    );
    let closest: DiscResult | null = null;
    for (const r of trained) {
      if (r.nextIdx == null) continue;
      if (!closest || (r.toGo ?? 0) < (closest.toGo ?? 0)) closest = r;
    }
    res = { missing: trained.length ? null : 'lift', trained, closest, bodyKg };
  }
  standardsMemo = { w: store.workouts, b: store.bodyMetrics, res };
  return res;
}

function tierName(t: Strings, r: DiscResult, idx: number | null): string {
  if (idx == null || idx < 0) return '';
  const id = r.tierIds[idx];
  return r.system === 'rank'
    ? (t.rankShort[id] ?? id)
    : (t.masteryLevel[id] ?? t.lvlShort[id] ?? id);
}

function rankLabel(t: Strings, index: number, sub: number): string {
  const r = MASTERY_RANKS[index];
  return `${t.masteryRank[r.id] ?? r.id} ${sublevelRoman(sub)}`;
}

/** The next sublevel above the current one (null at the very top). */
function nextStep(t: Strings, m: MasteryResult): { label: string; at: number } | null {
  if (m.sublevel < 3)
    return { label: rankLabel(t, m.rankIndex, m.sublevel + 1), at: m.rating + m.toNextSublevel };
  if (!m.nextRank) return null;
  return { label: rankLabel(t, m.rankIndex + 1, 1), at: m.nextRank.threshold };
}

/** Progress (0–1) through the current sublevel. */
function sublevelFrac(m: MasteryResult): number {
  const top = m.nextRank ? m.nextRank.threshold : 1000;
  const third = (top - m.rank.threshold) / 3;
  const from = m.rank.threshold + (m.sublevel - 1) * third;
  return third > 0 ? Math.max(0, Math.min(1, (m.rating - from) / third)) : 1;
}

/** Nine ranks × three sublevels as one strip of 27 pips. */
function ladderPips(m: MasteryResult): boolean[] {
  const pos = m.rankIndex * 3 + m.sublevel - 1;
  return Array.from({ length: MASTERY_RANKS.length * 3 }, (_, i) => i <= pos);
}

/** Groups whose metric simply accrues per session (a "sessions away" estimate makes sense). */
const ACCRUING = new Set<FeatGroup>([
  'volume',
  'sessions',
  'hours',
  'sets',
  'reps',
  'trainingDays',
]);
function sessionsAway(a: Ach, sessions: number): number | null {
  if (!ACCRUING.has(a.group) || sessions === 0 || a.value <= 0) return null;
  const per = a.value / sessions;
  return Math.max(1, Math.ceil((a.threshold - a.value) / per));
}

function featTitle(a: Ach): string {
  return `${featLabel(a.group)} · ${a.title}`;
}

/** Locked feats nearest to unlocking, best first. */
function nearestFeats(res: FeatsResult, n: number): Ach[] {
  const next: Ach[] = [];
  for (const c of CATEGORIES) {
    const a = res.byGroup[c.group].find((x) => !x.unlocked);
    if (a) next.push(a);
  }
  return next.sort((a, b) => b.progress - a.progress).slice(0, n);
}

function unlockedFeats(res: FeatsResult): Ach[] {
  return Object.values(res.byGroup)
    .flat()
    .filter((a) => a.unlocked && a.unlockAt)
    .sort((a, b) => (b.unlockAt ?? 0) - (a.unlockAt ?? 0));
}

function progressLine(label: ReactNode, value: ReactNode, frac: number) {
  return (
    <div className="ul-flex ul-col ug-6">
      <div className="ul-flex uj-between ug-8">
        <span className="uiw-sub">{label}</span>
        <span className="uiw-sub">{value}</span>
      </div>
      <WidgetBar value={frac} tone="apex" />
    </div>
  );
}

function action(label: string, onClick: () => void) {
  return (
    <Button variant="secondary" size="sm" fullWidth onClick={onClick}>
      {label}
    </Button>
  );
}

const goApex = (tab?: string) => () => {
  window.location.hash = tab ? `#/apex/${tab}` : '#/apex';
};

/** Empty state shared by the Apex widgets. */
function emptyWidget(
  size: WidgetSize,
  icon: string,
  kicker: string,
  title: string,
  sub: string,
  onClick: () => void,
  actionLabel?: string,
) {
  return (
    <WidgetEmpty
      size={size}
      tone="apex"
      icon={icon}
      kicker={kicker}
      title={title}
      sub={sub}
      action={actionLabel}
      actionIcon="caret-right"
      onAction={onClick}
    />
  );
}

/** Consistency streak (rest and illness days keep it). */
const streak: WidgetDef = {
  id: 'streak',
  group: 'apex',
  icon: 'flame',
  tone: 'apex',
  name: (tw) => tw.streak,
  render: (size, { store, now, tw }) => {
    const n = consistencyStreak(now);
    const trained = new Set(
      store.workouts.filter((w) => w.finishedAt !== null).map((w) => dayKey(w.startedAt)),
    );
    const last7 = Array.from({ length: 7 }, (_, i) => trained.has(dayKey(now - (6 - i) * DAY)));
    const openApex = () => {
      window.location.hash = '#/apex';
    };
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="apex"
          icon="flame"
          title={tw.dayStreak(n)}
          sub={tw.keepToday}
          onClick={openApex}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="apex"
          kicker={tw.streak}
          value={n}
          unit={tw.days}
          sub={tw.keepToday}
          onClick={openApex}
        />
      );
    const dots = <WidgetDots values={last7} height={size === 'XL' ? 36 : 10} tone="apex" />;
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="apex"
          kicker={tw.streak}
          value={n}
          unit={tw.days}
          sub={tw.keepToday}
          bodyLast
          onClick={openApex}
        >
          {dots}
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="apex"
        kicker={tw.streak}
        onClick={openApex}
        footer={
          <Button variant="secondary" size="sm" fullWidth onClick={openApex}>
            {tw.openApex}
          </Button>
        }
      >
        <div className="ul-grid uf-1" style={{ placeItems: 'center' }}>
          <WidgetRing value={Math.min(1, n / 30)} size={130} tone="apex">
            {n}
            <small>{tw.days}</small>
          </WidgetRing>
        </div>
        {dots}
      </Widget>
    );
  },
};

/* ---------- Challenge: the active Apex challenge ---------- */

function ChallengeWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, now, t, locale } = ctx;
  const s = axs(locale);
  const list = useChallenges();
  const cctx = useMemo(
    () => challengeCtx(store, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.workouts, store.activities, store.bodyMetrics, store.restPeriods, now],
  );
  const running = useMemo(
    () =>
      list.flatMap((ac) => {
        if (ac.status !== 'active') return [];
        const tmpl = templateById(ac.templateId);
        return tmpl ? [{ ac, tmpl }] : [];
      }),
    [list],
  );
  const first = running[0];
  const prog = useMemo(
    () => (first ? challengeProgress(first.ac, first.tmpl, cctx) : null),
    [first, cctx],
  );
  const open = goApex('challenges');
  if (!first || !prog)
    return emptyWidget(
      size,
      'flag-banner',
      s.challenge,
      t.apexNoActive,
      t.apexStartOne,
      open,
      s.browseChallenges,
    );
  const { tmpl, ac } = first;
  const title = tmpl.title(t, prog.target);
  const val = fmtChallengeValue(tmpl.unit, prog.value, t);
  const target = fmtChallengeValue(tmpl.unit, prog.target, t);
  const unitLabel = t.chUnit[tmpl.unit] ?? tmpl.unit;
  const p = pct(prog.pct);
  const perDay = prog.perDayNeeded;
  const counts = `${val} / ${target} ${unitLabel} · ${t.chDaysLeft(prog.daysLeft)}`;
  const status = prog.done
    ? s.targetReached
    : prog.ended
      ? s.timeUp
      : s.pace(`${perDay >= 10 ? Math.round(perDay) : Math.round(perDay * 10) / 10} ${unitLabel}`);
  const more = running.length > 1 ? s.moreActive(running.length - 1) : null;

  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="apex"
        icon={tmpl.icon}
        title={title}
        sub={counts}
        trailing={<span className="uiw-sub">{p}%</span>}
        onClick={open}
      />
    );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="apex"
        kicker={s.challenge}
        badge={`${p}%`}
        value={val}
        unit={s.ofN(target)}
        sub={title}
        bodyLast
        onClick={open}
      >
        <WidgetBar value={prog.pct} tone="apex" />
      </Widget>
    );
  if (size === 'L')
    return (
      <Widget size="L" tone="apex" kicker={s.challenge} badge={more} onClick={open}>
        <div className="ul-flex ug-16 ua-center uf-1">
          <WidgetRing value={prog.pct} size={88} tone="apex">
            {p}%
          </WidgetRing>
          <div className="ul-flex ul-col ug-4 umw-0">
            <div className="uiw-name">{title}</div>
            <div className="uiw-sub">{counts}</div>
            <div className="uiw-sub">{status}</div>
          </div>
        </div>
      </Widget>
    );
  const days = prog.byDay.map((d) => d.state !== 'future' && d.intensity > 0);
  return (
    <Widget
      size="XL"
      tone="apex"
      kicker={s.challenge}
      badge={s.endsOn(fmtDayMonth(ac.endsAt, locale))}
      onClick={open}
      footer={action(s.open, open)}
    >
      <div className="ul-flex ug-16 ua-center">
        <WidgetRing value={prog.pct} size={96} tone="apex">
          {val}
          <small>{s.ofN(target)}</small>
        </WidgetRing>
        <div className="ul-flex ul-col ug-4 umw-0">
          <div className="uiw-name">{title}</div>
          <div className="uiw-sub">{tmpl.blurb(t)}</div>
          <div className="uiw-sub">{t.chDaysLeft(prog.daysLeft)}</div>
        </div>
      </div>
      <WidgetDots values={days} height={14} tone="apex" />
      <WidgetList rows={[{ label: status, value: `${p}%` }, ...(more ? [{ label: more }] : [])]} />
    </Widget>
  );
}

const challenge: WidgetDef = {
  id: 'apex-challenge',
  group: 'apex',
  icon: 'flag-banner',
  tone: 'apex',
  name: () => axs(getLocale()).nChallenge,
  render: (size, ctx) => <ChallengeWidget size={size} ctx={ctx} />,
};

/* ---------- Rank & mastery: the closest strength rank (Mastery as fallback) ---------- */

const rank: WidgetDef = {
  id: 'apex-rank',
  group: 'apex',
  icon: 'trophy',
  tone: 'apex',
  name: () => axs(getLocale()).nRank,
  render: (size, { store, now, t, locale }) => {
    const s = axs(locale);
    const open = goApex('ranks');
    const st = standardsOf(store);
    const { m } = masteryOf(store, now);
    const masteryTxt = m.sessions > 0 ? s.masteryN(m.rating) : null;
    if (st.missing) {
      const sub = st.missing === 'body' ? s.needBody : s.needLift;
      if (m.sessions === 0)
        return emptyWidget(size, 'trophy', s.ranks, s.noRanks, sub, open, s.openRanks);
      // Fall back to the Mastery rank.
      const label = rankLabel(t, m.rankIndex, m.sublevel);
      if (size === 'M')
        return (
          <Widget
            size="M"
            tone="apex"
            icon="trophy"
            title={`${label} · ${s.mastery}`}
            sub={sub}
            onClick={open}
          />
        );
      return (
        <Widget
          size={size}
          tone="apex"
          kicker={s.mastery}
          badge={size === 'S' ? undefined : masteryTxt}
          value={size === 'S' ? m.rating : undefined}
          title={label}
          sub={sub}
          bodyLast
          onClick={open}
          footer={size === 'XL' ? action(s.openRanks, open) : undefined}
        >
          {size !== 'S' && (
            <WidgetDots values={ladderPips(m)} height={size === 'XL' ? 20 : 10} tone="apex" />
          )}
        </Widget>
      );
    }
    const c = st.closest ?? st.trained.slice().sort((a, b) => b.best - a.best)[0];
    const cur = tierName(t, c, c.achievedIdx) || s.unranked;
    const next = c.nextIdx != null ? tierName(t, c, c.nextIdx) : null;
    const toGo = Math.round(c.toGo ?? 0);
    const bw = st.bodyKg > 0 ? (c.best / st.bodyKg).toFixed(2) : null;
    const toNext = next ? s.kgTo(toGo, next) : s.topTier;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="apex"
          icon="trophy"
          title={`${cur} · ${c.name}`}
          sub={toNext}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="apex"
          kicker={c.name}
          title={cur}
          sub={toNext}
          bodyLast
          onClick={open}
        >
          <WidgetBar value={next ? c.progress : 1} tone="apex" />
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="apex"
          kicker={s.closestRank(c.name)}
          badge={bw ? s.xBw(bw) : undefined}
          title={cur}
          onClick={open}
          bodyLast
        >
          {progressLine(
            next ? s.toTier(next) : s.topTier,
            next ? `${toGo} kg` : '',
            next ? c.progress : 1,
          )}
        </Widget>
      );
    const rows = st.trained
      .slice()
      .sort((a, b) => b.best - a.best)
      .slice(0, 4)
      .map((r) => ({ label: r.name, value: tierName(t, r, r.achievedIdx) || s.unranked }));
    return (
      <Widget
        size="XL"
        tone="apex"
        kicker={s.ranks}
        badge={masteryTxt}
        onClick={open}
        footer={action(s.openRanks, open)}
      >
        <WidgetList rows={rows} />
        {progressLine(
          next ? s.closestLine(c.name, next) : s.topTier,
          next ? `${toGo} kg` : '',
          next ? c.progress : 1,
        )}
      </Widget>
    );
  },
};

/* ---------- Awards: latest unlocked feat + the nearest one ---------- */

const awards: WidgetDef = {
  id: 'apex-awards',
  group: 'apex',
  icon: 'medal',
  tone: 'apex',
  name: () => axs(getLocale()).nAwards,
  render: (size, { store, locale }) => {
    const s = axs(locale);
    const open = goApex('awards');
    const res = featsOf(store);
    const got = unlockedFeats(res);
    const next = res.nextUp;
    if (got.length === 0)
      return emptyWidget(size, 'medal', s.awards, s.noAwards, s.noAwardsSub, open, s.allAwards);
    const last = got[0];
    const lastTitle = `${last.emoji} ${last.title}`;
    const when = s.unlockedOn(fmtDayMonth(last.unlockAt ?? 0, locale));
    const nextBar = next
      ? progressLine(
          s.nextLine(featTitle(next)),
          `${fmtAchValue(next.unit, next.value)} / ${fmtAchValue(next.unit, next.threshold)}`,
          next.progress,
        )
      : null;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="apex"
          icon="medal"
          title={lastTitle}
          sub={`${featLabel(last.group)} · ${when}`}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="apex"
          kicker={s.awards}
          badge={res.unlockedCount}
          title={lastTitle}
          sub={when}
          onClick={open}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="apex"
          kicker={s.awards}
          badge={s.unlockedOf(res.unlockedCount, res.total)}
          title={lastTitle}
          sub={when}
          bodyLast
          onClick={open}
        >
          {nextBar}
        </Widget>
      );
    const rows = got.slice(0, 4).map((a) => ({
      label: `${a.emoji} ${a.title}`,
      value: fmtDayMonth(a.unlockAt ?? 0, locale),
    }));
    rows.push({ label: s.lockedMore(res.total - res.unlockedCount), value: '' });
    return (
      <Widget
        size="XL"
        tone="apex"
        kicker={s.awards}
        badge={s.unlockedOf(res.unlockedCount, res.total)}
        onClick={open}
        footer={action(s.allAwards, open)}
      >
        <WidgetList rows={rows} />
        {nextBar}
      </Widget>
    );
  },
};

/* ---------- Apex feed: the latest milestones ---------- */

const FEED_ICON: Record<string, string> = {
  standard: 'trophy',
  pr: 'barbell',
  feat: 'medal',
  trend: 'chart-line-up',
  streak: 'fire',
  volume: 'check-circle',
  challenge: 'flag-banner',
  atlas: 'sparkle',
};

function FeedWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { now, t, locale } = ctx;
  const s = axs(locale);
  const { notifs, state } = useNotifs();
  const unread = unreadCount(state, notifs);
  const open = goApex('feed');
  if (notifs.length === 0)
    return emptyWidget(size, 'bell', s.feed, s.noFeed, s.noFeedSub, open, t.apexSeeAll);
  const latest = notifs[0];
  const kicker = unread > 0 ? s.feedNew(unread) : s.feed;
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="apex"
        icon="bell"
        title={unread > 0 ? s.newInApex(unread) : s.caughtUp}
        sub={latest.title}
        onClick={open}
      />
    );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="apex"
        kicker={s.feed}
        value={unread}
        unit={s.newWord}
        sub={latest.title}
        onClick={open}
      />
    );
  const rows = notifs.slice(0, size === 'L' ? 3 : 5).map((n) => ({
    label: n.title,
    value: notifTime(n.ts, now, t, locale),
    icon: size === 'XL' ? (FEED_ICON[n.kind] ?? 'star') : undefined,
  }));
  if (size === 'L')
    return (
      <Widget size="L" tone="apex" kicker={kicker} onClick={open}>
        <WidgetList rows={rows} />
      </Widget>
    );
  return (
    <Widget
      size="XL"
      tone="apex"
      kicker={kicker}
      onClick={open}
      footer={action(t.apexSeeAll, open)}
    >
      <WidgetList rows={rows} />
    </Widget>
  );
}

const feed: WidgetDef = {
  id: 'apex-feed',
  group: 'apex',
  icon: 'bell',
  tone: 'apex',
  name: () => axs(getLocale()).nFeed,
  render: (size, ctx) => <FeedWidget size={size} ctx={ctx} />,
};

/* ---------- Mastery: the 0–1000 rating and its ladder ---------- */

function masteryEmpty(
  size: WidgetSize,
  s: ApexStrings,
  icon: string,
  kicker: string,
  open: () => void,
) {
  return emptyWidget(size, icon, kicker, s.masteryEmpty, s.masteryEmptySub, open, s.openMastery);
}

function weekBadge(s: ApexStrings, d: number | null): ReactNode {
  if (d == null || d === 0) return undefined;
  return <WidgetDelta good={d > 0}>{s.weekDelta(signed(d, 0))}</WidgetDelta>;
}

const mastery: WidgetDef = {
  id: 'apex-mastery',
  group: 'apex',
  icon: 'shield-check',
  tone: 'apex',
  name: () => axs(getLocale()).nMastery,
  render: (size, { store, now, t, locale, shell }) => {
    const s = axs(locale);
    const open = () => shell.openOverlay({ screen: 'mastery' });
    const { m, weekDelta } = masteryOf(store, now);
    if (m.sessions === 0) return masteryEmpty(size, s, 'shield-check', s.mastery, open);
    const label = rankLabel(t, m.rankIndex, m.sublevel);
    const step = nextStep(t, m);
    const toStep = step ? s.ptsTo(step.at - m.rating, step.label) : s.topLevel;
    const sub = m.calibrating ? s.calibrating(m.sessionsToFirm) : toStep;
    const frac = m.rating / 1000;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="apex"
          icon="shield-check"
          title={s.masteryLine(m.rating, label)}
          sub={sub}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="apex"
          kicker={s.mastery}
          value={m.rating}
          unit={s.of1000}
          sub={label}
          bodyLast
          onClick={open}
        >
          <WidgetBar value={frac} tone="apex" />
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="apex"
          kicker={s.mastery}
          badge={m.calibrating ? t.masteryProvisional : weekBadge(s, weekDelta)}
          onClick={open}
        >
          <div className="ul-flex ug-16 ua-center uf-1">
            <WidgetRing value={m.rankProgress} size={88} tone="apex">
              {m.rating}
              <small>{s.ofThousand}</small>
            </WidgetRing>
            <div className="ul-flex ul-col ug-6 umw-0 uf-1">
              <div className="uiw-name">{label}</div>
              <WidgetDots values={ladderPips(m)} height={8} tone="apex" />
              <div className="uiw-sub">
                {s.rankOf(m.rankIndex + 1, MASTERY_RANKS.length)} · {sub}
              </div>
            </div>
          </div>
        </Widget>
      );
    const axes: AxisKey[] = ['strength', 'consistency', 'experience', 'practice'];
    const rows = axes.map((k) => ({
      label: t.masteryAxis[k] ?? k,
      value: String(Math.round(AXIS_WEIGHT[k] * m.axes[k].score * 10)),
    }));
    return (
      <Widget
        size="XL"
        tone="apex"
        kicker={s.mastery}
        badge={m.calibrating ? t.masteryProvisional : weekBadge(s, weekDelta)}
        onClick={open}
        footer={action(s.openMastery, open)}
      >
        <div className="ul-flex ug-16 ua-center">
          <WidgetRing value={m.rankProgress} size={84} tone="apex">
            {m.rating}
          </WidgetRing>
          <div className="ul-flex ul-col ug-4 umw-0">
            <div className="uiw-name">{label}</div>
            <div className="uiw-sub">{sub}</div>
          </div>
        </div>
        <WidgetDots values={ladderPips(m)} height={12} tone="apex" />
        <span className="uiw-kicker">{s.whatMoves}</span>
        <WidgetList rows={rows} />
      </Widget>
    );
  },
};

/* ---------- Level-up countdown: points to the next sublevel ---------- */

const levelUp: WidgetDef = {
  id: 'apex-level-up',
  group: 'apex',
  icon: 'arrow-fat-up',
  tone: 'apex',
  name: () => axs(getLocale()).nLevelUp,
  render: (size, { store, now, t, locale, shell }) => {
    const s = axs(locale);
    const open = () => shell.openOverlay({ screen: 'mastery' });
    const { m, weekDelta, sessions7 } = masteryOf(store, now);
    if (m.sessions === 0) return masteryEmpty(size, s, 'arrow-fat-up', s.levelUp, open);
    const cur = rankLabel(t, m.rankIndex, m.sublevel);
    const step = nextStep(t, m);
    if (!step)
      return emptyWidget(
        size,
        'arrow-fat-up',
        s.levelUp,
        s.topLevel,
        s.masteryLine(m.rating, cur),
        open,
        s.openMastery,
      );
    const left = Math.max(0, step.at - m.rating);
    const perWorkout =
      weekDelta != null && weekDelta > 0 && sessions7 > 0 ? weekDelta / sessions7 : 0;
    const workouts = perWorkout > 0 ? Math.max(1, Math.ceil(left / perWorkout)) : null;
    const pace = m.calibrating
      ? s.calibrating(m.sessionsToFirm)
      : workouts != null
        ? s.workoutsAway(workouts)
        : s.noPace;
    const frac = sublevelFrac(m);
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="apex"
          icon="arrow-fat-up"
          title={s.ptsTo(left, step.label)}
          sub={pace}
          trailing={<span className="uiw-sub">{`${m.rating} → ${step.at}`}</span>}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="apex"
          kicker={s.levelUp}
          value={left}
          unit={s.pts}
          sub={s.toLabel(step.label)}
          bodyLast
          onClick={open}
        >
          <WidgetBar value={frac} tone="apex" />
        </Widget>
      );
    const scale = (
      <div className="ul-flex ul-col ug-6">
        <WidgetBar value={frac} tone="apex" />
        <div className="ul-flex uj-between ug-8">
          <span className="uiw-sub">{cur}</span>
          <span className="uiw-sub">{m.rating}</span>
          <span className="uiw-sub">{`${step.at} · ${step.label}`}</span>
        </div>
      </div>
    );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="apex"
          kicker={s.levelUpTo(step.label)}
          badge={workouts != null && !m.calibrating ? s.workoutsShort(workouts) : undefined}
          value={left}
          unit={s.ptsToGo}
          bodyLast
          onClick={open}
        >
          {scale}
        </Widget>
      );
    const rows = m.shortfalls.slice(0, 4).map((f) => ({
      label: t.masteryFix[f.signal ?? f.axis] ?? t.masteryFix[f.key] ?? f.key,
      value: t.masteryImpact[f.impact] ?? f.impact,
    }));
    return (
      <Widget
        size="XL"
        tone="apex"
        kicker={s.levelUp}
        badge={weekBadge(s, weekDelta)}
        onClick={open}
        footer={action(s.startWorkout, () => shell.openStart())}
      >
        <div className="ul-flex ug-16 ua-center">
          <WidgetRing value={frac} size={84} tone="apex">
            {left}
            <small>{s.pts}</small>
          </WidgetRing>
          <div className="ul-flex ul-col ug-4 umw-0">
            <div className="uiw-name">{s.atRating(step.label, step.at)}</div>
            <div className="uiw-sub">{pace}</div>
            <div className="uiw-sub">{`${cur} · ${s.rankOf(m.rankIndex + 1, MASTERY_RANKS.length)}`}</div>
          </div>
        </div>
        {rows.length > 0 && (
          <>
            <span className="uiw-kicker">{s.fastest}</span>
            <WidgetList rows={rows} />
          </>
        )}
      </Widget>
    );
  },
};

/* ---------- Next feat: the feat closest to unlocking ---------- */

const nextFeat: WidgetDef = {
  id: 'apex-next-feat',
  group: 'apex',
  icon: 'target',
  tone: 'apex',
  name: () => axs(getLocale()).nNextFeat,
  render: (size, { store, locale }) => {
    const s = axs(locale);
    const open = goApex('awards');
    const res = featsOf(store);
    const sessions = store.workouts.filter((w) => w.finishedAt !== null).length;
    const near = nearestFeats(res, 4);
    const a = near[0];
    if (sessions === 0 || !a)
      return emptyWidget(
        size,
        'target',
        s.nextFeat,
        sessions === 0 ? s.featsEmpty : s.allUnlocked,
        s.axesTiers(CATEGORIES.length, res.unlockedCount, res.total),
        open,
        s.allFeats,
      );
    const valTxt = fmtAchValue(a.unit, a.value);
    const tgtTxt = fmtAchValue(a.unit, a.threshold);
    const leftTxt = fmtAchValue(a.unit, Math.max(0, a.threshold - a.value));
    const away = sessionsAway(a, sessions);
    const title = featTitle(a);
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="apex"
          icon="target"
          title={`${title} · ${s.left(leftTxt)}`}
          sub={`${valTxt} / ${tgtTxt}`}
          trailing={<span className="uiw-sub">{pct(a.progress)}%</span>}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="apex"
          kicker={s.nextFeat}
          value={valTxt}
          unit={`/ ${tgtTxt}`}
          sub={title}
          bodyLast
          onClick={open}
        >
          <WidgetBar value={a.progress} tone="apex" />
        </Widget>
      );
    const then = near[1];
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="apex"
          kicker={s.nextFeat}
          badge={away != null ? s.sessionsAway(away) : `${pct(a.progress)}%`}
          title={title}
          sub={`${valTxt} / ${tgtTxt}`}
          bodyLast
          onClick={open}
        >
          <WidgetBar value={a.progress} tone="apex" />
          {then && (
            <div className="ul-flex uj-between ug-8">
              <span className="uiw-sub">{s.then(featTitle(then))}</span>
              <span className="uiw-sub">{`${fmtAchValue(then.unit, then.value)} / ${fmtAchValue(then.unit, then.threshold)}`}</span>
            </div>
          )}
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="apex"
        kicker={s.nextFeat}
        badge={away != null ? s.sessionsAway(away) : undefined}
        onClick={open}
        footer={action(s.allFeats, open)}
      >
        <div className="ul-flex ul-col ug-4">
          <div className="uiw-name">{`${a.emoji} ${title}`}</div>
          <div className="uiw-value">
            {valTxt}
            <span className="uiw-unit">{`/ ${tgtTxt}`}</span>
          </div>
        </div>
        {progressLine(s.left(leftTxt), `${pct(a.progress)}%`, a.progress)}
        <span className="uiw-kicker">{s.upNext}</span>
        {near.slice(1, 4).map((x) => (
          <div key={x.key}>
            {progressLine(
              featTitle(x),
              `${fmtAchValue(x.unit, x.value)} / ${fmtAchValue(x.unit, x.threshold)}`,
              x.progress,
            )}
          </div>
        ))}
        <span className="uiw-sub">
          {s.axesTiers(CATEGORIES.length, res.unlockedCount, res.total)}
        </span>
      </Widget>
    );
  },
};

/* ---------- Feats board: every axis and how far up its ladder you are ---------- */

const featsBoard: WidgetDef = {
  id: 'apex-feats-board',
  group: 'apex',
  icon: 'squares-four',
  tone: 'apex',
  name: () => axs(getLocale()).nFeatsBoard,
  render: (size, { store, locale }) => {
    const s = axs(locale);
    const open = goApex('awards');
    const res = featsOf(store);
    const axes = CATEGORIES.map((c) => {
      const list = res.byGroup[c.group];
      const got = list.filter((a) => a.unlocked).length;
      return { group: c.group, got, total: list.length };
    });
    const started = axes.filter((x) => x.got > 0).length;
    const near = nearestFeats(res, 1)[0];
    const closest = near ? s.closestFeat(featTitle(near), pct(near.progress)) : s.allUnlocked;
    const frac = res.total > 0 ? res.unlockedCount / res.total : 0;
    if (res.unlockedCount === 0)
      return emptyWidget(
        size,
        'squares-four',
        s.featsBoard,
        s.featsEmpty,
        s.axesTiers(CATEGORIES.length, 0, res.total),
        open,
        s.allFeats,
      );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="apex"
          icon="squares-four"
          title={s.featsLine(res.unlockedCount, res.total)}
          sub={s.axesStarted(started, axes.length)}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="apex"
          kicker={s.feats}
          value={res.unlockedCount}
          unit={`/ ${res.total}`}
          sub={s.axesStarted(started, axes.length)}
          bodyLast
          onClick={open}
        >
          <WidgetBar value={frac} tone="apex" />
        </Widget>
      );
    // Share of each axis' ladder climbed; highlighted = at least one tier.
    const values = axes.map((x) => (x.total ? x.got / x.total : 0));
    const on = axes.flatMap((x, i) => (x.got > 0 ? [i] : []));
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="apex"
          kicker={s.featsBoard}
          badge={s.tiersOf(res.unlockedCount, res.total)}
          sub={closest}
          bodyLast
          onClick={open}
        >
          <WidgetBars values={values} highlight={on} height={56} tone="apex" />
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="apex"
        kicker={s.featsBoard}
        badge={s.tiersOf(res.unlockedCount, res.total)}
        onClick={open}
        footer={action(s.allFeats, open)}
      >
        <div
          className="ul-grid"
          style={{ gridTemplateColumns: '1fr 1fr', columnGap: 16, rowGap: 6 }}
        >
          {axes.map((x) => (
            <div key={x.group} className="ul-flex ul-col ug-2 umw-0">
              <div className="ul-flex uj-between ug-6">
                <span className="uiw-sub">{featLabel(x.group)}</span>
                <span className="uiw-sub">{x.got}</span>
              </div>
              <WidgetBar value={x.total ? x.got / x.total : 0} height={3} tone="apex" />
            </div>
          ))}
        </div>
        <span className="uiw-sub">{closest}</span>
      </Widget>
    );
  },
};

/* ---------- Year in feats: this year's unlocks by month ---------- */

const yearFeats: WidgetDef = {
  id: 'apex-year-feats',
  group: 'apex',
  icon: 'calendar-check',
  tone: 'apex',
  name: () => axs(getLocale()).nYearFeats,
  render: (size, { store, now, locale }) => {
    const s = axs(locale);
    const open = goApex('awards');
    const res = featsOf(store);
    const year = new Date(now).getFullYear();
    const all = unlockedFeats(res);
    const inYear = (y: number) => all.filter((a) => new Date(a.unlockAt ?? 0).getFullYear() === y);
    const cur = inYear(year);
    const prev = inYear(year - 1).length;
    const months = Array.from({ length: 12 }, () => 0);
    for (const a of cur) months[new Date(a.unlockAt ?? 0).getMonth()] += 1;
    const thisMonth = new Date(now).getMonth();
    const vs = s.vsLast(prev, year - 1);
    if (cur.length === 0)
      return emptyWidget(
        size,
        'calendar-check',
        s.yearK(year),
        s.noYear(year),
        vs,
        open,
        s.allFeats,
      );
    const latest = s.latest(cur[0].title, fmtDayMonth(cur[0].unlockAt ?? 0, locale));
    const diff = cur.length - prev;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="apex"
          icon="calendar-check"
          title={s.unlockedIn(cur.length, year)}
          sub={latest}
          trailing={
            prev > 0 ? <WidgetDelta good={diff >= 0}>{signed(diff, 0)}</WidgetDelta> : undefined
          }
          onClick={open}
        />
      );
    const fmtM = new Intl.DateTimeFormat(locale, { month: 'narrow' });
    const labels = months.map((_, i) => fmtM.format(new Date(year, i, 1)));
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="apex"
          kicker={s.yearK(year)}
          value={cur.length}
          unit={s.unlocks}
          sub={vs}
          bodyLast
          onClick={open}
        >
          <WidgetBars
            values={months.slice(0, thisMonth + 1)}
            highlight={[thisMonth]}
            height={22}
            tone="apex"
          />
        </Widget>
      );
    const bars = (h: number) => (
      <WidgetBars values={months} highlight={[thisMonth]} labels={labels} height={h} tone="apex" />
    );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="apex"
          kicker={s.yearInK(year)}
          badge={vs}
          value={cur.length}
          unit={s.unlocks}
          bodyLast
          onClick={open}
        >
          {bars(40)}
        </Widget>
      );
    const rows = cur.slice(0, 4).map((a) => ({
      label: `${a.emoji} ${a.title} · ${featLabel(a.group)}`,
      value: fmtDayMonth(a.unlockAt ?? 0, locale),
    }));
    return (
      <Widget
        size="XL"
        tone="apex"
        kicker={s.yearInK(year)}
        badge={vs}
        value={cur.length}
        unit={s.unlocks}
        bodyLast
        onClick={open}
        footer={action(s.allFeats, open)}
      >
        {bars(64)}
        <WidgetList rows={rows} />
      </Widget>
    );
  },
};

export const APEX_WIDGETS: WidgetDef[] = [
  streak,
  challenge,
  rank,
  awards,
  feed,
  mastery,
  levelUp,
  nextFeat,
  featsBoard,
  yearFeats,
];
