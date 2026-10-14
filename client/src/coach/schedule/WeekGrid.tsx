import { useEffect, useMemo, useRef, useState } from 'react';
import './Schedule.css';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { NowLine, NowStatus, nowOffset, useScrollToNow } from '../../components/ui/NowLine';
import type { LocaleId } from '../../i18n';
import type { ScheduleStrings } from '../../i18n/coachSchedule';
import { ClientAvatar } from '../ClientAvatar';
import { coachClock } from '../format';
import { slotClock, slotTitle, statusWord } from './blockText';
import { DEFAULT_DURATION, dragSpan, snapMinutes, type CreateDraft } from './grid';
import { dayNumber, longDate, shortWeekday } from './labels';
import { endOf, onDay, peopleOf, type Ghost } from './model';
import type { People } from './people';
import { dayOfTs, dowOfDay, fromMin, minOfTs } from './time';
import type { ScheduleSlot } from './types';
import { hourRange, placeBlocks } from './view';
import { shadedBands, visibleRange, type CalendarSettings, type GymWeeks } from './hours';
import { StateMark, stateClass } from './StateMark';
import { cardStateOf, liveProgress } from './status';

export interface WeekGridProps {
  days: readonly number[];
  slots: readonly ScheduleSlot[];
  ghosts: readonly Ghost[];
  conflicts: ReadonlySet<string>;
  now: number;
  today: number;
  selected: string | null;
  onSelect: (id: string) => void;
  people: People;
  t: ScheduleStrings;
  locale: LocaleId;
  label?: string;
  /** Click / tap / drag on an empty slot: a session to create there (omit for a read-only grid). */
  onCreate?: (d: CreateDraft) => void;
  /** Length of the ghost block that follows the pointer (the last used duration). */
  ghostDur?: number;
  /** The trainer's calendar settings and the gyms' opening hours: the visible range and the shaded off-hours. Absent = 07:00 to 21:00 (grown for sessions outside). */
  hours?: { settings: CalendarSettings; gyms: GymWeeks };
}

interface Item {
  id: string;
  start: number;
  end: number;
  slot: ScheduleSlot;
  ghost?: Ghost;
}

const MAX_AVATARS = 2;
/** A touch that moves farther than this (px) is a scroll, not a tap. */
const TAP_SLOP = 8;
/** The keyboard button of a day column proposes this start (clamped into the visible hours). */
const KEY_START = 9 * 60;

/**
 * True when the now chip would cover the hour label of `hourMin`. Labels are centred on their hour line and so is the
 * chip on the now line (each about 16 minutes tall), so they collide when the two lines are closer than about 14 minutes.
 */
export function hourUnderChip(hourMin: number, nowMin: number): boolean {
  return Math.abs(nowMin - hourMin) < 14;
}

/**
 * The week / day grid (desktop). Hours run down, one column per day. Blocks are kit Cards placed by percentage of the
 * visible hour range; overlapping blocks share the column side by side. A pending request is a dashed block at its
 * proposed time, a session that moved leaves a struck "Moved to Tue" at the old time, a clash is marked with an icon and
 * a word (never colour alone).
 */
export function WeekGrid(p: WeekGridProps) {
  const { t, locale, people } = p;
  const visible = useMemo(() => p.days.flatMap((d) => onDayAll(p.slots, d)), [p.days, p.slots]);
  const { from, to } = useMemo(() => {
    if (!p.hours) {
      return hourRange(
        visible,
        p.ghosts.map((g) => g.start),
      );
    }
    const spans = (start: number, end: number) => {
      const s = minOfTs(start);
      const e = minOfTs(end);
      return { start: s, end: e > s ? e : 24 * 60 };
    };
    return visibleRange(p.hours.settings, p.hours.gyms, p.days.map(dowOfDay), [
      ...visible.map((s) => spans(s.start, endOf(s))),
      ...p.ghosts.map((g) => spans(g.start, g.start + g.slot.durationMin * 60_000)),
    ]);
  }, [visible, p.ghosts, p.hours, p.days]);
  const hours = Array.from({ length: Math.ceil((to - from) / 60) }, (_, i) => from / 60 + i);
  const nowDay = dayOfTs(p.now);
  const nowMin = minOfTs(p.now);
  const clock = coachClock(p.now);
  const nowShown = p.days.includes(nowDay) && nowOffset(nowMin, from, to) !== null;
  const root = useRef<HTMLDivElement>(null);
  useScrollToNow(root, nowShown);
  useScrollToFirst(root, !nowShown, `${p.days[0]}:${p.days.length}:${from}`);
  /* Day view: the "now" chip lives in the hour gutter. The hour label whose text it would cover steps aside (the chip
     says the time anyway); week view has no chip so every label stays. */
  const chipAt = nowShown && p.days.length === 1 && p.days[0] === nowDay ? nowMin : null;

  /* Create by click: hover shows a ghost block, a drag sets the length, a tap / click opens the create flow. */
  const create = p.onCreate;
  const [hover, setHover] = useState<{ day: number; start: number } | null>(null);
  const [drag, setDrag] = useState<{ day: number; a: number; b: number } | null>(null);
  const press = useRef<{ a: number; x: number; y: number; touch: boolean } | null>(null);
  const minuteAt = (e: React.PointerEvent<HTMLElement>): number => {
    const r = e.currentTarget.getBoundingClientRect();
    return snapMinutes(e.clientY - r.top, r.height, from, to);
  };
  const onBlock = (e: React.PointerEvent<HTMLElement>): boolean =>
    (e.target as HTMLElement).closest('.sc-block, .sc-col-add') !== null;
  const colHandlers = (day: number) =>
    create
      ? {
          onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
            if (onBlock(e) || (e.pointerType === 'mouse' && e.button !== 0)) return;
            const touch = e.pointerType === 'touch';
            press.current = { a: minuteAt(e), x: e.clientX, y: e.clientY, touch };
            if (!touch) e.currentTarget.setPointerCapture?.(e.pointerId);
          },
          onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
            const pr = press.current;
            if (pr) {
              if (pr.touch) {
                if (Math.hypot(e.clientX - pr.x, e.clientY - pr.y) > TAP_SLOP) press.current = null;
                return;
              }
              const b = minuteAt(e);
              if (b !== pr.a || drag) setDrag({ day, a: pr.a, b });
              return;
            }
            if (e.pointerType === 'touch') return;
            if (onBlock(e)) setHover(null);
            else setHover({ day, start: minuteAt(e) });
          },
          onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
            const pr = press.current;
            press.current = null;
            setDrag(null);
            if (!pr) return;
            if (!pr.touch) e.currentTarget.releasePointerCapture?.(e.pointerId);
            const b = pr.touch ? pr.a : minuteAt(e);
            if (b !== pr.a) {
              const span = dragSpan(pr.a, b);
              create({ day, start: span.start, dur: span.dur });
            } else create({ day, start: pr.a, dur: null });
          },
          onPointerCancel: () => {
            press.current = null;
            setDrag(null);
          },
          onPointerLeave: () => {
            if (!press.current) setHover(null);
          },
        }
      : {};
  const ghostOf = (day: number): { start: number; dur: number } | null => {
    if (!create) return null;
    if (drag && drag.day === day) return dragSpan(drag.a, drag.b);
    if (!drag && hover && hover.day === day)
      return { start: hover.start, dur: p.ghostDur ?? DEFAULT_DURATION };
    return null;
  };
  return (
    <div
      ref={root}
      className="sc-grid"
      style={{ '--sc-cols': p.days.length, '--sc-hours': hours.length } as React.CSSProperties}
      role="group"
      aria-label={p.label ?? t.scGridLabel}
    >
      <div className="sc-grid-head">
        <span className="sc-gutter" aria-hidden="true" />
        {p.days.map((d) => {
          const n = onDay(p.slots, d).length;
          return (
            <div key={d} className={`sc-colhead${d === p.today ? ' is-today' : ''}`}>
              <span className="sc-colhead-w">{shortWeekday(d, locale)}</span>
              <span className="sc-colhead-n" aria-current={d === p.today ? 'date' : undefined}>
                {dayNumber(d)}
              </span>
              <span className="sc-colhead-s">
                {d === p.today && (
                  <>
                    <span className="sc-colhead-today">{t.scToday}</span>
                    <span className="sc-colhead-sep"> · </span>
                  </>
                )}
                <span>{t.scSessionsDay(n)}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="sc-grid-body">
        <div className="sc-hours" aria-hidden="true">
          {hours.map((h) => (
            <span
              key={h}
              className={`sc-hour${chipAt !== null && hourUnderChip(h * 60, chipAt) ? ' is-under-now' : ''}`}
            >
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>
        {p.days.map((d) => {
          const items: Item[] = [
            ...p.slots
              .filter((s) => dayOfTs(s.start) === d)
              .map((s) => ({
                id: s.id,
                start: s.start,
                end: s.start + s.durationMin * 60_000,
                slot: s,
              })),
            ...p.ghosts
              .filter((g) => dayOfTs(g.start) === d)
              .map((g) => ({
                id: `ghost:${g.req.id}`,
                start: g.start,
                end: g.start + g.slot.durationMin * 60_000,
                slot: g.slot,
                ghost: g,
              })),
          ];
          const placed = placeBlocks(items, (i) => ({ start: i.start, end: i.end }), from, to);
          /* the overlap warning once per cluster: on the earliest overlapping session of the cluster */
          const warned = new Set<number>();
          const warnAt = new Set<string>();
          for (const b of placed) {
            if (
              b.size > 1 &&
              !b.item.ghost &&
              p.conflicts.has(b.item.slot.id) &&
              !warned.has(b.cluster)
            ) {
              warned.add(b.cluster);
              warnAt.add(b.item.id);
            }
          }
          const ghost = ghostOf(d);
          return (
            <div
              key={d}
              className={`sc-col${d === p.today ? ' is-today' : ''}${create ? ' is-creatable' : ''}`}
              role="group"
              aria-label={`${longDate(d, locale)}, ${t.scSessionsDay(onDay(p.slots, d).length)}`}
              data-day={d}
              {...colHandlers(d)}
            >
              {create && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="sc-col-add"
                  onClick={() =>
                    create({
                      day: d,
                      start: Math.min(Math.max(KEY_START, from), to - 60),
                      dur: null,
                    })
                  }
                >
                  {t.qcAddOn(longDate(d, locale))}
                </Button>
              )}
              {p.hours &&
                shadedBands(p.hours.settings, p.hours.gyms, dowOfDay(d), from, to).map(([a, b]) => (
                  <div
                    key={a}
                    className="sc-off"
                    aria-hidden="true"
                    data-off=""
                    style={
                      {
                        '--sc-top': (a - from) / (to - from),
                        '--sc-h': (b - a) / (to - from),
                      } as React.CSSProperties
                    }
                  />
                ))}
              {ghost && (
                <div
                  className="sc-newslot"
                  aria-hidden="true"
                  data-newslot=""
                  style={
                    {
                      '--sc-top': (ghost.start - from) / (to - from),
                      '--sc-h': Math.min(ghost.dur, to - ghost.start) / (to - from),
                    } as React.CSSProperties
                  }
                >
                  <span>
                    {fromMin(ghost.start)}–{fromMin(Math.min(ghost.start + ghost.dur, 24 * 60))}
                  </span>
                </div>
              )}
              {placed.map((b) => (
                <Block key={b.item.id} {...b} warn={warnAt.has(b.item.id)} p={p} people={people} />
              ))}
              {d === nowDay && (
                <NowLine
                  minutes={nowMin}
                  from={from}
                  to={to}
                  label={p.days.length === 1 ? clock : undefined}
                />
              )}
            </div>
          );
        })}
      </div>
      {nowShown && <NowStatus text={t.scNowAt(clock)} hour={Math.floor(nowMin / 60)} />}
    </div>
  );
}

const onDayAll = (slots: readonly ScheduleSlot[], day: number): ScheduleSlot[] =>
  slots.filter((s) => dayOfTs(s.start) === day);

function Block({
  item,
  lane,
  lanes,
  span,
  top,
  height,
  warn,
  p,
  people,
}: {
  item: Item;
  lane: number;
  lanes: number;
  span: number;
  top: number;
  height: number;
  /** the overlap marker (icon) of this block's cluster sits here */
  warn: boolean;
  p: WeekGridProps;
  people: People;
}) {
  const { t, locale } = p;
  const s = item.slot;
  const ghost = item.ghost;
  const clash = !ghost && p.conflicts.has(s.id);
  const moved = !ghost && s.status === 'moved';
  const state = cardStateOf(s, p.now, !!ghost);
  const live = state === 'inprogress';
  const ids = peopleOf(s);
  const title = slotTitle(s, people, t);
  const start = coachClock(ghost ? ghost.start : s.start);
  const clock = ghost ? start : slotClock(s);
  const word = ghost ? t.scProposed : clash ? t.scOverlapTag : statusWord(s, t, p.now);
  const day = dayOfTs(item.start);
  const label = t.scBlockLabel(title, longDate(day, locale), clock, word);
  const cls = [
    'sc-block',
    stateClass(state),
    `sc-block--${state}`,
    moved ? 'sc-block--moved' : '',
    warn ? 'sc-block--clash' : '',
    !ghost && dayOfTs(s.start) === dayOfTs(p.now) && s.start + s.durationMin * 60_000 <= p.now
      ? 'sc-block--past'
      : '',
    p.selected === s.id ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Card
      as="button"
      pad="none"
      tone="neutral"
      emphasis="quiet"
      className={cls}
      style={
        {
          '--sc-top': top,
          '--sc-h': height,
          '--sc-lane': lane,
          '--sc-span': span,
          '--sc-lanes': lanes,
          ...(live ? { '--sc-progress': liveProgress(s, p.now) } : {}),
        } as React.CSSProperties
      }
      title={label}
      aria-pressed={p.selected === s.id}
      aria-label={label}
      onClick={() => p.onSelect(s.id)}
    >
      {moved ? (
        <span className="sc-block-moved">
          {t.scMovedTo(s.movedTo != null ? shortWeekday(dayOfTs(s.movedTo), locale) : '')}
        </span>
      ) : (
        <span className="sc-block-in">
          <span className="sc-block-top">
            <span className="sc-avatars" aria-hidden="true">
              {ids.slice(0, MAX_AVATARS).map((id) => (
                <ClientAvatar
                  key={id}
                  id={id}
                  name={people.name(id)}
                  size={20}
                  hasPhoto={people.byId.get(id)?.hasPhoto}
                />
              ))}
              {ids.length > MAX_AVATARS && (
                <span className="sc-more">+{ids.length - MAX_AVATARS}</span>
              )}
            </span>
            <span className="sc-block-title">{title}</span>
            <span className="sc-block-state" aria-hidden="true">
              {warn && <StateMark state="overlap" />}
              {live ? (
                <span className="sc-block-now">{t.scNow}</span>
              ) : state !== 'planned' ? (
                <StateMark state={state} />
              ) : null}
            </span>
          </span>
          <span className="sc-block-foot">
            <span className="sc-block-time">
              <span className="sc-t-full">{ghost ? t.scProposedAt(start) : clock}</span>
              <span className="sc-t-start">{start}</span>
            </span>
          </span>
        </span>
      )}
    </Card>
  );
}

/** The scrolling ancestor of an element (the page body of the Coach shell, or a scroll box). */
function scrollBox(el: HTMLElement): HTMLElement | null {
  for (let q = el.parentElement; q; q = q.parentElement) {
    const y = getComputedStyle(q).overflowY;
    if ((y === 'auto' || y === 'scroll') && q.scrollHeight > q.clientHeight) return q;
  }
  return null;
}

/**
 * When the "now" line is not in this grid (another week, or no today), bring the first session of the shown days into
 * view once per range, so a tall (24 h) grid never opens on empty small hours. Does nothing when the view was scrolled.
 */
function useScrollToFirst(root: React.RefObject<HTMLElement | null>, active: boolean, key: string) {
  useEffect(() => {
    const el = root.current;
    if (!active || !el) return;
    const blocks = [...el.querySelectorAll<HTMLElement>('.sc-block')];
    if (!blocks.length) return;
    const box = scrollBox(el);
    const top = box ? box.scrollTop : window.scrollY;
    if (top > 1) return;
    const base = box ? box.getBoundingClientRect().top : 0;
    const y = Math.min(...blocks.map((b) => b.getBoundingClientRect().top)) - base + top;
    const view = box ? box.clientHeight : window.innerHeight;
    const to = Math.max(0, Math.round(y - view / 4));
    if (to === 0) return;
    if (box) box.scrollTo({ top: to, behavior: 'auto' });
    else window.scrollTo({ top: to, behavior: 'auto' });
  }, [root, active, key]);
}
