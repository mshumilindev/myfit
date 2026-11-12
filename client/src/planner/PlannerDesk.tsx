import { useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { NowLine, useMinuteClock } from '../components/ui/NowLine';
import { Segmented } from '../components/ui/Segmented';
import { WeekStepper } from '../components/ui/WeekStepper';
import { useT } from '../i18n';
import { Icon } from '../ui';
import { dayMonth, dayShort } from './fmt';
import { STRINGS } from './strings';
import type { PlanDoc } from './types';
import { localParts, type DayKey } from './zoned';

/** One plan on one day. */
export interface Occ {
  day: DayKey;
  plan: PlanDoc;
  at: number;
}
export type DeskView = 'day' | 'week' | 'month';

/** Visible hours of the grid, widened when a plan lies outside the default 06–23. */
const FROM = 6;
const TO = 23;
/** Pixels per hour, and the snap of a click in an empty slot (minutes). */
const HPX = 42;
const SNAP = 15;
const MIN_H = 44;

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const dur = (p: PlanDoc) => p.durationMin ?? 60;
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Side-by-side lanes for overlapping plans of one day: [lane, lanes in its cluster]. */
export function lanes(items: { start: number; end: number }[]): [number, number][] {
  const order = items.map((_, i) => i).sort((a, b) => items[a].start - items[b].start);
  const out: [number, number][] = items.map(() => [0, 1]);
  let cluster: number[] = [];
  let clusterEnd = -1;
  const close = () => {
    const n = Math.max(1, ...cluster.map((i) => out[i][0] + 1));
    for (const i of cluster) out[i] = [out[i][0], n];
    cluster = [];
  };
  const laneEnd: number[] = [];
  for (const i of order) {
    if (cluster.length && items[i].start >= clusterEnd) {
      close();
      laneEnd.length = 0;
      clusterEnd = -1;
    }
    let lane = laneEnd.findIndex((e) => e <= items[i].start);
    if (lane < 0) lane = laneEnd.length;
    laneEnd[lane] = items[i].end;
    out[i] = [lane, 1];
    cluster.push(i);
    clusterEnd = Math.max(clusterEnd, items[i].end);
  }
  if (cluster.length) close();
  return out;
}

/** The desktop Planner (design SPO-555, PlannerDesk): header tools, a time grid for Day / Week, the month as children. */
export function PlannerDesk(p: {
  view: DeskView;
  onView: (v: DeskView) => void;
  label: string;
  sub?: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onAdd: () => void;
  onAvailability: () => void;
  onSettings?: () => void;
  days: DayKey[];
  occ: Occ[];
  today: DayKey;
  tz: string;
  onSlot: (day: DayKey, minutes: number) => void;
  onOpen: (o: Occ) => void;
  /** The month view body (a grid + the selected day), drawn instead of the time grid. */
  children?: ReactNode;
}) {
  const { locale } = useT();
  const s = STRINGS[locale];
  const now = useMinuteClock(Date.now);
  const nowLocal = localParts(now, p.tz);
  const nowMin = minutesOf(nowLocal.time);
  const early = Math.min(FROM, ...p.occ.map((o) => Math.floor(minutesOf(o.plan.timing.time) / 60)));
  const late = Math.max(
    TO,
    ...p.occ.map((o) => Math.ceil((minutesOf(o.plan.timing.time) + dur(o.plan)) / 60)),
  );
  const g0 = early;
  const g1 = Math.min(24, late);
  const hours = Array.from({ length: g1 - g0 }, (_, i) => g0 + i);
  const cols = { gridTemplateColumns: `56px repeat(${p.days.length}, minmax(0, 1fr))` };
  const body = useRef<HTMLDivElement>(null);

  const slot = (day: DayKey, e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.pl-g-e')) return;
    const r = e.currentTarget.getBoundingClientRect();
    const raw = g0 * 60 + ((e.clientY - r.top) / HPX) * 60;
    p.onSlot(day, Math.min(23 * 60 + 45, Math.floor(raw / SNAP) * SNAP));
  };
  const key = (o: Occ, e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      p.onOpen(o);
    }
  };

  return (
    <div className="pl-desk">
      <header className="pl-page-h">
        <h1>{s.name}</h1>
        <div className="pl-desk-tools">
          <Segmented
            value={p.view}
            onChange={p.onView}
            label={s.view}
            options={[
              { value: 'day', label: s.day },
              { value: 'week', label: s.week },
              { value: 'month', label: s.month },
            ]}
          />
          <WeekStepper
            label={p.label}
            sub={p.sub}
            onPrev={p.onPrev}
            onNext={p.onNext}
            canPrev
            canNext
            prevLabel={p.view === 'month' ? s.prevMonth : p.view === 'day' ? s.prevDay : s.prevWeek}
            nextLabel={p.view === 'month' ? s.nextMonth : p.view === 'day' ? s.nextDay : s.nextWeek}
          />
          <Button variant="secondary" size="sm" onClick={p.onToday}>
            {s.todayBtn}
          </Button>
          <Button variant="secondary" size="sm" icon="clock" onClick={p.onAvailability}>
            {s.availTitle}
          </Button>
          {p.onSettings && (
            <Button
              variant="secondary"
              size="sm"
              icon="gear"
              aria-label={s.settingsTitle}
              onClick={p.onSettings}
            />
          )}
          <Button icon="plus" size="sm" onClick={p.onAdd}>
            {s.add}
          </Button>
        </div>
      </header>
      {p.view === 'month' ? (
        p.children
      ) : (
        <div
          className={`pl-g${p.days.length === 1 ? ' is-day' : ''}`}
          role="grid"
          aria-label={p.label}
        >
          <div className="pl-g-hd" style={cols}>
            <span />
            {p.days.map((d) => (
              <div key={d} className={d === p.today ? 'is-today' : ''}>
                <span>{dayShort(locale, d)}</span>
                <b>{dayMonth(locale, d).split(' ')[0]}</b>
              </div>
            ))}
          </div>
          <div className="pl-g-body" style={{ ...cols, height: hours.length * HPX }} ref={body}>
            <div className="pl-g-hrs">
              {hours.map((h) => (
                <span key={h} style={{ top: (h - g0) * HPX }}>
                  {hh(h)}
                </span>
              ))}
            </div>
            {p.days.map((d) => {
              const es = p.occ.filter((o) => o.day === d);
              const ln = lanes(
                es.map((o) => {
                  const a = minutesOf(o.plan.timing.time);
                  return { start: a, end: a + Math.max(dur(o.plan), (MIN_H / HPX) * 60) };
                }),
              );
              return (
                <div
                  key={d}
                  className={`pl-g-col${d === p.today ? ' is-today' : ''}`}
                  role="gridcell"
                  aria-label={dayMonth(locale, d)}
                  onClick={(e) => slot(d, e)}
                >
                  {hours.map((h) => (
                    <i key={h} style={{ top: (h - g0) * HPX }} />
                  ))}
                  {es.map((o, i) => {
                    const [lane, of] = ln[i];
                    const start = minutesOf(o.plan.timing.time);
                    return (
                      <div
                        key={`${o.plan.id}:${o.day}`}
                        className={`pl-g-e uit--${o.plan.color}`}
                        role="button"
                        tabIndex={0}
                        style={{
                          top: ((start - g0 * 60) / 60) * HPX,
                          height: Math.max(MIN_H, (dur(o.plan) / 60) * HPX - 3),
                          left: `calc(${(lane / of) * 100}% + 4px)`,
                          right: `calc(${((of - lane - 1) / of) * 100}% + 4px)`,
                        }}
                        onClick={() => p.onOpen(o)}
                        onKeyDown={(e) => key(o, e)}
                      >
                        <Icon name={o.plan.icon} />
                        <span>
                          <b>{o.plan.title}</b>
                          <i>{o.plan.timing.time}</i>
                        </span>
                      </div>
                    );
                  })}
                  {d === nowLocal.day && (
                    <NowLine minutes={nowMin} from={g0 * 60} to={g1 * 60} label={nowLocal.time} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
