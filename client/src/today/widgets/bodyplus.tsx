/**
 * Body & recovery — deeper widgets (design L9 "Body metrics"): sleep debt,
 * bedtime consistency, naps, body composition, resting energy, physique goal
 * and the rest & illness log. All numbers come from the app's own modules
 * (sleep.ts, energy.ts, dayEnergy.ts, activities.ts, goals, rest periods).
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
import {
  finishedNights,
  minutesOfDay,
  nightDurationMin,
  resolvePlan,
  sleepKindOf,
  sleepStats,
  usualPlan,
} from '../../sleep';
import { bmrKcal } from '../../energy';
import { autoLifestyle, restingDayKcal, weightAsOfKg } from '../../dayEnergy';
import { activityCalories, workoutCalories } from '../../activities';
import { consistencyStreak, dayKey, latestWeight } from '../../store';
import { dayToTs } from '../../health';
import { weekBounds } from '../../weekStart';
import { fmtDayMonth, fmtWeekdayShort, getLocale, type LocaleId } from '../../i18n';
import type { SleepNight } from '../../types';
import type { WidgetCtx, WidgetDef } from '../registry';
import { DAY, clock, hm, pct, signed } from './format';
import { bs } from './body.strings';

/* ---------- helpers ---------- */

/** Minutes from midnight → "23:20" (wraps around the clock). */
function mm(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
/** Signed distance a − b around the 24h clock, −720…720 (positive = later). */
function clockOffset(a: number, b: number): number {
  return ((((a - b + 720) % 1440) + 1440) % 1440) - 720;
}
/** 280 → "+4h 40m" / −70 → "−1h 10m". */
function signedHm(min: number): string {
  if (Math.round(min) === 0) return '±0m';
  return `${min > 0 ? '+' : '−'}${hm(Math.abs(min))}`;
}
function one(x: number): string {
  return String(Number(x.toFixed(1)));
}
function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function wd2(ts: number, locale: LocaleId): string {
  return fmtWeekdayShort(ts, locale).slice(0, 2);
}
/** Value + unit split of hm(): "4h 40m" → ["4h", "40m"]. */
function hmParts(min: number): [string, string | undefined] {
  const [a, b] = hm(min).split(' ');
  return [a, b];
}
/** Active kcal logged today (lifting + activities), as in Day history. */
function activeKcalToday(store: WidgetCtx['store'], now: number): number {
  const start = startOfDay(now);
  const end = start + DAY;
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;
  let k = 0;
  for (const w of store.workouts)
    if (w.finishedAt !== null && w.startedAt >= start && w.startedAt < end)
      k += workoutCalories(w, bodyKg) ?? 0;
  for (const a of store.activities)
    if (a.finishedAt !== null && a.startedAt >= start && a.startedAt < end)
      k += activityCalories(a, bodyKg) ?? 0;
  return Math.round(k);
}
function tonightPlan(store: WidgetCtx['store'], now: number) {
  return (
    resolvePlan(store.sleepSchedule, store.sleeps ?? [], new Date(now).getDay(), now) ??
    usualPlan(store.sleeps, now)
  );
}

/* ---------- Sleep debt ---------- */

function sleepDebtData(store: WidgetCtx['store'], now: number) {
  const goal = store.sleepSettings?.goalMin || 480;
  const nights = finishedNights(store.sleeps, now);
  const naps = (store.sleeps ?? []).filter(
    (n) => n.wake !== null && n.bedtime <= now && sleepKindOf(n) === 'nap',
  );
  const inWin = (list: SleepNight[], from: number, to: number) =>
    list.filter((n) => n.bedtime >= from && n.bedtime < to);
  const napMin = (from: number, to: number) =>
    inWin(naps, from, to).reduce((x, n) => x + nightDurationMin(n, now), 0);
  const debtOf = (list: SleepNight[], nap: number) =>
    Math.max(0, list.reduce((x, n) => x + Math.max(0, goal - nightDurationMin(n, now)), 0) - nap);
  const cur = inWin(nights, now - 7 * DAY, now + 1);
  const prev = inWin(nights, now - 14 * DAY, now - 7 * DAY);
  const napCur = napMin(now - 7 * DAY, now + 1);
  const debt = debtOf(cur, napCur);
  const prevDebt = prev.length ? debtOf(prev, napMin(now - 14 * DAY, now - 7 * DAY)) : null;
  const durs = cur.map((n) => nightDurationMin(n, now));
  const avg = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : 0;
  const worst = cur.length
    ? cur.reduce((a, b) => (nightDurationMin(b, now) < nightDurationMin(a, now) ? b : a))
    : null;
  // Per morning over the last 7 days: the shortfall of the night that ended then.
  const today = startOfDay(now);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d.getTime();
  });
  const deficits = days.map((d) => {
    const n = cur.find((x) => x.wake !== null && x.wake >= d && x.wake < d + DAY);
    return n ? Math.max(0, goal - nightDurationMin(n, now)) : 0;
  });
  const plan = tonightPlan(store, now);
  const cut = Math.min(60, Math.max(10, Math.round(debt / 7 / 5) * 5));
  const bedBy = plan && debt > 0 ? mm(plan.bedMin - cut) : null;
  return {
    goal,
    cur,
    debt,
    prevDebt,
    napCur,
    avg,
    worst,
    days,
    deficits,
    cut,
    bedBy,
    clearNights: Math.max(1, Math.ceil(debt / cut)),
  };
}

const sleepDebt: WidgetDef = {
  id: 'sleep-debt',
  group: 'body',
  icon: 'hourglass',
  tone: 'sleep',
  name: () => bs(getLocale()).sleepDebt,
  render: (size, { store, now, tw, locale, shell }) => {
    const s = bs(locale);
    const d = sleepDebtData(store, now);
    const open = () => shell.openOverlay({ screen: 'sleep' });
    const plan = () => shell.openOverlay({ screen: 'sleep', mode: 'schedule' });
    if (d.cur.length === 0) {
      const log = () => shell.openOverlay({ screen: 'sleep', mode: 'backfill' });
      if (size === 'M')
        return (
          <Widget
            size="M"
            tone="sleep"
            icon="hourglass"
            title={s.sleepDebt}
            sub={s.needNights}
            onClick={log}
          />
        );
      return (
        <Widget
          size={size}
          tone="sleep"
          kicker={s.sleepDebt}
          title={tw.noNight}
          sub={s.needNights}
          onClick={log}
          footer={
            size === 'S' ? undefined : (
              <Button variant="primary" size="sm" onClick={log}>
                {tw.logSleep}
              </Button>
            )
          }
        />
      );
    }
    const goal = hm(d.goal);
    const [v, u] = hmParts(d.debt);
    const noDebt = d.debt === 0;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="sleep"
          icon="hourglass"
          title={noDebt ? s.noDebt : `${s.sleepDebt} ${hm(d.debt)}`}
          sub={d.bedBy ? s.debtRow(goal, d.bedBy) : s.debtRowNoPlan(goal)}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="sleep"
          kicker={s.sleepDebt}
          value={noDebt ? undefined : v}
          unit={noDebt ? undefined : u}
          title={noDebt ? s.noDebt : undefined}
          sub={noDebt ? s.noDebtSub : s.debtSub(goal)}
          onClick={open}
        />
      );
    const labels = d.days.map((x) => wd2(x, locale));
    const hi = d.deficits.map((x, i) => (x > 0 ? i : -1)).filter((i) => i >= 0);
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="sleep"
          kicker={s.debtKicker}
          badge={s.goalX(goal)}
          value={noDebt ? undefined : hm(d.debt)}
          title={noDebt ? s.noDebt : undefined}
          sub={d.bedBy ? s.bedByCut(d.bedBy, hm(d.cut)) : s.noDebtSub}
          bodyLast
          onClick={open}
        >
          <WidgetBars tone="sleep" values={d.deficits} highlight={hi} height={34} />
        </Widget>
      );
    const delta = d.prevDebt != null ? d.debt - d.prevDebt : null;
    const rows = [
      ...(d.worst
        ? [
            {
              label: s.worstNight(fmtWeekdayShort(d.worst.wake ?? d.worst.bedtime, locale)),
              value: hm(nightDurationMin(d.worst, now)),
            },
          ]
        : []),
      { label: s.avgSleep, value: hm(d.avg) },
      ...(d.napCur > 0 ? [{ label: s.napsCounted, value: `−${hm(d.napCur)}` }] : []),
    ];
    return (
      <Widget
        size="XL"
        tone="sleep"
        kicker={s.debtKicker}
        badge={
          delta != null ? (
            <WidgetDelta good={delta <= 0}>{s.vsLastWeek(signedHm(delta))}</WidgetDelta>
          ) : (
            s.goalX(goal)
          )
        }
        value={noDebt ? undefined : hm(d.debt)}
        title={noDebt ? s.noDebt : undefined}
        sub={d.bedBy ? s.clearIn(d.bedBy, d.clearNights) : s.noDebtSub}
        bodyLast
        onClick={open}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={plan}>
            {s.planBedtime}
          </Button>
        }
      >
        <WidgetBars tone="sleep" values={d.deficits} highlight={hi} height={96} labels={labels} />
        <WidgetList rows={rows} />
      </Widget>
    );
  },
};

/* ---------- Bedtime consistency ---------- */

/** Bedtimes on a ±3h axis around the usual one: the band is the usual range,
 *  late nights (> 1h after usual) are drawn in the illness amber. */
function BedStrip({
  offsets,
  lo,
  hi,
  usual,
  ticks,
}: {
  offsets: number[];
  lo: number;
  hi: number;
  usual: number;
  ticks: boolean;
}) {
  const W = 300;
  const H = ticks ? 56 : 30;
  const R = 180;
  const x = (o: number) => ((Math.max(-R, Math.min(R, o)) + R) / (2 * R)) * (W - 16) + 8;
  const cy = ticks ? 20 : H / 2;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <line x1={0} x2={W} y1={cy} y2={cy} stroke="var(--color-neutral-700)" strokeWidth={1} />
      <rect
        x={x(lo) - 7}
        y={cy - 9}
        width={Math.max(14, x(hi) - x(lo) + 14)}
        height={18}
        rx={9}
        fill="var(--color-sleep-tint)"
        stroke="var(--color-sleep-line)"
      />
      {offsets.map((o, i) => (
        <circle
          key={i}
          cx={x(o)}
          cy={cy}
          r={5}
          fill={o > 60 ? 'var(--color-illness)' : 'var(--color-sleep)'}
        />
      ))}
      {ticks &&
        [-120, 0, 120].map((o) => (
          <text
            key={o}
            x={x(o)}
            y={H - 4}
            textAnchor="middle"
            fontSize={11}
            fill="var(--color-text-faint)"
          >
            {mm(usual + o)}
          </text>
        ))}
    </svg>
  );
}

const bedtime: WidgetDef = {
  id: 'bedtime-consistency',
  group: 'body',
  icon: 'clock',
  tone: 'sleep',
  name: () => bs(getLocale()).bedtimeConsistency,
  render: (size, { store, now, locale, shell }) => {
    const s = bs(locale);
    const nights = finishedNights(store.sleeps, now).slice(0, 7);
    const usual = nights.length >= 2 ? usualPlan(nights, now) : null;
    const open = () => shell.openOverlay({ screen: 'sleep' });
    const schedule = () => shell.openOverlay({ screen: 'sleep', mode: 'schedule' });
    if (!usual) {
      if (size === 'M')
        return (
          <Widget
            size="M"
            tone="sleep"
            icon="clock"
            title={s.bedtime}
            sub={s.needTwoNights}
            onClick={open}
          />
        );
      return (
        <Widget
          size={size}
          tone="sleep"
          kicker={s.bedtime}
          title={s.needTwoNights}
          onClick={open}
          footer={
            size === 'S' ? undefined : (
              <Button variant="primary" size="sm" onClick={schedule}>
                {s.setSchedule}
              </Button>
            )
          }
        />
      );
    }
    const offsets = nights.map((n) => clockOffset(minutesOfDay(n.bedtime), usual.bedMin));
    const spread = Math.round(offsets.reduce((a, o) => a + Math.abs(o), 0) / offsets.length);
    const late = offsets.filter((o) => o > 60).length;
    const normal = offsets.filter((o) => o <= 60);
    const lo = normal.length ? Math.min(...normal) : 0;
    const hi = normal.length ? Math.max(...normal) : 0;
    const usualStr = mm(usual.bedMin);
    const lastStr = clock(nights[0].bedtime);
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="sleep"
          icon="clock"
          title={`${s.bedtime} ${s.spreadMin(spread)}`}
          sub={s.usualLast(usualStr, lastStr)}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="sleep"
          kicker={s.bedtime}
          value={s.spreadMin(spread)}
          sub={s.usualLate(usualStr, late)}
          onClick={open}
        />
      );
    const strip = (
      <BedStrip offsets={offsets} lo={lo} hi={hi} usual={usual.bedMin} ticks={size === 'XL'} />
    );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="sleep"
          kicker={s.bedtime7}
          badge={s.usualX(usualStr)}
          value={s.spreadMin(spread)}
          sub={s.spread}
          bodyLast
          onClick={open}
        >
          {strip}
        </Widget>
      );
    const latestIdx = offsets.indexOf(Math.max(...offsets));
    const latest = nights[latestIdx];
    const plan = tonightPlan(store, now);
    const goal = store.sleepSettings?.goalMin || 480;
    const rhythm = sleepStats(store.sleeps, now, goal, 14).consistencyPct;
    const rows = [
      {
        label: s.latestX(fmtWeekdayShort(latest.bedtime, locale)),
        value: clock(latest.bedtime),
      },
      { label: s.avgWake, value: mm(usual.wakeMin) },
      { label: s.onRhythm, value: `${rhythm}%` },
      ...(plan ? [{ label: s.windDown(mm(plan.bedMin - 30)) }] : []),
    ];
    return (
      <Widget
        size="XL"
        tone="sleep"
        kicker={s.bedtime7}
        badge={s.usualX(`${mm(usual.bedMin + lo)}–${mm(usual.bedMin + hi)}`)}
        value={s.spreadMin(spread)}
        sub={late > 0 ? `${s.spread} · ${s.lateNights(late)}` : s.spread}
        bodyLast
        onClick={open}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={schedule}>
            {s.setSchedule}
          </Button>
        }
      >
        {strip}
        <WidgetList rows={rows} />
      </Widget>
    );
  },
};

/* ---------- Naps ---------- */

const naps: WidgetDef = {
  id: 'naps',
  group: 'body',
  icon: 'sun-horizon',
  tone: 'sleep',
  name: () => bs(getLocale()).naps,
  render: (size, { store, now, locale, shell }) => {
    const s = bs(locale);
    const [ws, we] = weekBounds(now);
    const list = (store.sleeps ?? [])
      .filter(
        (n) =>
          n.wake !== null &&
          n.bedtime >= ws &&
          n.bedtime < we &&
          n.bedtime <= now &&
          sleepKindOf(n) === 'nap',
      )
      .sort((a, b) => a.bedtime - b.bedtime);
    const durs = list.map((n) => nightDurationMin(n, now));
    const total = durs.reduce((a, b) => a + b, 0);
    const avg = list.length ? total / list.length : 0;
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws);
      d.setDate(d.getDate() + i);
      return d.getTime();
    });
    const perDay = days.map((d) =>
      list.reduce((x, n, i) => (n.bedtime >= d && n.bedtime < d + DAY ? x + durs[i] : x), 0),
    );
    const todayIdx = days.findIndex((d) => now >= d && now < d + DAY);
    const range = `${fmtDayMonth(ws, locale)} – ${fmtDayMonth(we - 1, locale)}`;
    const open = () => shell.openOverlay({ screen: 'sleep' });
    const log = () => shell.openOverlay({ screen: 'sleep', mode: 'backfill' });
    const plus = (
      <Button variant="secondary" size="sm" onClick={log}>
        +
      </Button>
    );
    if (list.length === 0)
      return (
        <WidgetEmpty
          size={size}
          tone="sleep"
          icon="sun-horizon"
          kicker={s.napsWeek}
          title={s.noNaps}
          sub={range}
          action={s.logNap}
          onAction={log}
        />
      );
    const summary = `${s.napsN(list.length)} · ${hm(total)}`;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="sleep"
          icon="sun-horizon"
          title={list.length ? summary : s.noNaps}
          sub={
            list.length
              ? list
                  .slice(-3)
                  .map(
                    (n, i, arr) =>
                      `${fmtWeekdayShort(n.bedtime, locale)} ${hm(durs[durs.length - arr.length + i])}`,
                  )
                  .join(' · ')
              : s.logNap
          }
          onClick={open}
          trailing={plus}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="sleep"
          kicker={s.napsWeek}
          value={list.length || undefined}
          title={list.length ? undefined : s.noNaps}
          sub={list.length ? s.totalX(hm(total)) : s.logNap}
          onClick={list.length ? open : log}
        />
      );
    const bars = (
      <WidgetBars
        tone="sleep"
        values={perDay}
        highlight={todayIdx >= 0 ? [todayIdx] : []}
        height={size === 'XL' ? 90 : 34}
        labels={size === 'XL' ? days.map((d) => wd2(d, locale)) : undefined}
      />
    );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="sleep"
          kicker={s.napsWeek}
          badge={range}
          title={list.length ? summary : s.noNaps}
          sub={list.length ? s.avgX(hm(avg)) : s.logNap}
          bodyLast
          onClick={list.length ? open : log}
        >
          {bars}
        </Widget>
      );
    const rows = [
      ...list.slice(-4).map((n) => ({
        label: `${fmtWeekdayShort(n.bedtime, locale)} · ${clock(n.bedtime)}–${clock(n.wake ?? now)}`,
        value: hm(nightDurationMin(n, now)),
      })),
      ...(total > 0 ? [{ label: s.debtOffset, value: `−${hm(total)}` }] : []),
    ];
    return (
      <Widget
        size="XL"
        tone="sleep"
        kicker={s.napsWeek}
        badge={range}
        title={list.length ? summary : s.noNaps}
        sub={list.length ? s.avgX(hm(avg)) : undefined}
        bodyLast
        onClick={open}
        footer={
          <Button variant="primary" size="sm" fullWidth icon="plus" onClick={log}>
            {s.logNap}
          </Button>
        }
      >
        {bars}
        {rows.length > 0 && <WidgetList rows={rows} />}
      </Widget>
    );
  },
};

/* ---------- Body composition ---------- */

const bodyComposition: WidgetDef = {
  id: 'body-composition',
  group: 'body',
  icon: 'ruler',
  tone: 'neutral',
  name: () => bs(getLocale()).bodyComp,
  render: (size, { store, now, locale, shell }) => {
    const s = bs(locale);
    const bm = store.bodyMetrics;
    const lastW = latestWeight(bm);
    const w = lastW?.weight ?? null;
    const h = bm?.heightCm ?? null;
    const bmiOf = (kg: number | null) => (kg && h ? kg / (h / 100) ** 2 : null);
    const bmi = bmiOf(w);
    const bf = bm?.bodyFatPct ?? null;
    const musclePct = bm?.muscleKg && w ? (bm.muscleKg / w) * 100 : null;
    const lean = w && bf ? w * (1 - bf / 100) : null;
    const tape = [
      bm?.chestCm ? { label: s.chest, v: bm.chestCm } : null,
      bm?.waistCm ? { label: s.waist, v: bm.waistCm } : null,
      bm?.hipCm ? { label: s.hip, v: bm.hipCm } : null,
    ].filter((x): x is { label: string; v: number } => x !== null);
    const open = () => shell.goTab('me');
    if (bmi == null && bf == null && musclePct == null && tape.length === 0) {
      if (size === 'M')
        return (
          <Widget
            size="M"
            tone="neutral"
            icon="ruler"
            title={s.noComp}
            sub={s.addMeasures}
            onClick={open}
          />
        );
      return (
        <Widget
          size={size}
          tone="neutral"
          kicker={s.bodyComp}
          title={s.noComp}
          onClick={open}
          footer={
            size === 'S' ? undefined : (
              <Button variant="primary" size="sm" onClick={open}>
                {s.addMeasures}
              </Button>
            )
          }
        />
      );
    }
    const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
    const tapeLine = tape.length
      ? `${tape.map((x) => `${x.label} ${x.v}`).join(' · ')} cm`
      : undefined;
    const date = lastW ? fmtDayMonth(lastW.at, locale) : undefined;
    if (size === 'M') {
      const head = [
        bf != null ? s.fatShort(one(bf)) : null,
        musclePct != null ? s.muscleShort(one(musclePct)) : null,
      ]
        .filter(Boolean)
        .join(' · ');
      const sub = [
        bmi != null ? `${s.bmi} ${one(bmi)}` : null,
        bm?.waistCm ? s.waistShort(String(bm.waistCm)) : null,
      ]
        .filter(Boolean)
        .join(' · ');
      return (
        <Widget
          size="M"
          tone="neutral"
          icon="ruler"
          title={head ? cap(head) : bmi != null ? `${s.bmi} ${one(bmi)}` : tapeLine}
          sub={head ? sub : tapeLine}
          onClick={open}
        />
      );
    }
    if (size === 'S') {
      const main =
        bf != null
          ? { k: s.bodyFat, v: one(bf), u: '%' }
          : bmi != null
            ? { k: s.bmi, v: one(bmi), u: undefined }
            : musclePct != null
              ? { k: s.muscle, v: one(musclePct), u: '%' }
              : { k: tape[0].label, v: String(tape[0].v), u: 'cm' };
      return (
        <Widget
          size="S"
          tone="neutral"
          kicker={main.k}
          value={main.v}
          unit={main.u}
          sub={bf != null && bmi != null ? `${s.bmi} ${one(bmi)}` : tapeLine}
          onClick={open}
        />
      );
    }
    const stats = [
      bmi != null ? { label: s.bmi, value: one(bmi) } : null,
      bf != null ? { label: s.bodyFat, value: `${one(bf)}%` } : null,
      musclePct != null ? { label: s.muscle, value: `${one(musclePct)}%` } : null,
    ].filter((x): x is { label: string; value: string } => x !== null);
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="neutral"
          kicker={s.bodyComp}
          badge={date}
          sub={tapeLine}
          onClick={open}
        >
          {stats.length > 0 && <WidgetStats items={stats} />}
        </Widget>
      );
    // XL — BMI over the last 30 days of weigh-ins (the only composition metric
    // with a history in the app), then every current measurement.
    const month = (bm?.weights ?? [])
      .filter((x) => x.at >= now - 30 * DAY)
      .sort((a, b) => a.at - b.at);
    const series = month.map((x) => bmiOf(x.weight) ?? x.weight);
    const w30 = weightAsOfKg(bm, now - 30 * DAY);
    const bmi30 = bmiOf(w30);
    const lean30 = w30 && bf ? w30 * (1 - bf / 100) : null;
    const rows = [
      ...(bmi != null
        ? [
            {
              label: s.bmi,
              value:
                bmi30 != null && month.length > 1 ? (
                  <>
                    {one(bmi)}{' '}
                    <WidgetDelta good={bmi - bmi30 <= 0}>{signed(bmi - bmi30)}</WidgetDelta>
                  </>
                ) : (
                  one(bmi)
                ),
            },
          ]
        : []),
      ...(bf != null ? [{ label: s.bodyFat, value: `${one(bf)}%` }] : []),
      ...(musclePct != null ? [{ label: s.muscle, value: `${one(musclePct)}%` }] : []),
      ...(lean != null
        ? [
            {
              label: s.leanMass,
              value:
                lean30 != null && month.length > 1 ? (
                  <>
                    {one(lean)} kg{' '}
                    <WidgetDelta good={lean - lean30 >= 0}>{signed(lean - lean30)}</WidgetDelta>
                  </>
                ) : (
                  `${one(lean)} kg`
                ),
            },
          ]
        : []),
      ...tape.map((x) => ({ label: x.label, value: `${x.v} cm` })),
    ];
    return (
      <Widget
        size="XL"
        tone="neutral"
        kicker={s.bodyComp30}
        badge={date}
        onClick={open}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={open}>
            {s.updateMeasures}
          </Button>
        }
      >
        {series.length > 1 && <WidgetSpark points={series} height={64} tone="neutral" area />}
        <WidgetList rows={rows.slice(0, 7)} />
      </Widget>
    );
  },
};

/* ---------- Resting energy ---------- */

const restingEnergy: WidgetDef = {
  id: 'resting-energy',
  group: 'body',
  icon: 'lightning',
  tone: 'kcal',
  name: () => bs(getLocale()).restingEnergy,
  render: (size, { store, now, tw, locale, shell, openWeight }) => {
    const s = bs(locale);
    const bm = store.bodyMetrics;
    const w = latestWeight(bm)?.weight ?? null;
    const bmr = bmrKcal(bm, w, now);
    const open = () => shell.goTab('me');
    if (!bmr || !w) {
      if (size === 'M')
        return (
          <Widget
            size="M"
            tone="kcal"
            icon="lightning"
            title={s.restingEnergy}
            sub={s.noBmr}
            onClick={open}
          />
        );
      return (
        <Widget
          size={size}
          tone="kcal"
          kicker={s.restingEnergy}
          title={s.noBmr}
          onClick={open}
          footer={
            size === 'S' ? undefined : (
              <Button variant="primary" size="sm" onClick={open}>
                {s.completeProfile}
              </Button>
            )
          }
        />
      );
    }
    const n = (x: number) => Math.round(x).toLocaleString(locale);
    const bf = bm.bodyFatPct ?? null;
    const w30 = weightAsOfKg(bm, now - 30 * DAY);
    const bmr30 = bmrKcal(bm, w30, now - 30 * DAY);
    const delta = bmr30 != null ? bmr - bmr30 : null;
    const deltaEl =
      delta != null && delta !== 0 ? (
        <WidgetDelta good>{s.inDays30(signed(delta, 0))}</WidgetDelta>
      ) : undefined;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="kcal"
          icon="lightning"
          title={s.bmrRow(n(bmr))}
          sub={[
            `${w} kg`,
            bf != null ? s.fatPctShort(one(bf)) : null,
            delta ? s.inDays30(signed(delta, 0)) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="kcal"
          kicker={s.restingEnergy}
          value={n(bmr)}
          unit={s.kcal}
          sub={s.perDayBmr}
          onClick={open}
        />
      );
    const ls = autoLifestyle(store.workouts, store.activities, now);
    const baseline = restingDayKcal(bmr, ls.factor) ?? bmr;
    const train = activeKcalToday(store, now);
    const total = baseline + train;
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="kcal"
          kicker={s.restingBmr}
          badge={deltaEl}
          value={n(bmr)}
          unit={s.kcalDay}
          bodyLast
          onClick={open}
        >
          <WidgetStats
            items={[
              { label: 'BMR', value: n(bmr) },
              { label: s.dailyLife, value: `+${n(baseline - bmr)}` },
              { label: s.trainingToday, value: `+${n(train)}` },
              { label: s.total, value: `≈ ${n(total)}` },
            ]}
          />
        </Widget>
      );
    const month = (bm.weights ?? [])
      .filter((x) => x.at >= now - 30 * DAY)
      .sort((a, b) => a.at - b.at);
    const series = month
      .map((x) => bmrKcal(bm, x.weight, x.at))
      .filter((x): x is number => x != null);
    const rows = [
      { label: tw.bodyWeight, value: `${w} kg` },
      ...(bf != null ? [{ label: s.leanMass, value: `${one(w * (1 - bf / 100))} kg` }] : []),
      { label: s.lifestyle, value: `${s.lifestyleLevel[ls.level]} · +${n(baseline - bmr)}` },
      { label: s.trainingToday, value: `+${n(train)} ${s.kcal}` },
      { label: s.totalEstimate, value: `≈ ${n(total)} ${s.kcal}` },
    ];
    return (
      <Widget
        size="XL"
        tone="kcal"
        kicker={s.resting30}
        badge={bf != null ? 'Katch–McArdle' : 'Mifflin–St Jeor'}
        value={n(bmr)}
        unit={s.kcalDay}
        sub={deltaEl}
        bodyLast
        onClick={open}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={openWeight}>
            {tw.logWeight}
          </Button>
        }
      >
        {series.length > 1 && <WidgetSpark points={series} height={56} tone="kcal" area />}
        <WidgetList rows={rows} />
      </Widget>
    );
  },
};

/* ---------- Physique goal ---------- */

const physiqueGoal: WidgetDef = {
  id: 'physique-goal',
  group: 'body',
  icon: 'target',
  tone: 'accent',
  name: () => bs(getLocale()).physiqueGoal,
  render: (size, { store, now, t, locale, shell }) => {
    const s = bs(locale);
    const bm = store.bodyMetrics;
    const phys = store.goals?.physique;
    const goal = bm?.goalWeightKg ?? null;
    const openGoals = () => {
      window.location.hash = '#/goals';
    };
    const openBody = () => shell.goTab('me');
    if (!phys && !goal)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="target"
          kicker={s.physiqueGoal}
          title={s.noPhysique}
          action={s.pickPhysique}
          onAction={openGoals}
        />
      );
    const arch = phys ? t.archetypes[phys.archetype] : undefined;
    const name = arch?.name ?? s.physiqueGoal;
    const ws = (bm?.weights ?? []).slice().sort((a, b) => a.at - b.at);
    const cur = ws.length ? ws[ws.length - 1].weight : null;
    const startAt = phys?.setAt ?? ws[0]?.at ?? now;
    const startW = weightAsOfKg(bm, startAt);
    let progress: number | null = null;
    if (goal != null && cur != null && startW != null)
      progress =
        Math.abs(startW - goal) < 0.05
          ? Math.abs(cur - goal) < 0.05
            ? 1
            : 0
          : Math.max(0, Math.min(1, (startW - cur) / (startW - goal)));
    const toGo = goal != null && cur != null ? Math.abs(cur - goal) : null;
    // Pace: the last 30 days' weight trend projected to the goal.
    const month = ws.filter((x) => x.at >= now - 30 * DAY);
    let eta: number | null = null;
    if (goal != null && cur != null && toGo != null && toGo >= 0.1 && month.length >= 2) {
      const a = month[0];
      const b = month[month.length - 1];
      const perDay = (b.weight - a.weight) / Math.max(1, (b.at - a.at) / DAY);
      if ((goal - cur) * perDay > 0 && Math.abs(perDay) > 0.005) {
        const at = now + (toGo / Math.abs(perDay)) * DAY;
        if (at < now + 730 * DAY) eta = at;
      }
    }
    const p = progress != null ? pct(progress) : null;
    const reached = toGo != null && toGo < 0.1;
    const paceLine = reached
      ? s.reached
      : eta != null
        ? s.onPace(fmtDayMonth(eta, locale))
        : toGo != null
          ? s.kgToGo(one(toGo))
          : s.setTarget;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="target"
          title={p != null ? s.pctThere(name, p) : name}
          sub={
            goal != null && cur != null
              ? `${one(cur)} → ${one(goal)} kg · ${paceLine}`
              : s.setTarget
          }
          onClick={openGoals}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.physiqueGoal}
          sub={toGo != null && !reached ? `${name} · ${s.kgToGo(one(toGo))}` : name}
          onClick={openGoals}
        >
          <WidgetRing value={progress ?? 0} size={70} tone="accent">
            {p != null ? `${p}%` : '—'}
          </WidgetRing>
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="accent"
          kicker={s.physiqueGoal}
          badge={p != null ? `${s.overall} ${p}%` : undefined}
          title={name}
          sub={goal != null ? `${s.targetKg(one(goal))} · ${paceLine}` : s.setTarget}
          bodyLast
          onClick={openGoals}
        >
          <WidgetBar value={progress ?? 0} tone="accent" height={8} />
        </Widget>
      );
    if (goal == null)
      return (
        <WidgetEmpty
          size="XL"
          tone="accent"
          icon="target"
          kicker={s.physiqueGoal}
          title={name}
          sub={arch?.blurb ?? s.setTarget}
          action={s.setTarget}
          onAction={openBody}
        />
      );
    const rows = [
      ...(goal != null && cur != null
        ? [
            {
              label: `${s.weight} · ${startW != null ? one(startW) : '—'} → ${one(goal)} kg`,
              value: `${one(cur)}`,
            },
          ]
        : []),
      ...(bm?.bodyFatPct != null ? [{ label: s.bodyFat, value: `${one(bm.bodyFatPct)}%` }] : []),
      ...(bm?.waistCm ? [{ label: s.waist, value: `${bm.waistCm} cm` }] : []),
      ...(bm?.chestCm ? [{ label: s.chest, value: `${bm.chestCm} cm` }] : []),
    ];
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.physiqueGoal}
        badge={phys ? s.startedX(fmtDayMonth(phys.setAt, locale)) : undefined}
        title={name}
        sub={arch?.blurb ?? paceLine}
        onClick={openGoals}
        footer={
          goal != null ? (
            <Button variant="primary" size="sm" fullWidth onClick={openGoals}>
              {s.adjustGoal}
            </Button>
          ) : (
            <Button variant="primary" size="sm" fullWidth onClick={openBody}>
              {s.setTarget}
            </Button>
          )
        }
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <WidgetRing value={progress ?? 0} size={96} tone="accent">
            {p != null ? `${p}%` : '—'}
          </WidgetRing>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span className="uiw-kicker">{s.overall}</span>
            <span className="uiw-sub">{paceLine}</span>
          </div>
        </div>
        {rows.length > 0 && <WidgetList rows={rows} />}
      </Widget>
    );
  },
};

/* ---------- Rest & illness log ---------- */

type DayKind = 'train' | 'rest' | 'sick' | 'off' | 'none';
const KIND_COLOR: Record<DayKind, string> = {
  train: 'var(--color-accent)',
  rest: 'var(--color-rest)',
  sick: 'var(--color-illness)',
  off: 'var(--color-active)',
  none: 'var(--color-neutral-800)',
};

/** Proportional bar of the 30 days by kind. */
function KindBar({ counts }: { counts: Record<DayKind, number> }) {
  const order: DayKind[] = ['train', 'rest', 'sick', 'off'];
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        height: 10,
        borderRadius: 'var(--radius-pill)',
        overflow: 'hidden',
      }}
    >
      {order
        .filter((k) => counts[k] > 0)
        .map((k) => (
          <span key={k} style={{ flex: counts[k], background: KIND_COLOR[k] }} />
        ))}
    </div>
  );
}

/** 30 day cells, oldest first, coloured by kind. */
function DayGrid({ kinds }: { kinds: DayKind[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15, minmax(0, 1fr))', gap: 4 }}>
      {kinds.map((k, i) => (
        <span
          key={i}
          style={{ height: 14, borderRadius: 'var(--radius-sm)', background: KIND_COLOR[k] }}
        />
      ))}
    </div>
  );
}

const restLog: WidgetDef = {
  id: 'rest-illness-log',
  group: 'body',
  icon: 'bed',
  tone: 'rest',
  name: () => bs(getLocale()).restLog,
  render: (size, { store, now, locale, shell }) => {
    const s = bs(locale);
    const today = dayKey(now);
    const from = today - 29;
    const finished = store.workouts.filter((w) => w.finishedAt !== null);
    const trained = new Set(finished.map((w) => dayKey(w.startedAt)));
    const firstDay = finished.length ? Math.min(...finished.map((w) => dayKey(w.startedAt))) : null;
    const periods = (store.restPeriods ?? [])
      .filter((r) => r.startDay <= today && (r.open ? today : r.endDay) >= from)
      .sort((a, b) => a.createdAt - b.createdAt);
    const mode = new Map<number, string>();
    for (const r of periods)
      for (let d = Math.max(from, r.startDay); d <= Math.min(today, r.open ? today : r.endDay); d++)
        mode.set(d, r.mode);
    const kinds: DayKind[] = Array.from({ length: 30 }, (_, i) => {
      const d = from + i;
      if (trained.has(d)) return 'train';
      const m = mode.get(d);
      if (m === 'illness') return 'sick';
      if (m === 'off') return 'off';
      if (m === 'active') return 'rest';
      // Unlogged past days count as rest (they keep the streak) once you've started.
      if (d < today && firstDay != null && d >= firstDay) return 'rest';
      return 'none';
    });
    const counts: Record<DayKind, number> = { train: 0, rest: 0, sick: 0, off: 0, none: 0 };
    for (const k of kinds) counts[k]++;
    const offTotal = counts.rest + counts.sick + counts.off;
    const streak = consistencyStreak(now);
    const open = () => shell.openOverlay({ screen: 'health', view: 'history' });
    const logDay = () => shell.openOverlay({ screen: 'health' });
    if (counts.train === 0 && periods.length === 0) {
      if (size === 'M')
        return (
          <Widget
            size="M"
            tone="rest"
            icon="bed"
            title={s.restLog}
            sub={s.noRest}
            onClick={logDay}
          />
        );
      return (
        <Widget
          size={size}
          tone="rest"
          kicker={s.rest30}
          title={s.noRest}
          onClick={logDay}
          footer={
            size === 'S' ? undefined : (
              <Button variant="primary" size="sm" onClick={logDay}>
                {s.logDay}
              </Button>
            )
          }
        />
      );
    }
    const stats = [
      { label: s.kindTrain, value: counts.train },
      { label: s.kindRest, value: counts.rest },
      { label: s.kindSick, value: counts.sick },
      { label: s.kindOff, value: counts.off },
    ];
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="rest"
          icon="bed"
          title={s.restSickOff(counts.rest, counts.sick, counts.off)}
          sub={s.last30Safe(streak)}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="rest"
          kicker={s.rest30}
          value={offTotal}
          unit={s.daysOff}
          sub={s.streakKept(streak)}
          onClick={open}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="rest"
          kicker={s.restIllness30}
          badge={s.streakKept(streak)}
          onClick={open}
        >
          <KindBar counts={counts} />
          <WidgetStats items={stats} />
        </Widget>
      );
    const fmtDay = (d: number) => fmtDayMonth(dayToTs(d), locale);
    const recent = periods
      .slice()
      .sort((a, b) => b.startDay - a.startDay)
      .slice(0, 3)
      .map((r) => {
        const end = r.open ? today : r.endDay;
        return {
          label: r.name ? `${s.modeName[r.mode]} · ${r.name}` : s.modeName[r.mode],
          value: end > r.startDay ? `${fmtDay(r.startDay)} – ${fmtDay(end)}` : fmtDay(r.startDay),
        };
      });
    return (
      <Widget
        size="XL"
        tone="rest"
        kicker={s.restIllness30}
        badge={s.streakKept(streak)}
        onClick={open}
        footer={
          <>
            <span className="uiw-sub" style={{ flex: 1, minWidth: 0 }}>
              {s.noneBroke}
            </span>
            <Button variant="primary" size="sm" icon="plus" onClick={logDay}>
              {s.logDay}
            </Button>
          </>
        }
      >
        <DayGrid kinds={kinds} />
        <WidgetStats items={stats} />
        {recent.length > 0 && <WidgetList rows={recent} />}
      </Widget>
    );
  },
};

export const BODY_PLUS_WIDGETS: WidgetDef[] = [
  sleepDebt,
  bedtime,
  naps,
  bodyComposition,
  restingEnergy,
  physiqueGoal,
  restLog,
];
