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
import { muscleReadiness } from '../../recovery';
import { finishedNights, nightDurationMin, lastNight } from '../../sleep';
import { fmtDayMonth, fmtWeekdayDayMonth, fmtWeekdayShort, getLocale } from '../../i18n';
import { restingForDay } from '../../dayEnergy';
import { activityCalories, durationMin, workoutCalories } from '../../activities';
import { dayKey, latestWeight } from '../../store';
import {
  ADVANCE_STREAK,
  REHAB_STAGES,
  activeInjuries,
  consecutiveFine,
  inFullRest,
  loadFactor,
  stageIndex,
} from '../../injury';
import type { Injury } from '../../types';
import type { WidgetCtx, WidgetDef } from '../registry';
import { DAY, clock, hm, pct, signed } from './format';
import { bs } from './body.strings';

/** Readiness: recovery across muscles (recovery.ts). */
const readiness: WidgetDef = {
  id: 'readiness',
  group: 'body',
  icon: 'heartbeat',
  tone: 'ok',
  name: (tw) => tw.readiness,
  render: (size, { store, now, t, tw, shell }) => {
    const finished = store.workouts.filter((w) => w.finishedAt !== null);
    const all = [...muscleReadiness(finished, now).values()];
    const avg = all.length ? all.reduce((s, m) => s + m.readiness, 0) / all.length : 1;
    const cooling = all.filter((m) => m.state === 'recovering' || m.state === 'nearly');
    const sub = cooling.length ? tw.recovering(cooling.length) : tw.allReady;
    const rows = all
      .slice()
      .sort((a, b) => a.readiness - b.readiness)
      .map((m) => ({
        label: t.muscleGroups[m.muscle] ?? m.muscle,
        value: String(pct(m.readiness)),
      }));
    const open = () => shell.goTab('progress');
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="ok"
          icon="heartbeat"
          title={tw.readyPct(pct(avg))}
          sub={sub}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="ok"
          kicker={tw.readiness}
          value={pct(avg)}
          unit="%"
          sub={sub}
          bodyLast
          onClick={open}
        >
          <WidgetBar value={avg} />
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget size="L" tone="ok" kicker={tw.readiness} onClick={open}>
          <div className="ul-flex ug-16 ua-center">
            <WidgetRing value={avg} size={96}>
              {pct(avg)}
            </WidgetRing>
            <div className="uf-1 umw-0">
              <WidgetList rows={rows.slice(0, 3)} />
            </div>
          </div>
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="ok"
        kicker={tw.muscleReadiness}
        badge={`${pct(avg)}%`}
        onClick={open}
        footer={
          <Button variant="secondary" size="sm" fullWidth onClick={open}>
            {tw.openMuscles}
          </Button>
        }
      >
        <WidgetList rows={rows.slice(0, 6)} />
      </Widget>
    );
  },
};

/** Sleep: the last night, the week's pattern. */
const sleep: WidgetDef = {
  id: 'sleep',
  group: 'body',
  icon: 'moon',
  tone: 'sleep',
  name: (tw) => tw.lastNight,
  render: (size, { store, now, tw, locale, shell }) => {
    const night = lastNight(store.sleeps, now);
    const open = () =>
      shell.openOverlay({ screen: 'sleep', mode: night ? 'edit' : 'backfill', nightId: night?.id });
    if (!night) {
      return size === 'M' ? (
        <Widget
          size="M"
          tone="sleep"
          icon="moon"
          title={tw.noNight}
          sub={tw.logSleep}
          onClick={open}
        />
      ) : (
        <Widget
          size={size}
          tone="sleep"
          kicker={tw.lastNight}
          title={tw.noNight}
          onClick={open}
          footer={
            size === 'S' ? undefined : (
              <Button variant="secondary" size="sm" onClick={open}>
                {tw.logSleep}
              </Button>
            )
          }
        />
      );
    }
    const dur = nightDurationMin(night, now);
    const span = `${clock(night.bedtime)} → ${clock(night.wake ?? now)}`;
    const nights = finishedNights(store.sleeps, now).slice(0, 7).reverse();
    const durs = nights.map((n) => nightDurationMin(n, now));
    const avg = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : dur;
    const hmParts = hm(dur).split(' ');
    const bars = (
      <WidgetBars
        tone="sleep"
        values={durs}
        highlight={[durs.length - 1]}
        height={size === 'XL' ? 150 : 44}
        labels={
          size === 'XL'
            ? nights.map((n) => fmtWeekdayShort(n.wake ?? n.bedtime, locale).slice(0, 2))
            : undefined
        }
      />
    );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="sleep"
          icon="moon"
          title={tw.slept(hm(dur))}
          sub={span}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="sleep"
          kicker={tw.lastNight}
          value={hmParts[0]}
          unit={hmParts[1]}
          sub={span}
          onClick={open}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="sleep"
          kicker={tw.lastNight}
          badge={span}
          value={hm(dur)}
          sub={tw.avg7(hm(avg))}
          onClick={open}
          bodyLast
        >
          {bars}
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="sleep"
        kicker={tw.sleep7}
        value={hm(avg)}
        sub={tw.avg7(hm(avg))}
        onClick={open}
        bodyLast
        footer={
          <WidgetStats
            items={[
              { label: tw.lastNight, value: hm(dur) },
              { label: '→', value: span },
            ]}
          />
        }
      >
        {bars}
      </Widget>
    );
  },
};

/** Body weight: latest weigh-in, 30-day trend, quick log. */
const weight: WidgetDef = {
  id: 'body-weight',
  group: 'body',
  icon: 'scales',
  tone: 'neutral',
  name: (tw) => tw.bodyWeight,
  render: (size, { store, now, tw, openWeight }) => {
    const ws = (store.bodyMetrics?.weights ?? []).slice().sort((a, b) => a.at - b.at);
    const last = ws[ws.length - 1];
    if (!last)
      return size === 'M' ? (
        <Widget
          size="M"
          tone="neutral"
          icon="scales"
          title={tw.noWeight}
          onClick={openWeight}
          trailing={
            <Button variant="secondary" size="sm" onClick={openWeight}>
              +
            </Button>
          }
        />
      ) : (
        <Widget
          size={size}
          tone="neutral"
          kicker={tw.bodyWeight}
          title={tw.noWeight}
          onClick={openWeight}
          footer={
            <Button variant="secondary" size="sm" onClick={openWeight}>
              {tw.logWeight}
            </Button>
          }
        />
      );
    const weekAgo = ws.filter((w) => w.at <= now - 7 * DAY).pop();
    const d7 = weekAgo ? last.weight - weekAgo.weight : 0;
    const month = ws.filter((w) => w.at >= now - 30 * DAY);
    const d30 = month.length > 1 ? last.weight - month[0].weight : 0;
    const delta = <WidgetDelta good={d7 <= 0}>{tw.weekDelta(signed(d7))}</WidgetDelta>;
    const spark = (
      <WidgetSpark
        points={month.map((w) => w.weight)}
        height={size === 'XL' ? 150 : 56}
        tone="neutral"
      />
    );
    const logBtn = (
      <Button variant="secondary" size="sm" onClick={openWeight}>
        {size === 'M' ? '+' : tw.logWeight}
      </Button>
    );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="neutral"
          icon="scales"
          title={`${last.weight} kg`}
          sub={tw.weekDelta(signed(d7))}
          onClick={openWeight}
          trailing={logBtn}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="neutral"
          kicker={tw.bodyWeight}
          value={last.weight}
          unit="kg"
          sub={delta}
          onClick={openWeight}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="neutral"
          kicker={tw.weight30}
          badge={<WidgetDelta good={d30 <= 0}>{`${signed(d30)} kg`}</WidgetDelta>}
          value={last.weight}
          unit="kg"
          bodyLast
          onClick={openWeight}
        >
          {month.length > 1 ? spark : null}
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="neutral"
        kicker={tw.weight30}
        badge={<WidgetDelta good={d30 <= 0}>{`${signed(d30)} kg`}</WidgetDelta>}
        value={last.weight}
        unit="kg"
        sub={delta}
        bodyLast
        onClick={openWeight}
        footer={logBtn}
      >
        {month.length > 1 ? spark : null}
      </Widget>
    );
  },
};

/* ---------- Energy today (dayEnergy.ts + activities.ts) ---------- */

interface EnergyItem {
  label: string;
  kcal: number;
  at: number;
  icon: string;
  activity: boolean;
}

/** Today's burn: the resting baseline so far (dayEnergy) + every logged session. */
function energyOfToday({ store, now, t, locale }: WidgetCtx) {
  const s = bs(locale);
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const start = d.getTime();
  const end = start + DAY;
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;
  const rest = restingForDay(store.bodyMetrics, store.workouts, store.activities, start, now);
  const items: EnergyItem[] = [];
  for (const w of store.workouts) {
    if (w.finishedAt === null || w.startedAt < start || w.startedAt >= end) continue;
    const kcal = workoutCalories(w, bodyKg);
    if (kcal)
      items.push({
        label: `${w.dayName || s.workout} · ${clock(w.startedAt)}`,
        kcal,
        at: w.startedAt,
        icon: 'barbell',
        activity: false,
      });
  }
  for (const a of store.activities) {
    if (a.finishedAt === null || a.startedAt < start || a.startedAt >= end) continue;
    const kcal = activityCalories(a, bodyKg);
    if (kcal)
      items.push({
        label: `${t.actType[a.type] ?? a.type} · ${s.minN(Math.round(durationMin(a)))}`,
        kcal,
        at: a.startedAt,
        icon: 'person-simple-run',
        activity: true,
      });
  }
  items.sort((a, b) => a.at - b.at);
  const lift = items.filter((i) => !i.activity).reduce((x, i) => x + i.kcal, 0);
  const acts = items.filter((i) => i.activity).reduce((x, i) => x + i.kcal, 0);
  const active = Math.round(lift + acts);
  // Hour-by-hour: the resting burn spread over the hours elapsed so far, each
  // session added in the hour it started.
  const elapsedH = Math.max(1, Math.ceil((now - start) / 3600000));
  const hourly = Array.from({ length: 24 }, (_, h) => (h < elapsedH ? (rest ?? 0) / elapsedH : 0));
  const hot = new Set<number>();
  for (const it of items) {
    const h = new Date(it.at).getHours();
    hourly[h] += it.kcal;
    hot.add(h);
  }
  return {
    start,
    rest,
    lift: Math.round(lift),
    acts: Math.round(acts),
    active,
    total: (rest ?? 0) + active,
    items,
    hourly,
    hot: [...hot],
  };
}

const energyToday: WidgetDef = {
  id: 'energy-today',
  group: 'body',
  icon: 'flame',
  tone: 'kcal',
  name: () => bs(getLocale()).energyToday,
  render: (size, ctx) => {
    const { locale, shell, tw, openWeight } = ctx;
    const s = bs(locale);
    const e = energyOfToday(ctx);
    const n = (x: number) => Math.round(x).toLocaleString(locale);
    const open = () => shell.openOverlay({ screen: 'history' });
    if (e.rest == null && e.active === 0) {
      if (size === 'M')
        return (
          <Widget
            size="M"
            tone="kcal"
            icon="flame"
            title={s.noEnergy}
            sub={s.noEnergySub}
            onClick={openWeight}
            trailing={
              <Button variant="secondary" size="sm" onClick={openWeight}>
                +
              </Button>
            }
          />
        );
      return (
        <Widget
          size={size}
          tone="kcal"
          kicker={size === 'S' ? s.burnedToday : s.energyToday}
          title={s.noEnergy}
          sub={s.noEnergySub}
          onClick={openWeight}
          footer={
            size === 'S' ? undefined : (
              <Button variant="primary" size="sm" onClick={openWeight}>
                {tw.logWeight}
              </Button>
            )
          }
        />
      );
    }
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="kcal"
          icon="flame"
          title={s.kcalToday(n(e.total))}
          sub={s.activeResting(n(e.active), n(e.rest ?? 0))}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="kcal"
          kicker={s.burnedToday}
          value={n(e.total)}
          unit={s.kcal}
          sub={s.activeN(n(e.active))}
          onClick={open}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="kcal"
          kicker={s.energyToday}
          value={n(e.total)}
          unit={s.kcal}
          bodyLast
          onClick={open}
        >
          <WidgetStats
            items={[
              { label: s.resting, value: n(e.rest ?? 0) },
              { label: s.workout, value: n(e.lift) },
              { label: s.activities, value: n(e.acts) },
            ]}
          />
        </Widget>
      );
    const rows = [
      { icon: 'bed', tone: 'kcal' as const, label: s.resting, value: n(e.rest ?? 0) },
      ...e.items.slice(0, 3).map((i) => ({
        icon: i.icon,
        tone: 'kcal' as const,
        label: i.label,
        value: n(i.kcal),
      })),
      { label: s.total, value: `${n(e.total)} ${s.kcal}` },
    ];
    return (
      <Widget
        size="XL"
        tone="kcal"
        kicker={s.energyOn(fmtWeekdayDayMonth(e.start, locale))}
        badge={s.byHour}
        value={n(e.total)}
        unit={s.kcal}
        sub={s.activeN(n(e.active))}
        bodyLast
        onClick={open}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={open}>
            {s.dayHistory}
          </Button>
        }
      >
        <WidgetBars
          tone="kcal"
          values={e.hourly}
          highlight={e.hot}
          height={72}
          labels={e.hourly.map((_, h) => (h % 6 === 0 ? String(h).padStart(2, '0') : ''))}
        />
        <WidgetList rows={rows} />
      </Widget>
    );
  },
};

/* ---------- Rehab plan (injury.ts) ---------- */

/** The four rehab stages as a segmented ladder: done = ok, current = injury. */
function StageLadder({ idx, labels }: { idx: number; labels?: string[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${REHAB_STAGES.length}, minmax(0, 1fr))`,
        gap: 6,
      }}
    >
      {REHAB_STAGES.map((sid, i) => (
        <div key={sid} className="ul-flex ul-col ug-4 umw-0">
          <span
            className="ur-pill"
            style={{
              height: 6,
              background:
                i < idx
                  ? 'var(--color-ok)'
                  : i === idx
                    ? 'var(--color-injury)'
                    : 'var(--color-neutral-700)',
            }}
          />
          {labels && (
            <span
              className="uiw-t-sm"
              style={{
                color: i === idx ? 'var(--color-text)' : 'var(--color-text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {labels[i]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function currentInjury(injuries: Injury[]): Injury | null {
  return activeInjuries(injuries ?? []).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

const rehab: WidgetDef = {
  id: 'rehab',
  group: 'body',
  icon: 'bandaids',
  tone: 'injury',
  name: () => bs(getLocale()).rehabPlan,
  render: (size, { store, now, t, locale, shell }) => {
    const s = bs(locale);
    const inj = currentInjury(store.injuries);
    if (!inj) {
      const start = () =>
        shell.openOverlay({
          screen: 'health',
          form: { kind: 'new', ctx: 'start', type: 'injury' },
        });
      return (
        <WidgetEmpty
          size={size}
          tone="injury"
          icon="bandaids"
          kicker={s.rehab}
          title={s.noRehab}
          sub={s.noRehabSub}
          action={s.startRehab}
          onAction={start}
        />
      );
    }
    const today = dayKey(now);
    const fullRest = inFullRest(inj, today);
    const idx = fullRest ? -1 : stageIndex(inj.stage);
    const total = REHAB_STAGES.length;
    const stageNum = Math.max(0, idx + 1);
    const stageName = fullRest ? t.injStage0 : t.injStage[inj.stage];
    const baseName =
      inj.reason === 'injury'
        ? (t.injBodyParts[inj.bodyPart] ?? inj.bodyPart)
        : t.injReason[inj.reason];
    const part =
      inj.reason === 'injury' && inj.side && inj.side !== 'both'
        ? `${baseName} (${t.injSide[inj.side]})`
        : baseName;
    const status = fullRest
      ? t.injStage0Left(Math.max(0, (inj.fullRestUntil ?? today) - today))
      : inj.pendingAdvance
        ? s.readyMoveUp
        : inj.stage !== 'return'
          ? s.goodCheckins(consecutiveFine(inj), ADVANCE_STREAK)
          : s.checkinNext;
    const canCheckin = !fullRest && inj.stage !== 'protect';
    const open = () => shell.openOverlay({ screen: 'injury', injuryId: inj.id });
    const checkin = () => shell.openOverlay({ screen: 'injury', injuryId: inj.id, checkin: true });
    const action = (
      <Button
        variant="primary"
        size="sm"
        fullWidth={size === 'XL'}
        onClick={canCheckin ? checkin : open}
      >
        {canCheckin ? t.injBannerCheckin : t.injViewPlan}
      </Button>
    );
    const stageLine = `${s.stageOf(stageNum, total)} · ${stageName}`;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="injury"
          icon="bandaids"
          title={`${part} · ${s.stageOf(stageNum, total)}`}
          sub={status}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="injury"
          kicker={s.rehab}
          sub={`${part} · ${stageName}`}
          onClick={open}
        >
          <WidgetRing value={stageNum / total} size={70} tone="injury">
            {`${stageNum}/${total}`}
          </WidgetRing>
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="injury"
          kicker={s.rehabOf(part)}
          badge={s.dayN(today - inj.startDay + 1)}
          title={stageLine}
          onClick={open}
          footer={
            <>
              <span className="uiw-sub uf-1 umw-0">{status}</span>
              {action}
            </>
          }
        >
          <StageLadder idx={idx} />
        </Widget>
      );
    const factor = loadFactor(inj.stage);
    const last = inj.checkins[inj.checkins.length - 1];
    const feel = { fine: t.injCiFine, sore: t.injCiSore, pain: t.injCiPain };
    const rows = inj.muscles.slice(0, 4).map((m) => ({
      label: t.muscleGroups[m] ?? m,
      value: fullRest || factor === 0 ? s.outOfTraining : `${pct(factor)}%`,
    }));
    return (
      <Widget
        size="XL"
        tone="injury"
        kicker={s.rehabOf(part)}
        badge={s.dayN(today - inj.startDay + 1)}
        title={stageLine}
        sub={status}
        bodyLast
        onClick={open}
        footer={action}
      >
        <StageLadder idx={idx} labels={REHAB_STAGES.map((sid) => t.injStage[sid])} />
        {rows.length > 0 && <span className="uiw-kicker">{s.protectedLoad}</span>}
        <WidgetList rows={rows} />
        {last && (
          <span className="uiw-sub">
            {s.lastCheckin(feel[last.feel], fmtDayMonth(last.at, locale))}
          </span>
        )}
      </Widget>
    );
  },
};

export const BODY_WIDGETS: WidgetDef[] = [readiness, sleep, weight, energyToday, rehab];
