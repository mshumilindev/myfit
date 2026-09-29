/**
 * Cardio widgets (design board L8 "Cardio & gyms", cardio half): distance,
 * the last outdoor route, run pace, machine cardio, active minutes, the
 * favourite sport, recovery rituals and activity calories. Everything is
 * computed from logged activities (activities.ts) and the cardio entries of
 * gym sessions (cardio.ts) — no fake numbers; empty states invite a log.
 */
import {
  Widget,
  WidgetBar,
  WidgetBars,
  WidgetDelta,
  WidgetList,
  WidgetRing,
  WidgetSpark,
  WidgetStats,
  WidgetEmpty,
} from '../../components/ui/Widget';
import { Button } from '../../components/ui/Button';
import { IconTile } from '../../components/ui/IconTile';
import type { Tone } from '../../components/ui/tones';
import { dayOfTimestamp } from '../../components/ui/calendarDays';
import {
  activityCalories,
  activityCategory,
  activityTone,
  activityType,
  durationMin,
} from '../../activities';
import { cardioMachineOf, cardioProfile, timedEntryKcal } from '../../cardio';
import {
  latestWeight,
  workoutCardioDistanceKm,
  workoutCardioMinutes,
  type StoreState,
} from '../../store';
import { EQUIPMENT_CATALOG, type EquipmentItem } from '../../data/equipmentCatalog';
import { localizedEquipName } from '../../data/equipmentI18n';
import { weekStartOf, isoWeekday } from '../../weekStart';
import { fmtDayMonth, fmtWeekdayShort, getLocale, type LocaleId } from '../../i18n';
import type { Strings } from '../../i18n/en';
import type { Activity, Exercise, Workout } from '../../types';
import type { WidgetCtx, WidgetDef } from '../registry';
import { DAY, signed } from './format';
import { cds, type CardioStrings } from './cardio.strings';

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const INTL: Record<LocaleId, string> = {
  en: 'en-US',
  uk: 'uk-UA',
  pl: 'pl-PL',
  lt: 'lt-LT',
  et: 'et-EE',
};

/** 1860 → "1 860". */
function fmtInt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Seconds → "5:12". */
function fmtMinSec(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Minutes → "27:04" / "1:05:10". */
function fmtDur(min: number): string {
  const s = Math.max(0, Math.round(min * 60));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

/** Minutes → "7h 10m" / "45m". */
function fmtHM(min: number): string {
  const r = Math.round(min);
  const h = Math.floor(r / 60);
  return h > 0 ? `${h}h ${String(r % 60).padStart(2, '0')}m` : `${r}m`;
}

function actName(t: Strings, key: string): string {
  return t.actType[key] ?? key;
}

function actIcon(key: string): string {
  return activityType(key)?.icon ?? 'heartbeat';
}

function actTone(a: Pick<Activity, 'type' | 'category'>): Tone {
  const k = activityTone(a.type, a.category);
  return k === 'sport' ? 'sport' : k === 'recovery' ? 'rest' : 'active';
}

function done(store: StoreState): Activity[] {
  return store.activities.filter((a) => a.finishedAt !== null);
}

function finishedWorkouts(store: StoreState): Workout[] {
  return store.workouts.filter((w) => w.finishedAt !== null);
}

/** "Today 07:40" / "Yesterday" / "Tue" / "22 Sep". */
function when(ts: number, now: number, s: CardioStrings, locale: LocaleId, clock = false): string {
  const diff = dayOfTimestamp(now) - dayOfTimestamp(ts);
  const d = new Date(ts);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const base =
    diff <= 0
      ? s.today
      : diff === 1
        ? s.yesterday
        : diff < 7
          ? fmtWeekdayShort(ts, locale)
          : fmtDayMonth(ts, locale);
  return clock && diff <= 1 ? `${base} ${hm}` : base;
}

interface Week {
  ws: number;
  prev: number;
  /** 0…6 position of a timestamp in the current week. */
  idx: (ts: number) => number;
  labels: string[];
  range: string;
}

function week(now: number, locale: LocaleId): Week {
  const ws = weekStartOf(now);
  const prev = weekStartOf(ws - 1);
  const first = dayOfTimestamp(ws);
  const labels = Array.from({ length: 7 }, (_, i) =>
    fmtWeekdayShort(ws + i * DAY + 12 * 3600 * 1000, locale).slice(0, 2),
  );
  const range = `${fmtDayMonth(ws, locale)} – ${fmtDayMonth(ws + 6 * DAY + 12 * 3600 * 1000, locale)}`;
  return { ws, prev, idx: (ts) => dayOfTimestamp(ts) - first, labels, range };
}

function monthShort(ts: number, locale: LocaleId): string {
  const s = new Intl.DateTimeFormat(INTL[locale], { month: 'short' }).format(new Date(ts));
  return s.charAt(0).toUpperCase() + s.slice(1).replace('.', '');
}

/** Rows of a Map<type, value>, biggest first. */
function sortedEntries<V>(m: Map<string, V>, by: (v: V) => number): [string, V][] {
  return [...m.entries()].sort((a, b) => by(b[1]) - by(a[1]));
}

function openLog(ctx: WidgetCtx, cat?: 'conditioning' | 'sport' | 'recovery') {
  ctx.shell.openOverlay({ screen: 'log-activity', cat });
}

function openHistory(ctx: WidgetCtx) {
  ctx.shell.openOverlay({ screen: 'history' });
}

/** Empty card in every size — the kit's WidgetEmpty. */
function Empty({
  size,
  tone,
  icon,
  kicker,
  title,
  sub,
  action,
  onAction,
}: {
  size: 'S' | 'M' | 'L' | 'XL';
  tone: Tone;
  icon: string;
  kicker: string;
  title: string;
  sub?: string;
  action?: string;
  onAction: () => void;
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
      onAction={onAction}
    />
  );
}

/* ---------------------------------------------------------------------------
 * Distance this week
 * ------------------------------------------------------------------------- */

const GYM_KEY = '__gym';

function distanceData(store: StoreState, now: number, wk: Week) {
  const byType = new Map<string, number>();
  const days = Array.from({ length: 7 }, () => 0);
  let cur = 0;
  let last = 0;
  let ever = false;
  const add = (key: string, km: number, ts: number) => {
    if (km <= 0) return;
    ever = true;
    if (ts >= wk.ws && ts <= now) {
      cur += km;
      byType.set(key, (byType.get(key) ?? 0) + km);
      const i = wk.idx(ts);
      if (i >= 0 && i < 7) days[i] += km;
    } else if (ts >= wk.prev && ts < wk.ws) last += km;
  };
  for (const a of done(store)) add(a.type, a.distanceKm ?? 0, a.startedAt);
  for (const w of finishedWorkouts(store)) add(GYM_KEY, workoutCardioDistanceKm(w), w.startedAt);
  return { byType: sortedEntries(byType, (v) => v), days, cur, last, ever };
}

const distance: WidgetDef = {
  id: 'distance-week',
  group: 'cardio',
  icon: 'path',
  tone: 'sport',
  name: () => cds(getLocale()).distanceWeek,
  render: (size, ctx) => {
    const { store, now, t, locale } = ctx;
    const s = cds(locale);
    const wk = week(now, locale);
    const d = distanceData(store, now, wk);
    const log = () => openLog(ctx, 'conditioning');
    if (!d.ever)
      return (
        <Empty
          size={size}
          tone="sport"
          icon="path"
          kicker={s.thisWeek}
          title={s.noDistance}
          sub={s.distanceHint}
          action={s.logActivity}
          onAction={log}
        />
      );
    const open = () => openHistory(ctx);
    const label = (k: string) => (k === GYM_KEY ? s.gymCardio : actName(t, k));
    const km = d.cur.toFixed(1);
    const diff = d.cur - d.last;
    const deltaTxt = `${signed(diff)} km`;
    const delta = <WidgetDelta good={diff >= 0}>{s.vsLastWeek(deltaTxt)}</WidgetDelta>;
    const split = d.byType
      .slice(0, 3)
      .map(([k, v]) => `${label(k)} ${v.toFixed(1)}`)
      .join(' · ');
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="sport"
          kicker={s.thisWeek}
          value={km}
          unit="km"
          sub={delta}
          onClick={open}
        />
      );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="sport"
          icon="path"
          title={s.kmThisWeek(km)}
          sub={split || s.vsLastWeek(deltaTxt)}
          onClick={open}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="sport"
          kicker={s.distanceKicker}
          badge={<WidgetDelta good={diff >= 0}>{deltaTxt}</WidgetDelta>}
          value={km}
          unit="km"
          bodyLast
          onClick={open}
        >
          {d.byType.length > 0 && (
            <WidgetStats
              items={d.byType
                .slice(0, 3)
                .map(([k, v]) => ({ label: label(k), value: v.toFixed(1) }))}
            />
          )}
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="sport"
        kicker={s.distanceRange(wk.range)}
        badge={<WidgetDelta good={diff >= 0}>{deltaTxt}</WidgetDelta>}
        value={km}
        unit="km"
        sub={s.lastWeek(d.last.toFixed(1))}
        bodyLast
        onClick={open}
        footer={
          <Button variant="primary" size="sm" icon="plus" onClick={log}>
            {s.logActivity}
          </Button>
        }
      >
        <WidgetBars
          tone="sport"
          values={d.days}
          highlight={[wk.idx(now)]}
          labels={wk.labels}
          height={70}
        />
        <WidgetList
          rows={d.byType.slice(0, 3).map(([k, v]) => ({
            icon: k === GYM_KEY ? 'barbell' : actIcon(k),
            tone: 'sport' as Tone,
            label: label(k),
            value: `${v.toFixed(1)} km`,
          }))}
        />
      </Widget>
    );
  },
};

/* ---------------------------------------------------------------------------
 * Last route (the last distance activity outdoors)
 * ------------------------------------------------------------------------- */

const SPEED_TYPES = new Set(['cycle', 'ski']);

function routeMetric(a: Activity): { value: string; unit: string } | null {
  const km = a.distanceKm ?? 0;
  const min = durationMin(a);
  if (km <= 0 || min <= 0) return null;
  if (SPEED_TYPES.has(a.type)) return { value: (km / (min / 60)).toFixed(1), unit: 'km/h' };
  return { value: fmtMinSec((min * 60) / km), unit: '/km' };
}

function routes(store: StoreState): Activity[] {
  return done(store)
    .filter((a) => (a.distanceKm ?? 0) > 0 && activityType(a.type)?.tracksDistance)
    .sort((a, b) => b.startedAt - a.startedAt);
}

const lastRoute: WidgetDef = {
  id: 'last-route',
  group: 'cardio',
  icon: 'map-pin',
  tone: 'sport',
  name: () => cds(getLocale()).lastRoute,
  render: (size, ctx) => {
    const { store, now, t, locale } = ctx;
    const s = cds(locale);
    const list = routes(store);
    const a = list[0];
    if (!a)
      return (
        <Empty
          size={size}
          tone="sport"
          icon="map-pin"
          kicker={s.lastRoute}
          title={s.noRoute}
          sub={s.distanceHint}
          action={s.logActivity}
          onAction={() => openLog(ctx, 'conditioning')}
        />
      );
    const open = () => ctx.shell.openOverlay({ screen: 'activity', editId: a.id });
    const name = actName(t, a.type);
    const km = (a.distanceKm ?? 0).toFixed(1);
    const dur = fmtDur(durationMin(a));
    const m = routeMetric(a);
    const metric = m ? `${m.value} ${m.unit}` : '';
    const whenTxt = when(a.startedAt, now, s, locale, true);
    const kicker = `${name} · ${whenTxt}`;
    const icon = actIcon(a.type);
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="sport"
          kicker={kicker}
          value={km}
          unit="km"
          sub={[metric, dur].filter(Boolean).join(' · ')}
          onClick={open}
        />
      );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="sport"
          icon={icon}
          title={`${name} · ${km} km · ${dur}`}
          sub={[whenTxt, metric].filter(Boolean).join(' · ')}
          onClick={open}
        />
      );
    const kcal = a.calories ?? activityCalories(a, latestWeight(store.bodyMetrics)?.weight);
    const stats = [
      { label: s.distance, value: `${km} km` },
      { label: s.time, value: dur },
      ...(m ? [{ label: SPEED_TYPES.has(a.type) ? s.speed : s.pace, value: metric }] : []),
    ];
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="sport"
          kicker={kicker}
          value={km}
          unit="km"
          sub={a.note || undefined}
          bodyLast
          onClick={open}
        >
          <WidgetStats items={stats} />
        </Widget>
      );
    const earlier = list.slice(1, 4).map((x) => {
      const xm = routeMetric(x);
      return {
        icon: actIcon(x.type),
        tone: 'sport' as Tone,
        label: `${actName(t, x.type)} · ${when(x.startedAt, now, s, locale)}`,
        value: `${(x.distanceKm ?? 0).toFixed(1)} km${xm ? ` · ${xm.value} ${xm.unit}` : ''}`,
      };
    });
    return (
      <Widget
        size="XL"
        tone="sport"
        kicker={s.lastRouteKicker(name)}
        badge={whenTxt}
        onClick={open}
        footer={
          <Button
            variant="primary"
            size="sm"
            icon="plus"
            onClick={() => openLog(ctx, 'conditioning')}
          >
            {s.logActivity}
          </Button>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconTile tone="sport" size={48} icon={icon} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {km}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                  marginLeft: 3,
                }}
              >
                km
              </span>
            </div>
            {a.note && (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {a.note}
              </div>
            )}
          </div>
        </div>
        <WidgetStats
          items={[...stats, ...(kcal ? [{ label: s.burned, value: `${fmtInt(kcal)} kcal` }] : [])]}
        />
        {earlier.length > 0 && <WidgetList rows={earlier} />}
      </Widget>
    );
  },
};

/* ---------------------------------------------------------------------------
 * Pace trend (runs)
 * ------------------------------------------------------------------------- */

const paceTrend: WidgetDef = {
  id: 'pace-trend',
  group: 'cardio',
  icon: 'gauge',
  tone: 'sport',
  name: () => cds(getLocale()).paceTrend,
  render: (size, ctx) => {
    const { store, now, locale } = ctx;
    const s = cds(locale);
    const runs = done(store)
      .filter((a) => a.type === 'run' && (a.distanceKm ?? 0) > 0 && durationMin(a) > 0)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 6);
    if (runs.length < 2)
      return (
        <Empty
          size={size}
          tone="sport"
          icon="gauge"
          kicker={s.paceTrend}
          title={s.noRuns}
          action={s.logRun}
          onAction={() => openLog(ctx, 'conditioning')}
        />
      );
    const pace = (a: Activity) => (durationMin(a) * 60) / (a.distanceKm ?? 1);
    const paces = runs.map(pace);
    const lastPace = paces[0];
    const firstPace = paces[paces.length - 1];
    const gain = Math.round(firstPace - lastPace);
    const good = gain >= 0;
    const n = runs.length;
    const value = fmtMinSec(lastPace);
    const short = good ? s.faster(Math.abs(gain)) : s.slower(Math.abs(gain));
    const long = good ? s.fasterOver(Math.abs(gain), n) : s.slowerOver(Math.abs(gain), n);
    const badge = (
      <WidgetDelta good={good}>{`${good ? '−' : '+'}${fmtMinSec(Math.abs(gain))} /km`}</WidgetDelta>
    );
    const open = () => openHistory(ctx);
    const spark = (h: number) => (
      <WidgetSpark tone="sport" points={[...paces].reverse().map((p) => -p)} height={h} area />
    );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="sport"
          kicker={s.paceRuns(n)}
          value={value}
          unit="/km"
          sub={<WidgetDelta good={good}>{short}</WidgetDelta>}
          onClick={open}
        >
          {spark(34)}
        </Widget>
      );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="sport"
          icon="gauge"
          title={`${value} /km ${s.lastRun}`}
          sub={long}
          onClick={open}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="sport"
          kicker={s.paceLastN(n)}
          badge={badge}
          value={value}
          unit="/km"
          bodyLast
          onClick={open}
        >
          {spark(44)}
        </Widget>
      );
    const avg = paces.reduce((x, y) => x + y, 0) / n;
    const best = Math.min(...paces);
    return (
      <Widget
        size="XL"
        tone="sport"
        kicker={s.paceLastN(n)}
        badge={badge}
        value={value}
        unit="/km"
        sub={s.avg(`${fmtMinSec(avg)} /km`)}
        bodyLast
        onClick={open}
        footer={
          <Button
            variant="primary"
            size="sm"
            icon="plus"
            onClick={() => openLog(ctx, 'conditioning')}
          >
            {s.logRun}
          </Button>
        }
      >
        {spark(90)}
        <WidgetList
          rows={runs.slice(0, 3).map((r, i) => ({
            label: `${when(r.startedAt, now, s, locale)} · ${(r.distanceKm ?? 0).toFixed(1)} km`,
            value: `${fmtMinSec(paces[i])} /km${paces[i] === best ? ` · ${s.best}` : ''}`,
          }))}
        />
      </Widget>
    );
  },
};

/* ---------------------------------------------------------------------------
 * Cardio machine (gym session cardio entries)
 * ------------------------------------------------------------------------- */

let equipById: Map<string, EquipmentItem> | null = null;
function equipItem(id: string): EquipmentItem | undefined {
  if (!equipById) equipById = new Map(EQUIPMENT_CATALOG.map((e) => [e.id, e]));
  return equipById.get(id);
}

interface MachineSession {
  w: Workout;
  ex: Exercise;
  key: string;
  name: string;
  min: number;
  km: number;
  kcal: number;
  metric: { text: string; unit: string; raw: number; lowerBetter: boolean };
}

function machineSessions(store: StoreState, locale: LocaleId): MachineSession[] {
  const kg = latestWeight(store.bodyMetrics)?.weight ?? null;
  const out: MachineSession[] = [];
  const ws = finishedWorkouts(store)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 60);
  for (const w of ws) {
    for (const ex of w.exercises) {
      if (ex.kind !== 'cardio') continue;
      const sets = ex.sets.filter((x) => (x.durationMin ?? 0) > 0);
      if (sets.length === 0) continue;
      const min = sets.reduce((n, x) => n + (x.durationMin ?? 0), 0);
      const km = sets.reduce((n, x) => n + Math.max(0, x.distanceKm ?? 0), 0);
      const kcal = sets.reduce((n, x) => n + (timedEntryKcal(ex, x, kg) ?? 0), 0);
      const wattsSets = sets.filter((x) => (x.watts ?? 0) > 0);
      const watts = wattsSets.length
        ? wattsSets.reduce((n, x) => n + (x.watts ?? 0), 0) / wattsSets.length
        : 0;
      const id = cardioMachineOf(ex);
      const p = cardioProfile(ex);
      const item = id ? equipItem(id) : undefined;
      const name = item ? localizedEquipName(item, locale) : ex.name;
      let metric: MachineSession['metric'];
      if (km > 0 && p.fields[0] === 'distance' && p.fields.includes('watts')) {
        const sec = (min * 60) / (km * 2);
        metric = { text: fmtMinSec(sec), unit: '/500m', raw: sec, lowerBetter: true };
      } else if (km > 0 && p.formula === 'treadmill') {
        const v = km / (min / 60);
        metric = { text: v.toFixed(1), unit: 'km/h', raw: v, lowerBetter: false };
      } else if (watts > 0) {
        metric = { text: String(Math.round(watts)), unit: 'W', raw: watts, lowerBetter: false };
      } else if (km > 0) {
        metric = { text: km.toFixed(1), unit: 'km', raw: km, lowerBetter: false };
      } else {
        metric = { text: fmtHM(min), unit: '', raw: min, lowerBetter: false };
      }
      out.push({ w, ex, key: id ?? ex.name.toLowerCase(), name, min, km, kcal, metric });
    }
  }
  return out;
}

const cardioMachine: WidgetDef = {
  id: 'cardio-machine',
  group: 'cardio',
  icon: 'wave-sine',
  tone: 'accent',
  name: () => cds(getLocale()).cardioMachine,
  render: (size, ctx) => {
    const { store, now, locale, shell } = ctx;
    const s = cds(locale);
    const all = machineSessions(store, locale);
    const m = all[0];
    if (!m)
      return (
        <Empty
          size={size}
          tone="accent"
          icon="wave-sine"
          kicker={s.cardioMachine}
          title={s.noMachine}
          sub={s.noMachineHint}
          action={s.startCardio}
          onAction={shell.openStart}
        />
      );
    const open = () => shell.openOverlay({ screen: 'past-workout', workoutId: m.w.id });
    const whenTxt = when(m.w.startedAt, now, s, locale);
    const gym = store.gyms.find((g) => g.id === m.w.gymId)?.name;
    const same = all.filter((x) => x.key === m.key);
    const pb =
      same.length >= 2 &&
      same.every((x) =>
        m.metric.lowerBetter ? m.metric.raw <= x.metric.raw : m.metric.raw >= x.metric.raw,
      );
    const dist = m.km > 0 ? `${fmtInt(m.km * 1000)} m` : null;
    const kcal = m.kcal > 0 ? `${fmtInt(m.kcal)} kcal` : null;
    const mt = `${m.metric.text}${m.metric.unit ? ` ${m.metric.unit}` : ''}`;
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={`${m.name} · ${whenTxt}`}
          value={m.metric.text}
          unit={m.metric.unit || undefined}
          sub={[dist, kcal].filter(Boolean).join(' · ') || fmtDur(m.min)}
          onClick={open}
        />
      );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="wave-sine"
          title={`${m.name} · ${mt}`}
          sub={[whenTxt, dist, fmtDur(m.min), kcal].filter(Boolean).join(' · ')}
          onClick={open}
        />
      );
    const kicker = `${m.name} · ${whenTxt}${gym ? ` ${s.atGym(gym)}` : ''}`;
    const stats = (
      <WidgetStats
        items={[
          { label: s.pace, value: mt },
          { label: dist ? s.distance : s.time, value: dist ?? fmtDur(m.min) },
          ...(kcal ? [{ label: s.burned, value: kcal }] : []),
        ]}
      />
    );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="accent"
          kicker={kicker}
          badge={pb ? s.pbPace : undefined}
          onClick={open}
        >
          <div style={{ flex: 1 }} />
          {stats}
        </Widget>
      );
    const trend = same.slice(0, 5).reverse();
    const others = all.slice(1, 4).map((x) => ({
      label: `${x.name} · ${when(x.w.startedAt, now, s, locale)}`,
      value: [x.km > 0 ? `${fmtInt(x.km * 1000)} m` : null, fmtDur(x.min)]
        .filter(Boolean)
        .join(' · '),
    }));
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={kicker}
        badge={pb ? s.pbPace : undefined}
        onClick={open}
        footer={
          <Button variant="primary" size="sm" icon="play" onClick={shell.openStart}>
            {s.startCardio}
          </Button>
        }
      >
        {stats}
        {trend.length >= 2 && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: 'var(--color-text-muted)',
              }}
            >
              <span>{s.machineTrend(m.name, trend.length)}</span>
              <span>
                {trend[0].metric.text} → {m.metric.text}
              </span>
            </div>
            <WidgetSpark
              tone="accent"
              points={trend.map((x) => (x.metric.lowerBetter ? -x.metric.raw : x.metric.raw))}
              height={48}
            />
          </>
        )}
        {others.length > 0 && <WidgetList rows={others} />}
      </Widget>
    );
  },
};

/* ---------------------------------------------------------------------------
 * Active minutes vs the WHO 150-minute week
 * ------------------------------------------------------------------------- */

const WHO_GOAL = 150;

const activeMinutes: WidgetDef = {
  id: 'active-minutes',
  group: 'cardio',
  icon: 'heartbeat',
  tone: 'active',
  name: () => cds(getLocale()).activeMinutes,
  render: (size, ctx) => {
    const { store, now, t, locale } = ctx;
    const s = cds(locale);
    const wk = week(now, locale);
    const days = Array.from({ length: 7 }, () => 0);
    const byType = new Map<string, number>();
    let total = 0;
    const add = (key: string, min: number, ts: number) => {
      if (min <= 0 || ts < wk.ws || ts > now) return;
      total += min;
      byType.set(key, (byType.get(key) ?? 0) + min);
      const i = wk.idx(ts);
      if (i >= 0 && i < 7) days[i] += min;
    };
    for (const a of done(store))
      if (activityCategory(a) === 'conditioning') add(a.type, durationMin(a), a.startedAt);
    for (const w of finishedWorkouts(store)) add(GYM_KEY, workoutCardioMinutes(w), w.startedAt);
    const mins = Math.round(total);
    const frac = mins / WHO_GOAL;
    const left = Math.max(0, WHO_GOAL - mins);
    const daysLeft = Math.max(1, 7 - wk.idx(now));
    const perDay = Math.ceil(left / daysLeft);
    const reached = left === 0;
    const toGo = reached ? s.goalReached : s.toGo(left);
    const log = () => openLog(ctx, 'conditioning');
    const label = (k: string) => (k === GYM_KEY ? s.gymCardio : actName(t, k));
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="active"
          icon="heartbeat"
          title={s.activeOf(mins, WHO_GOAL)}
          sub={reached ? toGo : `${toGo} · ${s.daysLeft(daysLeft)}`}
          onClick={log}
        />
      );
    if (size === 'S')
      return (
        <Widget size="S" tone="active" kicker={s.activeWeek} onClick={log}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <WidgetRing value={frac} size={72} tone="active">
              {mins}
            </WidgetRing>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.35 }}>
              {s.ofGoal(WHO_GOAL)}
            </span>
          </div>
        </Widget>
      );
    const ring = (sz: number) => (
      <WidgetRing value={frac} size={sz} tone="active">
        {size === 'XL' ? `${Math.round(frac * 100)}%` : mins}
        <small>{size === 'XL' ? `${mins} / ${WHO_GOAL}` : s.of(WHO_GOAL)}</small>
      </WidgetRing>
    );
    const side = (
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{toGo}</div>
        {!reached && (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {s.daysLeft(daysLeft)} · {s.perDay(perDay)}
          </div>
        )}
      </div>
    );
    if (size === 'L')
      return (
        <Widget size="L" tone="active" kicker={s.activeWeek} onClick={log}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
            {ring(96)}
            {side}
          </div>
        </Widget>
      );
    const top = sortedEntries(byType, (v) => v).slice(0, 3);
    return (
      <Widget
        size="XL"
        tone="active"
        kicker={s.activeRange(wk.range)}
        badge={s.who(WHO_GOAL)}
        onClick={log}
        footer={
          <Button variant="primary" size="sm" icon="plus" onClick={log}>
            {s.logActivity}
          </Button>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {ring(96)}
          {side}
        </div>
        <WidgetBars
          tone="active"
          values={days}
          highlight={[wk.idx(now)]}
          labels={wk.labels}
          height={52}
        />
        {top.length > 0 ? (
          <WidgetStats
            items={top.map(([k, v]) => ({ label: label(k), value: `${Math.round(v)} min` }))}
          />
        ) : (
          <WidgetBar value={0} tone="active" />
        )}
      </Widget>
    );
  },
};

/* ---------------------------------------------------------------------------
 * Favourite sport (30 days, conditioning)
 * ------------------------------------------------------------------------- */

interface TypeAgg {
  n: number;
  min: number;
  kcal: number;
  days: number[];
  sample: Activity;
}

function aggregate(list: Activity[], kg: number | null): [string, TypeAgg][] {
  const m = new Map<string, TypeAgg>();
  for (const a of list) {
    const e = m.get(a.type) ?? { n: 0, min: 0, kcal: 0, days: [0, 0, 0, 0, 0, 0, 0, 0], sample: a };
    e.n++;
    e.min += durationMin(a);
    e.kcal += a.calories ?? activityCalories(a, kg) ?? 0;
    e.days[isoWeekday(a.startedAt)]++;
    m.set(a.type, e);
  }
  return [...m.entries()].sort((a, b) => b[1].n - a[1].n || b[1].min - a[1].min);
}

const favouriteSport: WidgetDef = {
  id: 'favourite-sport',
  group: 'cardio',
  icon: 'trophy',
  tone: 'sport',
  name: () => cds(getLocale()).favSport,
  render: (size, ctx) => {
    const { store, now, t, locale } = ctx;
    const s = cds(locale);
    const kg = latestWeight(store.bodyMetrics)?.weight ?? null;
    const recent = done(store).filter(
      (a) => a.startedAt >= now - 30 * DAY && activityCategory(a) === 'conditioning',
    );
    const agg = aggregate(recent, kg);
    if (agg.length === 0)
      return (
        <Empty
          size={size}
          tone="sport"
          icon="trophy"
          kicker={s.topSport30}
          title={s.noSport}
          sub={s.noSportHint}
          action={s.logActivity}
          onAction={() => openLog(ctx, 'sport')}
        />
      );
    const open = () => openHistory(ctx);
    const [topKey, top] = agg[0];
    const name = actName(t, topKey);
    const icon = actIcon(topKey);
    const tone = actTone(top.sample);
    const total = recent.length;
    const rest = agg
      .slice(1, 3)
      .map(([k, v]) => `${actName(t, k)} ${v.n}×`)
      .join(' · ');
    const rows = (n: number) =>
      agg.slice(0, n).map(([k, v]) => ({
        icon: actIcon(k),
        tone: actTone(v.sample),
        label: actName(t, k),
        value: `${v.n}× · ${fmtHM(v.min)}`,
      }));
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="sport"
          kicker={s.topSport30}
          title={name}
          sub={s.timesTotal(top.n, fmtHM(top.min))}
          onClick={open}
        >
          <IconTile tone={tone} size={36} icon={icon} />
        </Widget>
      );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone={tone}
          icon={icon}
          title={s.times30(name, top.n)}
          sub={rest ? s.next(rest) : s.onlyOne}
          onClick={open}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="sport"
          kicker={s.topSports30}
          badge={s.sessionsN(total)}
          onClick={open}
        >
          <WidgetList rows={rows(3).map(({ label, value }) => ({ label, value }))} />
        </Widget>
      );
    const usual = top.days
      .map((c, iso) => ({ c, iso }))
      .filter((x) => x.iso > 0 && x.c >= 2)
      .map((x) => fmtWeekdayShort(Date.UTC(2026, 0, 4 + x.iso, 12), locale));
    return (
      <Widget
        size="XL"
        tone="sport"
        kicker={s.favKicker}
        badge={s.sessionsN(total)}
        onClick={open}
        footer={
          <Button variant="primary" size="sm" onClick={open} iconTrailing="caret-right">
            {s.seeAll}
          </Button>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconTile tone={tone} size={48} icon={icon} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {[`${top.n}×`, fmtHM(top.min), top.kcal > 0 ? `${fmtInt(top.kcal)} kcal` : null]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
        </div>
        <WidgetList rows={rows(4)} />
        {usual.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {s.usuallyOn(usual.join(' & '))}
          </div>
        )}
      </Widget>
    );
  },
};

/* ---------------------------------------------------------------------------
 * Recovery rituals (this month)
 * ------------------------------------------------------------------------- */

const recoveryRituals: WidgetDef = {
  id: 'recovery-rituals',
  group: 'cardio',
  icon: 'flower-lotus',
  tone: 'rest',
  name: () => cds(getLocale()).recoveryRituals,
  render: (size, ctx) => {
    const { store, now, t, locale } = ctx;
    const s = cds(locale);
    const d = new Date(now);
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const pStart = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
    const rec = done(store).filter((a) => activityCategory(a) === 'recovery');
    const month = rec.filter((a) => a.startedAt >= mStart && a.startedAt <= now);
    const prevN = rec.filter((a) => a.startedAt >= pStart && a.startedAt < mStart).length;
    const mName = monthShort(now, locale);
    const log = () => openLog(ctx, 'recovery');
    if (month.length === 0)
      return (
        <Empty
          size={size}
          tone="rest"
          icon="flower-lotus"
          kicker={s.recoveryMonth(mName)}
          title={s.noRecovery}
          action={s.logRecovery}
          onAction={log}
        />
      );
    const open = () => openHistory(ctx);
    const agg = aggregate(month, null);
    const split = agg
      .slice(0, 3)
      .map(([k, v]) => `${actName(t, k)} ${v.n}`)
      .join(' · ');
    const last = rec.sort((a, b) => b.startedAt - a.startedAt)[0];
    const lastTxt = s.lastWas(
      actName(t, last.type).toLowerCase(),
      when(last.startedAt, now, s, locale).toLowerCase(),
    );
    const n = month.length;
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="rest"
          kicker={s.recoveryMonth(mName)}
          value={n}
          unit={s.sessionsUnit}
          sub={split}
          onClick={open}
        />
      );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="rest"
          icon="flower-lotus"
          title={s.recoverySessions(n)}
          sub={lastTxt}
          onClick={open}
          trailing={
            <Button
              variant="secondary"
              size="sm"
              icon="plus"
              onClick={log}
              aria-label={s.logRecovery}
            />
          }
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="rest"
          kicker={s.ritualsMonth(mName)}
          badge={s.totalN(n)}
          onClick={open}
        >
          <WidgetList
            rows={agg.slice(0, 3).map(([k, v]) => ({ label: actName(t, k), value: `${v.n}×` }))}
          />
        </Widget>
      );
    const prevName = monthShort(pStart, locale);
    const diff = n - prevN;
    return (
      <Widget
        size="XL"
        tone="rest"
        kicker={s.ritualsMonth(mName)}
        badge={s.recoverySessions(n)}
        onClick={open}
        footer={
          <Button variant="primary" size="sm" icon="plus" onClick={log}>
            {s.logRecovery}
          </Button>
        }
      >
        <WidgetList
          rows={agg.slice(0, 4).map(([k, v]) => ({
            icon: actIcon(k),
            tone: 'rest' as Tone,
            label: actName(t, k),
            value: `${v.n}× · ${fmtHM(v.min)}`,
          }))}
        />
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{lastTxt}</div>
        <WidgetDelta good={diff >= 0}>
          {diff > 0
            ? s.moreThan(diff, prevName)
            : diff < 0
              ? s.fewerThan(-diff, prevName)
              : s.sameAs(prevName)}
        </WidgetDelta>
      </Widget>
    );
  },
};

/* ---------------------------------------------------------------------------
 * Activity calories (conditioning, this week)
 * ------------------------------------------------------------------------- */

const activityKcal: WidgetDef = {
  id: 'activity-kcal',
  group: 'cardio',
  icon: 'fire',
  tone: 'kcal',
  name: () => cds(getLocale()).activityKcal,
  render: (size, ctx) => {
    const { store, now, t, locale, openWeight } = ctx;
    const s = cds(locale);
    const wk = week(now, locale);
    const kg = latestWeight(store.bodyMetrics)?.weight ?? null;
    const days = Array.from({ length: 7 }, () => 0);
    const byType = new Map<string, number>();
    let cur = 0;
    let last = 0;
    let count = 0;
    for (const a of done(store)) {
      if (activityCategory(a) !== 'conditioning') continue;
      const kcal = a.calories ?? activityCalories(a, kg) ?? 0;
      if (a.startedAt >= wk.ws && a.startedAt <= now) {
        count++;
        cur += kcal;
        byType.set(a.type, (byType.get(a.type) ?? 0) + kcal);
        const i = wk.idx(a.startedAt);
        if (i >= 0 && i < 7) days[i] += kcal;
      } else if (a.startedAt >= wk.prev && a.startedAt < wk.ws) last += kcal;
    }
    const log = () => openLog(ctx, 'conditioning');
    if (count === 0)
      return (
        <Empty
          size={size}
          tone="kcal"
          icon="fire"
          kicker={s.activitiesWeek}
          title={s.noKcal}
          action={s.logActivity}
          onAction={log}
        />
      );
    if (cur === 0 && !kg)
      return (
        <Empty
          size={size}
          tone="kcal"
          icon="fire"
          kicker={s.activitiesWeek}
          title={t.actNoWeight}
          action={ctx.tw.logWeight}
          onAction={openWeight}
        />
      );
    const open = () => openHistory(ctx);
    const diff = cur - last;
    const deltaTxt = `${diff >= 0 ? '+' : '−'}${fmtInt(Math.abs(diff))}`;
    const delta = <WidgetDelta good={diff >= 0}>{s.vsLastWeek(deltaTxt)}</WidgetDelta>;
    const top = sortedEntries(byType, (v) => v);
    const value = fmtInt(cur);
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="kcal"
          kicker={s.activitiesWeek}
          value={value}
          unit="kcal"
          sub={delta}
          onClick={open}
        />
      );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="kcal"
          icon="fire"
          title={s.kcalFromAct(value)}
          sub={top[0] ? s.topThisWeek(`${actName(t, top[0][0])} ${fmtInt(top[0][1])}`) : undefined}
          onClick={open}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="kcal"
          kicker={s.kcalKicker}
          badge={<WidgetDelta good={diff >= 0}>{deltaTxt}</WidgetDelta>}
          value={value}
          unit="kcal"
          bodyLast
          onClick={open}
        >
          <WidgetStats
            items={top.slice(0, 4).map(([k, v]) => ({ label: actName(t, k), value: fmtInt(v) }))}
          />
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="kcal"
        kicker={s.kcalRange(wk.range)}
        badge={<WidgetDelta good={diff >= 0}>{deltaTxt}</WidgetDelta>}
        value={value}
        unit="kcal"
        sub={s.lastWeek(fmtInt(last))}
        bodyLast
        onClick={open}
        footer={
          <Button variant="primary" size="sm" onClick={open} iconTrailing="caret-right">
            {s.openDayHistory}
          </Button>
        }
      >
        <WidgetBars
          tone="kcal"
          values={days}
          highlight={[wk.idx(now)]}
          labels={wk.labels}
          height={64}
        />
        <WidgetStats
          items={top.slice(0, 4).map(([k, v]) => ({ label: actName(t, k), value: fmtInt(v) }))}
        />
      </Widget>
    );
  },
};

export const CARDIO_WIDGETS: WidgetDef[] = [
  distance,
  lastRoute,
  paceTrend,
  cardioMachine,
  activeMinutes,
  favouriteSport,
  recoveryRituals,
  activityKcal,
];
