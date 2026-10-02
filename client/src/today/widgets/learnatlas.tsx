/**
 * Learn & Atlas widgets (design boards L3 "Apex · Learn · Atlas" — the Learn
 * and Atlas rows — and L10 "Learn & Atlas+").
 *
 * Learn reads the real catalog (learn/catalog.ts, localised) plus the Learn
 * app's own on-device lists: saved lessons (`spotter.learn.saved`) and
 * completed lessons (`spotter.learn.completed`, the key the Today banner reads).
 * Atlas reads the coach's real feed (atlas/notes.ts → facts + voice), his
 * programme (atlas/useTodayPlan.ts), the guard (temper of the day) and the
 * on-device chat log. Nothing here calls the network or an LLM — "Ask Atlas"
 * is an entry point into the Atlas chat.
 */
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import {
  Widget,
  WidgetBar,
  WidgetBars,
  WidgetList,
  WidgetRing,
  WidgetStats,
  type WidgetSize,
  WidgetEmpty,
} from '../../components/ui/Widget';
import { Button } from '../../components/ui/Button';
import { Chip, ChipGroup } from '../../components/ui/Chip';
import { IconTile } from '../../components/ui/IconTile';
import type { Tone } from '../../components/ui/tones';
import {
  fmtDayMonth,
  fmtSet,
  fmtTonnes,
  fmtWeekdayDayMonth,
  fmtWeekdayShort,
  getLocale,
} from '../../i18n';
import { getRole } from '../../api';
import { consistencyStreak, dayKey, setCoach, workoutVolumeKg } from '../../store';
import type { Workout } from '../../types';
import { muscleReadiness } from '../../recovery';
import { weekStartOf } from '../../weekStart';
import { fmtCountdown } from '../../restTimer';
import { localizedExerciseName } from '../../data/exerciseNames';
import { catalogForRole, isReady, type Lesson, type Topic } from '../../learn/catalog';
import { localizeTopics } from '../../learn/catalog.i18n';
import { buildNotes, useAtlasFmt, type AtlasNote } from '../../atlas/notes';
import { sessionFacts, usualSessionsPerWeek } from '../../atlas/facts';
import { softenReason } from '../../atlas/guard';
import { temperIndex, type CoachFact, type Temper } from '../../atlas/types';
import { useTodayPlan } from '../../atlas/useTodayPlan';
import { useChatLog, type ChatMsg } from '../../atlas/chatLog';
import type { Fmt } from '../../atlas/voice';
import type { WidgetCtx, WidgetDef } from '../registry';
import { DAY, pct, signed } from './format';
import { las, type LearnAtlasStrings } from './learnatlas.strings';

type S = LearnAtlasStrings;

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

const openLearn = () => {
  window.location.hash = '#/learn';
};
const openCoach = (ctx: WidgetCtx) => () => ctx.shell.openOverlay({ screen: 'coach' });

/** Local day number — the daily lesson and fact change at local midnight. */
function dayIndex(now: number): number {
  return Math.floor((now - new Date(now).getTimezoneOffset() * 60_000) / DAY);
}

/** Multi-line text inside a widget body (the kit's sub/name type, wrapping, clamped). */
function Para({
  children,
  lines = 3,
  strong = false,
}: {
  children: ReactNode;
  lines?: number;
  strong?: boolean;
}) {
  const style: CSSProperties = {
    whiteSpace: 'normal',
    display: '-webkit-box',
    WebkitLineClamp: lines,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    margin: 0,
  };
  return (
    <div className={strong ? 'uiw-name' : 'uiw-sub'} style={style}>
      {children}
    </div>
  );
}

/** Relative time: "now" · "12 min" · "5 h" · "2 d". */
function ago(s: S, at: number, now: number): string {
  const min = Math.max(0, Math.round((now - at) / 60_000));
  if (min < 1) return s.justNow;
  if (min < 60) return s.agoM(min);
  if (min < 24 * 60) return s.agoH(Math.round(min / 60));
  return s.agoD(Math.round(min / (24 * 60)));
}

/** Empty state for every size — the kit's WidgetEmpty. */
function Empty({
  size,
  tone,
  icon,
  kicker,
  title,
  sub,
  action,
  onClick,
}: {
  size: WidgetSize;
  tone: Tone;
  icon: string;
  kicker: string;
  title: string;
  sub: string;
  action?: string;
  onClick: () => void;
}) {
  return (
    <WidgetEmpty
      size={size}
      tone={tone}
      icon={icon}
      kicker={kicker}
      title={title}
      sub={sub}
      action={action}
      actionIcon="caret-right"
      onAction={onClick}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Learn                                                               */
/* ------------------------------------------------------------------ */

function readIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

interface TopicProgress {
  topic: Topic;
  done: number;
  total: number;
}

interface LearnState {
  topics: TopicProgress[];
  lessons: Lesson[];
  topicTitle: Map<string, string>;
  done: Set<string>;
  saved: Lesson[];
  doneCount: number;
  total: number;
  next: Lesson | null;
}

/** The role-visible, localised catalog and the viewer's progress on it. */
function learnState(ctx: WidgetCtx): LearnState {
  const topics = localizeTopics(catalogForRole(getRole()), ctx.locale);
  const lessons = topics.flatMap((t) => t.lessons);
  const ids = new Set(lessons.map((l) => l.id));
  const done = new Set(readIds('spotter.learn.completed').filter((id) => ids.has(id)));
  const byId = new Map(lessons.map((l) => [l.id, l]));
  const saved = readIds('spotter.learn.saved')
    .map((id) => byId.get(id))
    .filter((l): l is Lesson => !!l);
  return {
    topics: topics.map((topic) => ({
      topic,
      done: topic.lessons.filter((l) => done.has(l.id)).length,
      total: topic.lessons.length,
    })),
    lessons,
    topicTitle: new Map(topics.map((t) => [t.id, t.title])),
    done,
    saved,
    doneCount: done.size,
    total: lessons.length,
    next: lessons.find((l) => !done.has(l.id)) ?? null,
  };
}

/** "Logging · new" / "Logging · video soon" / "Logging · Watched". */
function lessonMeta(s: S, st: LearnState, l: Lesson): string {
  const state = st.done.has(l.id) ? s.watched : isReady(l) ? s.fresh : s.soon;
  return `${st.topicTitle.get(l.topic) ?? l.topic} · ${state}`;
}

/** The topic you're in the middle of (some watched, not all) — else the first unfinished. */
function currentTopic(st: LearnState): TopicProgress | null {
  return (
    st.topics.find((t) => t.done > 0 && t.done < t.total) ??
    st.topics.find((t) => t.done < t.total) ??
    null
  );
}

/** Learn — next lesson + library progress (L3, replaces the Learn banner). */
const learnNext: WidgetDef = {
  id: 'learn-next',
  group: 'learn',
  icon: 'graduation-cap',
  tone: 'learn',
  name: () => las(getLocale()).names.learnNext,
  render: (size, ctx) => {
    const s = las(ctx.locale);
    const st = learnState(ctx);
    const frac = st.total ? st.doneCount / st.total : 0;
    const next = st.next;
    if (!next)
      return (
        <Empty
          size={size}
          tone="learn"
          icon="graduation-cap"
          kicker={s.learn}
          title={s.allWatched}
          sub={s.allWatchedSub}
          action={s.openLearn}
          onClick={openLearn}
        />
      );
    const topic = st.topicTitle.get(next.topic) ?? next.topic;
    const progress = `${st.doneCount} / ${st.total}`;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="learn"
          icon="graduation-cap"
          title={next.title}
          sub={`${topic} · ${s.watchedOf(st.doneCount, st.total)}`}
          onClick={openLearn}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="learn"
          kicker={s.learn}
          value={st.doneCount}
          unit={`/ ${st.total}`}
          sub={s.lessonsWatched}
          bodyLast
          onClick={openLearn}
        >
          <WidgetBar value={frac} tone="learn" />
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="learn"
          kicker={st.doneCount ? s.continueL : s.startLearning}
          badge={progress}
          title={next.title}
          sub={lessonMeta(s, st, next)}
          bodyLast
          onClick={openLearn}
        >
          <WidgetBar value={frac} tone="learn" />
        </Widget>
      );
    const after = st.lessons.filter((l) => !st.done.has(l.id) && l.id !== next.id).slice(0, 3);
    return (
      <Widget
        size="XL"
        tone="learn"
        kicker={s.learn}
        badge={progress}
        onClick={openLearn}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={openLearn}>
            {st.doneCount ? s.continueL : s.startLearning}
          </Button>
        }
      >
        <div className="ul-flex ug-12 ua-center">
          <IconTile tone="learn" size={56} icon="play-circle" />
          <div className="umw-0 uf-1">
            <Para strong lines={2}>
              {next.title}
            </Para>
            <div className="uiw-sub">{lessonMeta(s, st, next)}</div>
          </div>
        </div>
        <WidgetStats
          items={[
            { label: s.libraryProgress, value: progress },
            { label: s.lessonsWatched, value: `${pct(frac)}%` },
          ]}
        />
        {after.length > 0 && (
          <WidgetList
            rows={after.map((l) => ({
              icon: 'play',
              label: l.title,
              value: st.topicTitle.get(l.topic) ?? l.topic,
            }))}
          />
        )}
      </Widget>
    );
  },
};

/** Lesson of the day — an unwatched how-to from the topic you're in, new at midnight. */
const lessonOfDay: WidgetDef = {
  id: 'lesson-of-day',
  group: 'learn',
  icon: 'play-circle',
  tone: 'learn',
  name: () => las(getLocale()).names.lessonDay,
  render: (size, ctx) => {
    const s = las(ctx.locale);
    const st = learnState(ctx);
    if (!st.lessons.length)
      return (
        <Empty
          size={size}
          tone="learn"
          icon="play-circle"
          kicker={s.names.lessonDay}
          title={s.allWatched}
          sub={s.allWatchedSub}
          onClick={openLearn}
        />
      );
    const cur = currentTopic(st);
    const unwatched = st.lessons.filter((l) => !st.done.has(l.id));
    const inTopic = cur ? unwatched.filter((l) => l.topic === cur.topic.id) : [];
    const pool = inTopic.length ? inTopic : unwatched.length ? unwatched : st.lessons;
    const lesson = pool[dayIndex(ctx.now) % pool.length];
    const topic = st.topicTitle.get(lesson.topic) ?? lesson.topic;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="learn"
          icon="play-circle"
          title={lesson.title}
          sub={`${s.names.lessonDay} · ${topic}`}
          onClick={openLearn}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="learn"
          kicker={s.daily}
          title={lesson.title}
          sub={topic}
          onClick={openLearn}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="learn"
          kicker={s.names.lessonDay}
          badge={fmtWeekdayShort(ctx.now, ctx.locale)}
          title={lesson.title}
          sub={lessonMeta(s, st, lesson)}
          onClick={openLearn}
          footer={
            <Button variant="primary" size="sm" onClick={openLearn}>
              {s.watch}
            </Button>
          }
        />
      );
    const upNext = st.lessons
      .filter((l) => l.topic === lesson.topic && l.id !== lesson.id && !st.done.has(l.id))
      .slice(0, 2);
    return (
      <Widget
        size="XL"
        tone="learn"
        kicker={s.names.lessonDay}
        badge={fmtWeekdayDayMonth(ctx.now, ctx.locale)}
        onClick={openLearn}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={openLearn}>
            {s.watch}
          </Button>
        }
      >
        <div className="ul-flex ug-12 ua-center">
          <IconTile tone="learn" size={56} icon="play-circle" />
          <div className="umw-0 uf-1">
            <Para strong lines={2}>
              {lesson.title}
            </Para>
            <div className="uiw-sub">{lessonMeta(s, st, lesson)}</div>
          </div>
        </div>
        <Para lines={3}>{lesson.blurb}</Para>
        {upNext.length > 0 && (
          <>
            <div className="uiw-sub">{s.upNextIn(topic)}</div>
            <WidgetList
              rows={upNext.map((l) => ({
                icon: 'play',
                label: l.title,
                value: isReady(l) ? s.fresh : s.soon,
              }))}
            />
          </>
        )}
      </Widget>
    );
  },
};

/** Saved lessons — what you bookmarked in Learn to watch later. */
const savedLessons: WidgetDef = {
  id: 'learn-saved',
  group: 'learn',
  icon: 'bookmark-simple',
  tone: 'learn',
  name: () => las(getLocale()).names.saved,
  render: (size, ctx) => {
    const s = las(ctx.locale);
    const st = learnState(ctx);
    const saved = st.saved;
    if (!saved.length)
      return (
        <Empty
          size={size}
          tone="learn"
          icon="bookmark-simple"
          kicker={s.savedK}
          title={s.noSaved}
          sub={s.noSavedSub}
          action={s.openLearn}
          onClick={openLearn}
        />
      );
    const unwatched = saved.filter((l) => !st.done.has(l.id));
    const first = unwatched[0] ?? saved[0];
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="learn"
          icon="bookmark-simple"
          title={s.savedN(saved.length)}
          sub={s.next(first.title)}
          onClick={openLearn}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="learn"
          kicker={s.savedK}
          value={saved.length}
          unit={s.lessons}
          sub={s.unwatched(unwatched.length)}
          onClick={openLearn}
        />
      );
    const rows = (n: number) =>
      saved.slice(0, n).map((l) => {
        const seen = st.done.has(l.id);
        return {
          icon: seen ? 'check' : 'play',
          tone: (seen ? 'ok' : 'learn') as Tone,
          label: l.title,
          value: seen ? s.watched : (st.topicTitle.get(l.topic) ?? l.topic),
        };
      });
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="learn"
          kicker={s.savedN(saved.length)}
          badge={s.unwatched(unwatched.length)}
          onClick={openLearn}
        >
          <WidgetList rows={rows(3)} />
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="learn"
        kicker={s.savedN(saved.length)}
        badge={s.unwatched(unwatched.length)}
        onClick={openLearn}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={openLearn}>
            {s.playAll}
          </Button>
        }
      >
        <div className="ul-flex ug-12 ua-center">
          <IconTile tone="learn" size={56} icon="play-circle" />
          <div className="umw-0 uf-1">
            <div className="uiw-sub">{s.upNext}</div>
            <Para strong lines={2}>
              {first.title}
            </Para>
            <div className="uiw-sub">{lessonMeta(s, st, first)}</div>
          </div>
        </div>
        <WidgetList rows={rows(5).filter((r) => r.label !== first.title)} />
      </Widget>
    );
  },
};

/** One topic in the L grid: name, count, a thin bar. */
function TopicCell({ tp, s }: { tp: TopicProgress; s: S }) {
  const full = tp.done >= tp.total;
  return (
    <div className="ul-flex ul-col ug-4 umw-0">
      <div className="ul-flex ug-4 uj-between umw-0">
        <span className="uiw-sub">{tp.topic.title}</span>
        <span className="uiw-sub">{full ? '✓' : `${tp.done}/${tp.total}`}</span>
      </div>
      <WidgetBar
        value={tp.total ? tp.done / tp.total : 0}
        tone={full ? 'ok' : 'learn'}
        height={4}
      />
      <span hidden>{s.learn}</span>
    </div>
  );
}

/** Topic progress — lessons watched per Learn topic. */
const topicProgress: WidgetDef = {
  id: 'learn-topics',
  group: 'learn',
  icon: 'stack',
  tone: 'learn',
  name: () => las(getLocale()).names.topics,
  render: (size, ctx) => {
    const s = las(ctx.locale);
    const st = learnState(ctx);
    const frac = st.total ? st.doneCount / st.total : 0;
    const topicsDone = st.topics.filter((t) => t.done >= t.total).length;
    const cur = currentTopic(st);
    const curLine = cur ? `${cur.topic.title} ${cur.done}/${cur.total}` : s.allWatched;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="learn"
          icon="stack"
          title={s.watchedOf(st.doneCount, st.total)}
          sub={`${curLine} · ${s.topicsDone(topicsDone, st.topics.length)}`}
          onClick={openLearn}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="learn"
          kicker={s.names.topics}
          value={pct(frac)}
          unit="%"
          sub={cur ? s.next(curLine) : s.allWatched}
          bodyLast
          onClick={openLearn}
        >
          <div className="uiw-sub">{`${st.doneCount}/${st.total} ${s.lessons}`}</div>
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="learn"
          kicker={s.names.topics}
          badge={`${st.doneCount} / ${st.total}`}
          onClick={openLearn}
        >
          <div
            className="ul-grid"
            style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px 12px' }}
          >
            {st.topics.slice(0, 9).map((tp) => (
              <TopicCell key={tp.topic.id} tp={tp} s={s} />
            ))}
          </div>
        </Widget>
      );
    const rows = [...st.topics]
      .sort((a, b) => b.done / (b.total || 1) - a.done / (a.total || 1))
      .slice(0, 6)
      .map((tp) => ({
        label: tp.topic.title,
        value: tp.done >= tp.total ? `${tp.done}/${tp.total} ✓` : `${tp.done}/${tp.total}`,
      }));
    return (
      <Widget
        size="XL"
        tone="learn"
        kicker={s.names.topics}
        badge={`${st.doneCount} / ${st.total}`}
        onClick={openLearn}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={openLearn}>
            {cur ? s.finish(cur.topic.title) : s.openLearn}
          </Button>
        }
      >
        <div className="ul-flex ug-14 ua-center">
          <WidgetRing value={frac} size={84} tone="learn">
            {pct(frac)}%
          </WidgetRing>
          <div className="umw-0 uf-1">
            <div className="uiw-name">{s.watchedOf(st.doneCount, st.total)}</div>
            <div className="uiw-sub">{s.topicsDone(topicsDone, st.topics.length)}</div>
          </div>
        </div>
        <WidgetList rows={rows} />
      </Widget>
    );
  },
};

/** Did you know — one training-science fact a day (curated, with its source). */
const didYouKnow: WidgetDef = {
  id: 'did-you-know',
  group: 'learn',
  icon: 'book-open',
  tone: 'learn',
  name: () => las(getLocale()).names.fact,
  render: (size, ctx) => {
    const s = las(ctx.locale);
    const i = dayIndex(ctx.now) % s.facts.length;
    const f = s.facts[i];
    const badge = `${s.science} · ${s.factOf(i + 1, s.facts.length)}`;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="learn"
          icon="book-open"
          title={s.didYouKnow}
          sub={f.short}
          onClick={openLearn}
        />
      );
    if (size === 'S')
      return (
        <Widget size="S" tone="learn" kicker={s.didYouKnow} onClick={openLearn}>
          <Para strong lines={4}>
            {f.short}
          </Para>
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="learn"
          kicker={s.didYouKnow}
          badge={badge}
          sub={f.src}
          onClick={openLearn}
        >
          <Para lines={3}>{f.text}</Para>
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="learn"
        kicker={s.didYouKnow}
        badge={badge}
        onClick={openLearn}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={openLearn}>
            {s.openLearn}
          </Button>
        }
      >
        <div className="ul-grid" style={{ placeItems: 'center', padding: '8px 0' }}>
          <IconTile tone="learn" size={56} icon="book-open" />
        </div>
        <Para strong lines={2}>
          {f.short}
        </Para>
        <Para lines={5}>{f.text}</Para>
        <WidgetStats items={[{ label: s.source, value: f.src }]} />
      </Widget>
    );
  },
};

/* ------------------------------------------------------------------ */
/* Atlas                                                               */
/* ------------------------------------------------------------------ */

const TEMPER_TONE: Record<Temper, Tone> = { 1: 'ok', 3: 'accent', 5: 'danger' };

/** Most useful first — what the "insight" widget surfaces. */
const INSIGHT_RANK: Partial<Record<CoachFact['kind'], number>> = {
  imbalance: 0,
  stall: 1,
  restShort: 2,
  setDrop: 3,
  shortSleep: 4,
  comeback: 5,
  pr: 6,
  bodyweight: 7,
  skipped: 8,
  week: 9,
  streak: 10,
};

/** The one note worth leading with (Atlas insight widget, Today's note of the
 *  day): the most important kind, the latest of those. Plain session recaps
 *  and the intro never lead. */
export function topNote(notes: AtlasNote[]): AtlasNote | null {
  let best: AtlasNote | null = null;
  for (const n of notes) {
    const r = INSIGHT_RANK[n.kind];
    if (r === undefined) continue;
    const br = best ? (INSIGHT_RANK[best.kind] ?? 99) : 99;
    if (!best || r < br || (r === br && n.at > best.at)) best = n;
  }
  return best;
}

function finishedOf(ctx: WidgetCtx): Workout[] {
  return ctx.store.workouts.filter((w) => w.finishedAt !== null);
}

function exName(fmt: Fmt, name: string): string {
  return fmt.exercise(name);
}

/** A note as one short line (list rows, S/M titles), in every locale. */
function headline(s: S, f: CoachFact, fmt: Fmt): string {
  switch (f.kind) {
    case 'imbalance':
      return s.hImbalance(
        fmt.muscle(f.low),
        fmt.muscle(f.high),
        Math.round((1 - f.lowSets / Math.max(1, f.highSets)) * 100),
      );
    case 'stall':
      return s.hStall(exName(fmt, f.exercise), fmt.kg(f.weight));
    case 'restShort':
      return s.hRest(exName(fmt, f.exercise));
    case 'setDrop':
      return s.hDrop(exName(fmt, f.exercise));
    case 'shortSleep':
      return s.hSleep(String(Math.round(f.hours * 10) / 10));
    case 'comeback':
      return s.hComeback(f.daysOff);
    case 'pr':
      return s.hPr(exName(fmt, f.exercise), fmt.kg(f.weight));
    case 'bodyweight':
      return s.hBody(signed(f.deltaPct));
    case 'streak':
      return s.hStreak(f.days);
    case 'week':
      return s.hWeek(f.sessions, f.planned);
    case 'skipped':
      return s.hSkipped;
    case 'session':
      return s.hSession(f.sets);
    case 'intro':
      return s.hIntro;
  }
}

/** Atlas's notes feed for the widgets (same computation as the chat and the ring). */
function useAtlasNotes(ctx: WidgetCtx) {
  const fmt = useAtlasFmt();
  const minute = Math.floor(ctx.now / 60_000);
  const { workouts, sleeps, bodyMetrics, injuries, restPeriods, coach } = ctx.store;
  const res = useMemo(
    () =>
      buildNotes(
        { workouts, sleeps, bodyMetrics, injuries, restPeriods, coach },
        minute * 60_000,
        ctx.locale,
        fmt,
      ),
    [workouts, sleeps, bodyMetrics, injuries, restPeriods, coach, minute, ctx.locale, fmt],
  );
  return { ...res, fmt };
}

/** Every Atlas widget while Atlas is off: the invite (tap → setup). */
function AtlasOff({ size, ctx, icon }: { size: WidgetSize; ctx: WidgetCtx; icon: string }) {
  const s = las(ctx.locale);
  return (
    <Empty
      size={size}
      tone="atlas"
      icon={icon}
      kicker={s.atlas}
      title={s.meetAtlas}
      sub={s.atlasOffSub}
      action={s.turnOn}
      onClick={openCoach(ctx)}
    />
  );
}

/* ---------- Atlas insight (L3) ---------- */

function InsightWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const s = las(ctx.locale);
  const { notes, fmt } = useAtlasNotes(ctx);
  const open = openCoach(ctx);
  const note = useMemo(() => topNote(notes), [notes]);
  if (!note)
    return (
      <Empty
        size={size}
        tone="atlas"
        icon="sparkle"
        kicker={s.names.insight}
        title={s.noInsight}
        sub={s.noInsightSub}
        action={s.askAtlas}
        onClick={open}
      />
    );
  const f = note.fact;
  const head = headline(s, f, fmt);
  const kicker = `${s.atlas} · ${s.kind[f.kind] ?? ''}`;
  const when = ago(s, note.at, ctx.now);
  const gapPct =
    f.kind === 'imbalance' ? Math.round((1 - f.lowSets / Math.max(1, f.highSets)) * 100) : null;
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="atlas"
        icon="sparkle"
        title={head}
        sub={`${kicker} · ${when}`}
        onClick={open}
      />
    );
  if (size === 'S')
    return gapPct !== null && f.kind === 'imbalance' ? (
      <Widget
        size="S"
        tone="atlas"
        kicker={s.atlas}
        value={gapPct}
        unit={`% ${s.gap}`}
        sub={`${fmt.muscle(f.low)} < ${fmt.muscle(f.high)}`}
        onClick={open}
      />
    ) : (
      <Widget size="S" tone="atlas" kicker={kicker} sub={when} onClick={open}>
        <Para strong lines={3}>
          {head}
        </Para>
      </Widget>
    );
  const askBtn = (full: boolean) => (
    <Button variant="primary" size="sm" fullWidth={full} onClick={open}>
      {s.askAtlas}
    </Button>
  );
  if (size === 'L')
    return (
      <Widget
        size="L"
        tone="atlas"
        kicker={kicker}
        badge={when}
        onClick={open}
        footer={askBtn(false)}
      >
        <Para lines={2}>{note.text}</Para>
      </Widget>
    );
  return (
    <Widget
      size="XL"
      tone="atlas"
      kicker={kicker}
      badge={when}
      onClick={open}
      footer={askBtn(true)}
    >
      <Para strong lines={2}>
        {head}
      </Para>
      <Para lines={4}>{note.text}</Para>
      {f.kind === 'imbalance' && (
        <div className="ul-flex ul-col ug-8">
          {[
            { m: f.high, n: f.highSets, tone: 'neutral' as Tone },
            { m: f.low, n: f.lowSets, tone: 'atlas' as Tone },
          ].map((r) => (
            <div key={r.m} className="ul-flex ul-col ug-4">
              <div className="ul-flex uj-between ug-8">
                <span className="uiw-sub">{s.setsOf(fmt.muscle(r.m))}</span>
                <span className="uiw-sub">{r.n}</span>
              </div>
              <WidgetBar value={r.n / Math.max(1, f.highSets)} tone={r.tone} />
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

const atlasInsight: WidgetDef = {
  id: 'atlas-insight',
  group: 'atlas',
  icon: 'sparkle',
  tone: 'atlas',
  name: () => las(getLocale()).names.insight,
  render: (size, ctx) =>
    ctx.store.coach.enabled ? (
      <InsightWidget size={size} ctx={ctx} />
    ) : (
      <AtlasOff size={size} ctx={ctx} icon="sparkle" />
    ),
};

/* ---------- Ask Atlas (L3) + one-tap ask (L10) ---------- */

/** Starter questions for today — from your log when there is one (also the
 *  quick replies of Today's Atlas quick chat). */
export function atlasStarterChips(workouts: Workout[], locale: WidgetCtx['locale']): string[] {
  const s = las(locale);
  const finished = workouts.filter((w) => w.finishedAt !== null);
  if (!finished.length) return [s.chipPlan, s.chipSquat, s.chipRest];
  const counts = new Map<string, number>();
  for (const w of finished.slice(-30))
    for (const e of w.exercises) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const lift = top ? (localizedExerciseName(top, locale) ?? top) : null;
  return [s.chipTrain, s.chipRecovered, lift ? s.chipLift(lift) : s.chipWeek];
}

type Exchange = { q: string; a: string | null; at: number };

function lastExchange(log: ChatMsg[]): Exchange | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const m = log[i];
    if (m.from !== 'me' || m.notice) continue;
    const reply = log.slice(i + 1).find((x) => x.from === 'atlas' && !x.notice && !x.pending);
    return { q: m.text, a: reply?.text ?? null, at: m.at };
  }
  return null;
}

/** The last thing you asked Atlas and his reply (on-device chat log). */
function useLastExchange(): Exchange | null {
  const log = useChatLog();
  return useMemo(() => lastExchange(log), [log]);
}

function AskWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const s = las(ctx.locale);
  const open = openCoach(ctx);
  const last = useLastExchange();
  const chips = atlasStarterChips(ctx.store.workouts, ctx.locale);
  const chipRow = (
    <ChipGroup>
      {chips.map((c) => (
        <Chip key={c} size="sm" onClick={open}>
          {c}
        </Chip>
      ))}
    </ChipGroup>
  );
  const input = (
    <Button variant="secondary" size="sm" fullWidth onClick={open}>
      {s.askAnything}
    </Button>
  );
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="atlas"
        icon="sparkle"
        title={s.askAnything}
        sub={chips[0]}
        onClick={open}
      />
    );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="atlas"
        kicker={s.atlas}
        title={s.askAtlas}
        sub={chips[1]}
        onClick={open}
      />
    );
  if (size === 'L')
    return (
      <Widget size="L" tone="atlas" kicker={s.askAtlas} onClick={open} footer={input}>
        {chipRow}
      </Widget>
    );
  const finished = finishedOf(ctx);
  const ready = [...muscleReadiness(finished, ctx.now).values()];
  const avg = ready.length ? ready.reduce((a, m) => a + m.readiness, 0) / ready.length : 1;
  return (
    <Widget
      size="XL"
      tone="atlas"
      kicker={s.askAtlas}
      badge={s.readinessP(pct(avg))}
      onClick={open}
      footer={input}
    >
      {chipRow}
      {last ? (
        <div className="ul-flex ul-col ug-8">
          <Para strong lines={2}>
            {`“${last.q}”`}
          </Para>
          {last.a && <Para lines={5}>{last.a}</Para>}
        </div>
      ) : (
        <>
          <div className="uiw-sub">{s.tryAsking}</div>
          <WidgetList rows={[s.chipWeek, s.chipRest].map((q) => ({ label: q, value: '›' }))} />
        </>
      )}
    </Widget>
  );
}

const askAtlas: WidgetDef = {
  id: 'ask-atlas',
  group: 'atlas',
  icon: 'sparkle',
  tone: 'atlas',
  name: () => las(getLocale()).names.ask,
  render: (size, ctx) => <AskWidget size={size} ctx={ctx} />,
};

function QuickAskWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const s = las(ctx.locale);
  const open = openCoach(ctx);
  const last = useLastExchange();
  const chips = atlasStarterChips(ctx.store.workouts, ctx.locale);
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="atlas"
        icon="hand-tap"
        title={s.askAtlas}
        sub={s.betweenSets}
        onClick={open}
        trailing={
          <Button variant="primary" size="sm" onClick={open}>
            {s.askAtlas}
          </Button>
        }
      />
    );
  if (size === 'S')
    return (
      <Widget size="S" tone="atlas" kicker={s.atlas} title={s.tapToAsk} onClick={open}>
        <div className="ul-grid uf-1" style={{ placeItems: 'center' }}>
          <IconTile tone="atlas" size={48} icon="hand-tap" />
        </div>
      </Widget>
    );
  if (size === 'L')
    return (
      <Widget size="L" tone="atlas" kicker={s.askAtlas} onClick={open}>
        <div className="ul-flex ug-12 ua-center">
          <IconTile tone="atlas" size={56} icon="hand-tap" />
          <div className="umw-0 uf-1">
            <div className="uiw-name">{s.tapToAsk}</div>
            <div className="uiw-sub">{`“${chips[0]}”`}</div>
            <div className="uiw-sub">{`“${chips[1]}”`}</div>
          </div>
        </div>
      </Widget>
    );
  return (
    <Widget
      size="XL"
      tone="atlas"
      kicker={s.names.quickAsk}
      onClick={open}
      footer={
        <Button variant="primary" size="sm" fullWidth onClick={open}>
          {s.openChat}
        </Button>
      }
    >
      <div className="ul-flex ul-col ua-center ug-8" style={{ padding: '8px 0' }}>
        <IconTile tone="atlas" size={56} icon="hand-tap" />
        <div className="uiw-sub">{s.betweenSets}</div>
      </div>
      <div className="uiw-sub">{s.tryAsking}</div>
      <WidgetList rows={chips.map((q) => ({ label: `“${q}”`, value: '›' }))} />
      {last && <div className="uiw-sub">{s.lastAsked(last.q)}</div>}
    </Widget>
  );
}

const quickAsk: WidgetDef = {
  id: 'atlas-quick-ask',
  group: 'atlas',
  icon: 'hand-tap',
  tone: 'atlas',
  name: () => las(getLocale()).names.quickAsk,
  render: (size, ctx) => <QuickAskWidget size={size} ctx={ctx} />,
};

/* ---------- Atlas plan for today (L10) ---------- */

function PlanWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const s = las(ctx.locale);
  const { t, store, now, locale } = ctx;
  const today = useTodayPlan(now);
  const plan = store.coach.role === 'main' ? (store.coach.plan ?? null) : null;
  const finished = useMemo(
    () => store.workouts.filter((w) => w.finishedAt !== null),
    [store.workouts],
  );
  const ready = useMemo(() => [...muscleReadiness(finished, now).entries()], [finished, now]);
  const avg = ready.length ? ready.reduce((a, [, m]) => a + m.readiness, 0) / ready.length : 1;
  const openCoachNow = openCoach(ctx);
  const start = () => ctx.shell.openStart();

  if (!plan)
    return (
      <Empty
        size={size}
        tone="atlas"
        icon="barbell"
        kicker={s.planToday}
        title={s.noPlan}
        sub={s.noPlanSub}
        action={s.openChat}
        onClick={openCoachNow}
      />
    );
  const trainedToday = finished.some((w) => dayKey(w.startedAt) === dayKey(now));
  if (trainedToday)
    return (
      <Empty
        size={size}
        tone="atlas"
        icon="check"
        kicker={s.planToday}
        title={s.doneToday}
        sub={s.doneTodaySub}
        action={s.openChat}
        onClick={openCoachNow}
      />
    );
  if (!today) {
    const dow = new Date(now).getDay();
    const k = [1, 2, 3, 4, 5, 6, 7].find((d) => plan.days.some((p) => p.weekday === (dow + d) % 7));
    return (
      <Empty
        size={size}
        tone="atlas"
        icon="moon"
        kicker={s.planToday}
        title={s.restDay}
        sub={k ? s.nextPlanDay(fmtWeekdayShort(now + k * DAY, locale)) : s.readinessP(pct(avg))}
        action={s.openChat}
        onClick={openCoachNow}
      />
    );
  }
  const label = today.day.name ?? t.splitNames[today.day.split] ?? today.built.dayName;
  const main = today.built.main;
  const exLabel = (name: string) => localizedExerciseName(name, locale) ?? name;
  const setLine = (p: (typeof main)[number]) =>
    p.targetWeight ? fmtSet(p.targetWeight, p.repHigh) : `${p.sets} × ${p.repLow}–${p.repHigh}`;
  const top = main[0];
  const focus = top ? `${exLabel(top.name)} ${setLine(top)}` : '';
  const tired = ready
    .filter(([m]) => today.built.targetMuscles.includes(m))
    .sort((a, b) => a[1].readiness - b[1].readiness)[0];
  const tiredLine =
    tired && tired[1].readiness < 0.9
      ? s.stillRecovering(t.muscleGroups[tired[0]] ?? tired[0])
      : s.allFresh;
  const meta = `${s.exercisesN(main.length)} · ${s.minN(today.built.estMinutes)}`;
  const startBtn = (text: string, full = false) => (
    <Button variant="primary" size="sm" fullWidth={full} onClick={start}>
      {text}
    </Button>
  );
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="atlas"
        icon="barbell"
        title={`${s.train} · ${label}`}
        sub={`${s.atlas} · ${focus} · ${s.readinessP(pct(avg))}`}
        onClick={start}
        trailing={startBtn(s.start)}
      />
    );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="atlas"
        kicker={s.train}
        title={label}
        sub={focus || meta}
        onClick={start}
      />
    );
  if (size === 'L')
    return (
      <Widget
        size="L"
        tone="atlas"
        kicker={s.planToday}
        badge={s.readinessP(pct(avg))}
        title={label}
        sub={`${meta} · ${s.focus}: ${focus}`}
        onClick={start}
        footer={startBtn(s.start)}
      />
    );
  return (
    <Widget
      size="XL"
      tone="atlas"
      kicker={s.planFor(fmtWeekdayDayMonth(now, locale))}
      badge={s.readinessP(pct(avg))}
      onClick={start}
      footer={startBtn(s.startX(label), true)}
    >
      <div>
        <div className="uiw-name">{label}</div>
        <div className="uiw-sub">{`${meta} · ${tiredLine}`}</div>
      </div>
      <WidgetList
        rows={main.slice(0, 5).map((p, i) => ({
          icon: i === 0 ? 'target' : undefined,
          label: exLabel(p.name),
          value: setLine(p),
        }))}
      />
    </Widget>
  );
}

const atlasPlan: WidgetDef = {
  id: 'atlas-plan',
  group: 'atlas',
  icon: 'barbell',
  tone: 'atlas',
  name: () => las(getLocale()).names.plan,
  render: (size, ctx) =>
    ctx.store.coach.enabled ? (
      <PlanWidget size={size} ctx={ctx} />
    ) : (
      <AtlasOff size={size} ctx={ctx} icon="barbell" />
    ),
};

/* ---------- Atlas debrief (L10) ---------- */

function DebriefWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const s = las(ctx.locale);
  const fmt = useAtlasFmt();
  const { store, locale } = ctx;
  const data = useMemo(() => {
    const finished = store.workouts.filter((w) => w.finishedAt !== null);
    const last = finished.reduce<Workout | null>(
      (b, w) => (!b || (w.finishedAt ?? 0) > (b.finishedAt ?? 0) ? w : b),
      null,
    );
    if (!last) return null;
    const facts = sessionFacts(last, finished);
    const session = facts.find((f) => f.kind === 'session');
    const wins: string[] = [];
    const fixes: string[] = [];
    for (const f of facts) {
      if (f.kind === 'pr') wins.push(s.winPr(fmt.exercise(f.exercise), fmtSet(f.weight, f.reps)));
      if (f.kind === 'comeback') wins.push(s.winComeback(f.daysOff));
      if (f.kind === 'stall') fixes.push(s.fixStall(fmt.exercise(f.exercise), fmt.kg(f.weight)));
      if (f.kind === 'restShort')
        fixes.push(
          s.fixRest(fmt.exercise(f.exercise), fmtCountdown(f.restSec), fmtCountdown(f.targetSec)),
        );
    }
    const sets = session && session.kind === 'session' ? session.sets : 0;
    if (!wins.length && sets > 0) wins.push(s.winSets(sets));
    return {
      w: last,
      wins,
      fixes,
      prs: facts.filter((f) => f.kind === 'pr').length,
      sets,
      volume: session && session.kind === 'session' ? session.volumeKg : workoutVolumeKg(last),
    };
  }, [store.workouts, fmt, s]);
  if (!data)
    return (
      <Empty
        size={size}
        tone="atlas"
        icon="list-checks"
        kicker={s.debrief}
        title={s.noDebrief}
        sub={s.noDebriefSub}
        action={s.openChat}
        onClick={openCoach(ctx)}
      />
    );
  const { w, wins, fixes } = data;
  const open = () => ctx.shell.openOverlay({ screen: 'past-workout', workoutId: w.id });
  const title = w.dayName || fmtWeekdayShort(w.startedAt, locale);
  const date = fmtWeekdayDayMonth(w.startedAt, locale);
  const tally = s.winsChanges(wins.length, fixes.length);
  const rows = (n: number) =>
    [
      ...wins.map((label) => ({ icon: 'check', tone: 'ok' as Tone, label })),
      ...(fixes.length
        ? fixes.map((label) => ({ icon: 'arrows-clockwise', tone: 'accent' as Tone, label }))
        : [{ icon: 'check', tone: 'ok' as Tone, label: s.cleanSession }]),
    ].slice(0, n);
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="atlas"
        icon="list-checks"
        title={`${s.debrief} · ${title}`}
        sub={tally}
        onClick={open}
      />
    );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="atlas"
        kicker={s.debrief}
        value={wins.length}
        unit={`· ${fixes.length}`}
        title={title}
        sub={tally}
        onClick={open}
      />
    );
  if (size === 'L')
    return (
      <Widget
        size="L"
        tone="atlas"
        kicker={`${s.debrief} · ${title}`}
        badge={fmtWeekdayShort(w.startedAt, locale)}
        onClick={open}
      >
        <WidgetList rows={[rows(99)[0], ...(fixes.length ? [rows(99)[wins.length]] : [])]} />
      </Widget>
    );
  return (
    <Widget
      size="XL"
      tone="atlas"
      kicker={s.names.debrief}
      badge={date}
      onClick={open}
      footer={
        <Button variant="primary" size="sm" fullWidth onClick={openCoach(ctx)}>
          {s.askAtlas}
        </Button>
      }
    >
      <div className="uiw-name">{title}</div>
      <WidgetStats
        items={[
          { label: s.volume, value: fmtTonnes(data.volume) },
          { label: s.sets, value: data.sets },
          { label: s.prShort, value: data.prs },
        ]}
      />
      <WidgetList rows={rows(4)} />
    </Widget>
  );
}

const atlasDebrief: WidgetDef = {
  id: 'atlas-debrief',
  group: 'atlas',
  icon: 'list-checks',
  tone: 'atlas',
  name: () => las(getLocale()).names.debrief,
  render: (size, ctx) =>
    ctx.store.coach.enabled ? (
      <DebriefWidget size={size} ctx={ctx} />
    ) : (
      <AtlasOff size={size} ctx={ctx} icon="list-checks" />
    ),
};

/* ---------- Atlas mood (L10) ---------- */

function MoodWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const s = las(ctx.locale);
  const { t, store, now } = ctx;
  const { notes, temper } = useAtlasNotes(ctx);
  const open = openCoach(ctx);
  const why = useMemo(() => {
    const finished = store.workouts.filter((w) => w.finishedAt !== null);
    const ready = [...muscleReadiness(finished, now).values()];
    const avg = ready.length ? ready.reduce((a, m) => a + m.readiness, 0) / ready.length : 1;
    const since = weekStartOf(now);
    return {
      streak: consistencyStreak(now),
      readiness: avg,
      week: finished.filter((w) => w.startedAt >= since).length,
      soften: store.coach.keepTemper
        ? null
        : softenReason({
            injuries: store.injuries,
            restPeriods: store.restPeriods,
            sleeps: store.sleeps,
            finished,
            now,
          }),
    };
  }, [
    store.workouts,
    store.injuries,
    store.restPeriods,
    store.sleeps,
    store.coach.keepTemper,
    now,
  ]);
  const ti = temperIndex(temper);
  const name = t.atlasTemper[ti];
  const tone = TEMPER_TONE[temper];
  const muted = (store.coach.mutedUntil ?? 0) > now;
  const latest = notes.length ? notes[notes.length - 1] : null;
  const line =
    latest && now - latest.at < 3 * DAY ? latest.text : (t.atlasTemperTag[ti] ?? t.atlasTemper[ti]);
  const reason = muted ? s.muted : why.soften ? (s.soften[why.soften] ?? s.normalDay) : s.normalDay;
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone={tone}
        icon="sparkle"
        title={`${s.atlas} · ${name}`}
        sub={line}
        onClick={open}
      />
    );
  if (size === 'S')
    return (
      // The temper name is the headline; the tagline sits under it.
      <Widget size="S" tone={tone} kicker={s.moodK} title={name} bodyLast onClick={open}>
        <Para lines={2}>{line}</Para>
      </Widget>
    );
  if (size === 'L')
    return (
      <Widget size="L" tone={tone} kicker={`${s.atlas} · ${name}`} onClick={open}>
        <Para lines={2}>{line}</Para>
        <WidgetStats
          items={[
            { label: s.streak, value: s.daysN(why.streak) },
            { label: s.readiness, value: `${pct(why.readiness)}%` },
          ]}
        />
      </Widget>
    );
  return (
    <Widget
      size="XL"
      tone={tone}
      kicker={s.moodK}
      badge={name}
      onClick={open}
      footer={
        <Button variant="primary" size="sm" fullWidth onClick={open}>
          {s.talk}
        </Button>
      }
    >
      <Para strong lines={3}>
        {line}
      </Para>
      <ChipGroup>
        {[1, 3, 5].map((tp, i) => (
          <Chip key={tp} size="sm" selected={tp === temper}>
            {t.atlasTemper[i]}
          </Chip>
        ))}
      </ChipGroup>
      <div className="uiw-sub">{s.whyMood}</div>
      <WidgetList
        rows={[
          { label: s.streak, value: s.daysN(why.streak) },
          { label: s.readiness, value: `${pct(why.readiness)}%` },
          { label: s.thisWeek, value: String(why.week) },
          { label: reason },
        ]}
      />
    </Widget>
  );
}

const atlasMood: WidgetDef = {
  id: 'atlas-mood',
  group: 'atlas',
  icon: 'sparkle',
  tone: 'atlas',
  name: () => las(getLocale()).names.mood,
  render: (size, ctx) =>
    ctx.store.coach.enabled ? (
      <MoodWidget size={size} ctx={ctx} />
    ) : (
      <AtlasOff size={size} ctx={ctx} icon="sparkle" />
    ),
};

/* ---------- Atlas notes (L10) ---------- */

function NotesWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const s = las(ctx.locale);
  const { notes, fmt } = useAtlasNotes(ctx);
  const open = openCoach(ctx);
  const readAt = ctx.store.coach.readAt;
  const unread = useMemo(
    () => notes.filter((n) => n.at > readAt).sort((a, b) => b.at - a.at),
    [notes, readAt],
  );
  if (!unread.length)
    return (
      <Empty
        size={size}
        tone="atlas"
        icon="pencil-simple-line"
        kicker={s.notesK}
        title={s.allRead}
        sub={s.allReadSub}
        action={s.openNotes}
        onClick={open}
      />
    );
  const first = unread[0];
  const head = (n: AtlasNote) => headline(s, n.fact, fmt);
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="atlas"
        icon="pencil-simple-line"
        title={s.unread(unread.length)}
        sub={unread.length > 1 ? `${head(first)} · ${s.more(unread.length - 1)}` : head(first)}
        onClick={open}
      />
    );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="atlas"
        kicker={s.notesK}
        value={unread.length}
        title={head(first)}
        sub={unread.length > 1 ? s.more(unread.length - 1) : ago(s, first.at, ctx.now)}
        onClick={open}
      />
    );
  if (size === 'L')
    return (
      <Widget
        size="L"
        tone="atlas"
        kicker={s.notesK}
        badge={s.unread(unread.length)}
        onClick={open}
      >
        <WidgetList
          rows={unread.slice(0, 3).map((n) => ({ label: head(n), value: s.kind[n.kind] ?? '' }))}
        />
      </Widget>
    );
  const markRead = () => setCoach({ readAt: Date.now() });
  return (
    <Widget
      size="XL"
      tone="atlas"
      kicker={s.notesK}
      badge={s.unread(unread.length)}
      onClick={open}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={markRead}>
            {s.markRead}
          </Button>
          <Button variant="primary" size="sm" fullWidth onClick={open}>
            {s.openNotes}
          </Button>
        </>
      }
    >
      <Para strong lines={2}>
        {head(first)}
      </Para>
      <Para lines={3}>{first.text}</Para>
      <WidgetList
        rows={unread.slice(1, 5).map((n) => ({
          label: head(n),
          value: `${s.kind[n.kind] ?? ''} · ${ago(s, n.at, ctx.now)}`,
        }))}
      />
    </Widget>
  );
}

const atlasNotes: WidgetDef = {
  id: 'atlas-notes',
  group: 'atlas',
  icon: 'pencil-simple-line',
  tone: 'atlas',
  name: () => las(getLocale()).names.notes,
  render: (size, ctx) =>
    ctx.store.coach.enabled ? (
      <NotesWidget size={size} ctx={ctx} />
    ) : (
      <AtlasOff size={size} ctx={ctx} icon="pencil-simple-line" />
    ),
};

/* ---------- Atlas weekly review (L10) ---------- */

function WeeklyWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const s = las(ctx.locale);
  const { notes, fmt } = useAtlasNotes(ctx);
  const { store, now, locale } = ctx;
  const open = openCoach(ctx);
  const plan = store.coach.role === 'main' ? (store.coach.plan ?? null) : null;
  const wk = useMemo(() => {
    const finished = store.workouts.filter((w) => w.finishedAt !== null);
    const end = weekStartOf(now);
    const start = end - 7 * DAY;
    const inWeek = finished.filter((w) => w.startedAt >= start && w.startedAt < end);
    const prevKg = finished
      .filter((w) => w.startedAt >= start - 7 * DAY && w.startedAt < start)
      .reduce((a, w) => a + workoutVolumeKg(w), 0);
    const kg = inWeek.reduce((a, w) => a + workoutVolumeKg(w), 0);
    const prs = inWeek.flatMap((w) => sessionFacts(w, finished).filter((f) => f.kind === 'pr'));
    const perDay = Array.from({ length: 7 }, (_, i) =>
      inWeek
        .filter((w) => w.startedAt >= start + i * DAY && w.startedAt < start + (i + 1) * DAY)
        .reduce((a, w) => a + workoutVolumeKg(w), 0),
    );
    return {
      start,
      end,
      sessions: inWeek.length,
      planned: plan?.days.length || usualSessionsPerWeek(finished, start) || inWeek.length,
      kg,
      prevKg,
      prs,
      perDay,
    };
  }, [store.workouts, now, plan]);
  const range = `${fmtDayMonth(wk.start, locale)}–${fmtDayMonth(wk.end - DAY, locale)}`;
  if (!wk.sessions)
    return (
      <Empty
        size={size}
        tone="atlas"
        icon="calendar-check"
        kicker={s.weekReview}
        title={s.noWeek}
        sub={s.noWeekSub}
        action={s.openChat}
        onClick={open}
      />
    );
  const tonnes = fmtTonnes(wk.kg);
  const best = wk.prs.find((f) => f.kind === 'pr');
  const issue = notes.find(
    (n) => (n.kind === 'imbalance' || n.kind === 'stall') && n.at >= wk.start && n.at < wk.end,
  );
  const bullets = [
    s.lineSessions(wk.sessions, wk.planned, tonnes),
    best && best.kind === 'pr'
      ? s.lineRecord(fmt.exercise(best.exercise), fmtSet(best.weight, best.reps))
      : s.lineNoRecord,
    issue
      ? headline(s, issue.fact, fmt)
      : wk.prevKg > 0
        ? s.lineVolume(signed(((wk.kg - wk.prevKg) / wk.prevKg) * 100, 0))
        : null,
  ].filter((b): b is string => !!b);
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="atlas"
        icon="calendar-check"
        title={`${s.weekReview} · ${range}`}
        sub={`${s.sessionsK} ${s.sessionsOf(wk.sessions, wk.planned)} · ${tonnes}`}
        onClick={open}
      />
    );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="atlas"
        kicker={s.weekReview}
        value={wk.sessions}
        unit={`/ ${wk.planned}`}
        sub={`${tonnes} · ${range}`}
        onClick={open}
      />
    );
  if (size === 'L')
    return (
      <Widget size="L" tone="atlas" kicker={`${s.weekReview} · ${range}`} onClick={open}>
        <WidgetList rows={bullets.map((b, i) => ({ label: `${i + 1}. ${b}` }))} />
      </Widget>
    );
  const start = wk.start;
  return (
    <Widget
      size="XL"
      tone="atlas"
      kicker={s.names.weekly}
      badge={range}
      onClick={open}
      footer={
        <Button variant="primary" size="sm" fullWidth onClick={open}>
          {s.fullReview}
        </Button>
      }
    >
      <WidgetBars
        tone="atlas"
        values={wk.perDay}
        highlight={wk.perDay.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0)}
        labels={wk.perDay.map((_, i) =>
          fmtWeekdayShort(start + i * DAY + DAY / 2, locale).slice(0, 2),
        )}
        height={72}
      />
      <WidgetStats
        items={[
          { label: s.sessionsK, value: s.sessionsOf(wk.sessions, wk.planned) },
          { label: s.lifted, value: tonnes },
          { label: s.records, value: wk.prs.length },
        ]}
      />
      {bullets.map((b, i) => (
        <Para key={i} lines={2}>{`${i + 1}. ${b}`}</Para>
      ))}
    </Widget>
  );
}

const atlasWeekly: WidgetDef = {
  id: 'atlas-weekly',
  group: 'atlas',
  icon: 'calendar-check',
  tone: 'atlas',
  name: () => las(getLocale()).names.weekly,
  render: (size, ctx) =>
    ctx.store.coach.enabled ? (
      <WeeklyWidget size={size} ctx={ctx} />
    ) : (
      <AtlasOff size={size} ctx={ctx} icon="calendar-check" />
    ),
};

export const LEARN_ATLAS_WIDGETS: WidgetDef[] = [
  learnNext,
  lessonOfDay,
  savedLessons,
  topicProgress,
  didYouKnow,
  atlasInsight,
  askAtlas,
  atlasPlan,
  atlasDebrief,
  atlasMood,
  atlasNotes,
  atlasWeekly,
  quickAsk,
];
