/**
 * Health history (F07 list, F08 timeline; W01 right pane, W03 list): rest,
 * illness and injury periods with type filters and a "List | Timeline" switch.
 * The list edits (tap) and deletes (swipe left, confirmed); the timeline is
 * view-only — a vertical rail with a "Now" marker and concurrent periods side
 * by side. Sleep is not on it (it has its own history).
 */
import {
  Fragment,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from 'react';
import { useT } from '../../i18n';
import { dayKey, deleteInjury, deleteRestPeriod, useStore } from '../../store';
import {
  dayOfTs,
  dayToTs,
  healthItems,
  timelineRows,
  type HealthItem,
  type HealthKind,
} from '../../health';
import { ConfirmDialog } from '../../ui';
import { ListRow, GroupedList } from '../../components/ui/GroupedList';
import { PresetChips } from '../../components/ui/PresetChips';
import { Segmented } from '../../components/ui/Segmented';
import { Timeline, TimelineDate, type TimelineRowSpec } from '../../components/ui/Timeline';
import { ToneText } from '../../components/ui/ToneText';
import { toneClass, type Tone as KitTone } from '../../components/ui/tones';
import {
  Ic,
  KIT_TONE,
  Svg,
  STAGE_TOTAL,
  fmtDM,
  fmtDMY,
  fmtMonth,
  fmtMonthYear,
  fmtRange,
  fmtWd,
  iconOf,
  itemLabel,
  stageNo,
  itemTone,
  typeName,
} from './parts';

export type HistFilter = 'all' | HealthKind;

export function useHealthItems(now: number): HealthItem[] {
  const store = useStore();
  return healthItems(store.restPeriods, store.injuries, dayKey(now));
}

export function HistControls(props: {
  mode: 'list' | 'timeline';
  filter: HistFilter;
  onMode: (m: 'list' | 'timeline') => void;
  onFilter: (f: HistFilter) => void;
}) {
  const { t } = useT();
  const dots: Record<HistFilter, KitTone[]> = {
    all: [],
    rest: ['rest', 'active'],
    illness: ['illness'],
    injury: ['injury'],
  };
  return (
    <>
      <Segmented
        label={t.hlViewAria}
        value={props.mode}
        onChange={props.onMode}
        options={[
          { value: 'list', label: t.hlListView },
          { value: 'timeline', label: t.hlTimelineView },
        ]}
      />
      <PresetChips
        label={t.hlFilterAria}
        tone="neutral"
        layout="wrap"
        items={(['all', 'rest', 'illness', 'injury'] as const).map((f) => ({
          id: f,
          selected: props.filter === f,
          onClick: () => props.onFilter(f),
          label: (
            <>
              {dots[f].map((d) => (
                <span key={d} className={`hl-dot ${toneClass(d)}`} aria-hidden="true" />
              ))}
              {t.hlFilter[f]}
            </>
          ),
        }))}
      />
    </>
  );
}

/** Row sub-line: "Unwell · 7 days", "Unwell · day 3", "Rehab · stage 2 of 4". */
function itemSub(it: HealthItem, today: number, t: ReturnType<typeof useT>['t']): string {
  if (it.injury) {
    if (it.ongoing) return t.hlRehabStage(stageNo(it.injury), STAGE_TOTAL);
    return t.hlTypeDays(t.hlFilter.injury, it.endDay - it.startDay + 1);
  }
  const type = typeName(it.mode!, t);
  if (it.ongoing && it.period?.open) return t.hlTypeDayN(type, today - it.startDay + 1);
  return t.hlTypeDays(type, it.endDay - it.startDay + 1);
}

export function HistoryList(props: {
  now: number;
  filter: HistFilter;
  web: boolean;
  selectedId?: string | null;
  onOpen: (it: HealthItem) => void;
}) {
  const { t, locale } = useT();
  const today = dayKey(props.now);
  const items = useHealthItems(props.now).filter(
    (i) => props.filter === 'all' || i.kind === props.filter,
  );
  const [swiped, setSwiped] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<HealthItem | null>(null);

  const now = items.filter((i) => i.ongoing);
  const later = items.filter((i) => i.future).sort((a, b) => a.startDay - b.startDay);
  const past = items.filter((i) => !i.ongoing && !i.future).sort((a, b) => b.startDay - a.startDay);
  const months: { key: number; ts: number; items: HealthItem[] }[] = [];
  for (const it of past) {
    const d = new Date(dayToTs(it.startDay));
    const key = d.getFullYear() * 12 + d.getMonth();
    const last = months[months.length - 1];
    if (last && last.key === key) last.items.push(it);
    else months.push({ key, ts: d.getTime(), items: [it] });
  }

  const row = (it: HealthItem) => {
    const label = itemLabel(it, t);
    const tone = itemTone(it);
    const val = it.ongoing
      ? t.hlRangeNow(fmtDM(it.startDay, locale, today))
      : fmtRange(it.startDay, it.endDay, locale, today);
    const sel = props.selectedId === it.id;
    const btn = (
      <ListRow
        icon={<Ic tone={tone} name={iconOf(it.kind === 'injury' ? 'injury' : it.mode!)} />}
        label={label}
        sub={<ToneText tone={KIT_TONE[tone]}>{itemSub(it, today, t)}</ToneText>}
        value={val}
        chevron
        selected={sel}
        aria-current={sel ? 'true' : undefined}
        onClick={() => (swiped === it.id ? setSwiped(null) : props.onOpen(it))}
      />
    );
    if (props.web) return <Fragment key={it.id}>{btn}</Fragment>;
    return (
      <SwipeRow
        key={it.id}
        open={swiped === it.id}
        onOpen={(o) => setSwiped(o ? it.id : null)}
        label={label}
        onEdit={() => {
          setSwiped(null);
          props.onOpen(it);
        }}
        onDelete={() => setConfirm(it)}
      >
        {btn}
      </SwipeRow>
    );
  };

  const group = (key: string, head: string, list: HealthItem[]) =>
    list.length > 0 ? (
      <GroupedList key={key} header={head}>
        {list.map(row)}
      </GroupedList>
    ) : null;

  const confirmName = confirm ? itemLabel(confirm, t) : '';
  return (
    <>
      {group('now', t.hlNow, now)}
      {group('later', t.hlComingUp, later)}
      {months.map((m) => {
        const d = new Date(m.ts);
        return group(`m${m.key}`, fmtMonthYear(d.getFullYear(), d.getMonth(), locale), m.items);
      })}
      <p className="hl-note">
        {items.length === 0 ? t.hlNoHistory : props.web ? t.hlListFootWeb : t.hlListFoot}
      </p>
      {confirm && (
        <ConfirmDialog
          title={confirm.injury ? t.hlDeleteInjury : t.hlDeletePeriod}
          body={
            confirm.injury
              ? t.hlDeleteInjuryBody(confirmName)
              : t.hlDeleteBody(
                  confirmName,
                  fmtRange(confirm.startDay, confirm.endDay, locale, today),
                  confirm.endDay - confirm.startDay + 1,
                )
          }
          confirmLabel={t.delete}
          cancelLabel={t.hlKeepIt}
          danger
          onConfirm={() => {
            if (confirm.injury) deleteInjury(confirm.id);
            else deleteRestPeriod(confirm.id);
            setConfirm(null);
            setSwiped(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

/** A list row that slides left to reveal Edit / Delete (F07). */
function SwipeRow(props: {
  open: boolean;
  onOpen: (open: boolean) => void;
  label: string;
  onEdit: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const { t } = useT();
  const start = useRef<{ x: number; y: number } | null>(null);
  const down = (e: RPointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
  };
  const up = (e: RPointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = Math.abs(e.clientY - s.y);
    if (Math.abs(dx) < 40 || dy > Math.abs(dx)) return;
    props.onOpen(dx < 0);
  };
  return (
    <div
      className={`hl-swipe${props.open ? ' open' : ''}`}
      data-no-edge-swipe=""
      onPointerDown={down}
      onPointerUp={up}
    >
      {props.children}
      <button
        type="button"
        className="hl-swb edit"
        aria-label={t.hlEditAria(props.label)}
        tabIndex={props.open ? 0 : -1}
        onClick={props.onEdit}
      >
        <Svg name="pencil" />
        {t.edit}
      </button>
      <button
        type="button"
        className="hl-swb del"
        aria-label={t.hlDeleteAria(props.label)}
        tabIndex={props.open ? 0 : -1}
        onClick={props.onDelete}
      >
        <Svg name="trash" />
        {t.delete}
      </button>
    </div>
  );
}

/** The view-only timeline (F08, W01 right pane). */
export function HistoryTimeline(props: { now: number; filter: HistFilter; web: boolean }) {
  const { t, locale } = useT();
  const store = useStore();
  const today = dayKey(props.now);
  const items = useHealthItems(props.now).filter(
    (i) => props.filter === 'all' || i.kind === props.filter,
  );
  const firstWorkout = store.workouts.reduce<number | null>(
    (m, w) => (w.finishedAt !== null && (m === null || w.startedAt < m) ? w.startedAt : m),
    null,
  );
  const earliest = Math.min(
    ...items.map((i) => i.startDay),
    firstWorkout !== null ? dayOfTs(firstWorkout) : Infinity,
  );
  const origin = Number.isFinite(earliest) ? earliest : null;
  const rows = timelineRows(items, today, origin);
  const kt = (it: HealthItem) => KIT_TONE[itemTone(it)];
  const dayCol = (a: number, b: number) => {
    const d = (x: number) => new Date(dayToTs(x)).getDate();
    return (
      <TimelineDate
        day={d(b)}
        weekday={fmtWd(b, locale)}
        startDay={a !== b ? d(a) : undefined}
        startWeekday={a !== b ? fmtWd(a, locale) : undefined}
      />
    );
  };
  const specs: TimelineRowSpec[] = [];
  rows.forEach((row, i) => {
    switch (row.kind) {
      case 'later':
        if (row.items.length === 0)
          specs.push({
            key: `l${i}`,
            kind: 'gap',
            date: <TimelineDate text={t.hlLater} />,
            rail: 'dashed',
            label: t.hlNothingPlanned,
          });
        for (const it of row.items)
          specs.push({
            key: `f${it.id}`,
            date: dayCol(it.startDay, it.endDay),
            rail: 'dashed',
            bars: [{ tone: kt(it), lane: 'single', faded: true }],
            label: itemLabel(it, t),
            sub: <ToneText tone={kt(it)}>{itemSub(it, today, t)}</ToneText>,
            value: fmtRange(it.startDay, it.endDay, locale, today),
          });
        break;
      case 'now': {
        const cur = items.filter((x) => x.ongoing).slice(0, 2);
        specs.push({
          key: `n${i}`,
          date: <TimelineDate text={t.hlNow} emphasis />,
          rail: 'now',
          bars: cur.map((c, k) => ({
            tone: kt(c),
            lane: cur.length > 1 ? (k as 0 | 1) : 'single',
            top: 'mid',
            bottom: 'edge',
          })),
          label: fmtDayLong(today, locale),
          strong: true,
          value: row.count > 0 ? t.hlNActive(row.count) : undefined,
        });
        break;
      }
      case 'item': {
        const it = row.item;
        const lane = row.lane === null ? 'single' : row.lane;
        const pass = row.lane === 0 ? 1 : 0;
        const kept = it.period
          ? store.workouts.filter(
              (w) =>
                w.finishedAt !== null &&
                it.mode !== 'active' &&
                dayOfTs(w.startedAt) >= it.startDay &&
                dayOfTs(w.startedAt) <= it.endDay,
            )
          : [];
        let sub = itemSub(it, today, t);
        if (it.injury && it.ongoing) sub = t.hlRehabStageName(t.injStage[it.injury.stage] ?? '');
        if (it.period?.open && it.ongoing) sub = t.hlDayNoEnd(today - it.startDay + 1);
        specs.push({
          key: `i${i}`,
          date: dayCol(it.startDay, it.endDay),
          rail: 'solid',
          bars: [
            ...row.through.map((k) => ({
              tone: kt(k),
              lane: pass as 0 | 1,
              top: 'edge' as const,
              bottom: 'edge' as const,
            })),
            { tone: kt(it), lane, top: row.topFlat ? 'edge' : 'inset', bottom: 'inset' },
          ],
          label: itemLabel(it, t),
          sub: (
            <>
              <ToneText tone={kt(it)}>{sub}</ToneText>
              {kept.length > 0 &&
                ` · ${t.hlWorkoutKept(fmtDM(dayOfTs(kept[0].startedAt), locale, today))}`}
            </>
          ),
          value: it.ongoing
            ? `${fmtDM(it.startDay, locale, today)} →`
            : fmtRange(it.startDay, it.endDay, locale, today),
        });
        break;
      }
      case 'month':
        specs.push({ key: `m${i}`, kind: 'month', label: fmtMonth(row.ts, locale) });
        break;
      case 'gap':
        specs.push({
          key: `g${i}`,
          kind: 'gap',
          date: <TimelineDate text={fmtDM(row.from, locale, today)} />,
          label:
            row.from === row.to
              ? t.hlFreeDay
              : t.hlFreeRange(fmtRange(row.from, row.to, locale, today)),
        });
        break;
      case 'origin':
        if (row.day !== null)
          specs.push({
            key: `o${i}`,
            kind: 'gap',
            date: <TimelineDate text={fmtMonthShort(row.day, locale)} />,
            rail: 'origin',
            label: t.hlStartOfLog(fmtDMY(row.day, locale)),
          });
        break;
    }
  });
  return (
    <div className="hl-sec">
      <Timeline rows={specs} label={t.hlTimelineView} />
      <p className="hl-note">{props.web ? t.hlTlFootWeb : t.hlTlFoot}</p>
    </div>
  );
}

function fmtDayLong(day: number, locale: ReturnType<typeof useT>['locale']): string {
  return `${fmtWd(day, locale)} ${fmtDM(day, locale, day)}`;
}

function fmtMonthShort(day: number, locale: ReturnType<typeof useT>['locale']): string {
  return fmtMonth(dayToTs(day), locale).slice(0, 3);
}
