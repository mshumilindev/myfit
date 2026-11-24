/**
 * The Fatigue & deload widget of Today (add-on Fatigue & readiness): its body lives in the lazy chunk and reaches the Today shell
 * through `fatigueHost.FatigueWidget`.
 */
import { useMemo, type ReactNode } from 'react';
import { Widget, WidgetBar, WidgetEmpty, WidgetList, WidgetSpark } from '../components/ui/Widget';
import { Button } from '../components/ui/Button';
import { ToneText } from '../components/ui/ToneText';
import type { Tone } from '../components/ui/tones';
import { useSleepsForCalc } from '../addons/useSleeps';
import { workoutVolumeKg } from '../store';
import type { MuscleGroup } from '../data/exercises';
import { deloadSuggestion, muscleFatigue, type FatigueLevel } from '../fatigue';
import { activityRecoveryBias } from '../activities';
import { sleepReadinessBias } from '../sleepRt';
import { deloadMult, sleepNeedExtraMin } from '../calcMods';
import { personalLandmarks } from '../personalize';
import type { Workout } from '../types';
import type { FatigueWidgetProps } from '../fatigueApi';
import type { FatigueWidgetCtx } from './widgetCtx';
import { DAY, signed } from '../today/widgets/format';
import { trs } from '../today/widgets/training.strings';
import { setHash } from '../route';

const HOUR = 3600 * 1000;
const WEEK = 7 * DAY;
const finishedOf = (workouts: Workout[]): Workout[] =>
  workouts.filter((w) => w.finishedAt !== null);
const goHash = (hash: string): void => setHash(hash);

/** Same bands as fatigue.ts levelOf, on the 0–100 load index. */
export function levelOfIdx(idx: number): FatigueLevel {
  // Nicotine lowers the 'high' / 'fried' lines exactly as fatigue.ts does (x1 when off).
  const k = deloadMult();
  if (idx >= 70 * k) return 'fried';
  if (idx >= 40 * k) return 'high';
  if (idx >= 15) return 'moderate';
  return 'fresh';
}
const LEVEL_TONE: Record<FatigueLevel, Tone> = {
  fresh: 'ok',
  moderate: 'accent',
  high: 'accent',
  fried: 'danger',
};

export function FatigueWidget({ size, ctx: rawCtx }: FatigueWidgetProps) {
  const ctx = rawCtx as FatigueWidgetCtx;
  const { store, now, t, locale } = ctx;
  const sleepsForCalc = useSleepsForCalc();
  const s = trs(locale);
  const hour = Math.floor(now / HOUR);
  const finished = useMemo(() => finishedOf(store.workouts), [store.workouts]);
  const data = useMemo(() => {
    const at = hour * HOUR;
    const lm = personalLandmarks(finished, at);
    // Load index = mean of the five most-loaded muscles' fatigue scores.
    const indexAt = (ts: number) => {
      const fat = muscleFatigue(
        finished.filter((w) => w.startedAt <= ts),
        ts,
        lm,
        { acute: false }, // the load index stays the weekly read (SPO-601)
      );
      const top = [...fat.values()]
        .map((f) => f.score)
        .sort((a, b) => b - a)
        .slice(0, 5);
      return { fat, idx: Math.round((top.reduce((a, b) => a + b, 0) / (top.length || 1)) * 100) };
    };
    const cur = indexAt(at);
    const trend = [5, 4, 3, 2, 1].map((k) => indexAt(at - k * WEEK).idx).concat(cur.idx);
    const goal = store.sleepSettings?.goalMin ?? 480;
    const sleepBias = sleepReadinessBias(sleepsForCalc, at, goal, sleepNeedExtraMin(at));
    const deload = deloadSuggestion(
      cur.fat,
      activityRecoveryBias(store.activities, at) + 0.6 * sleepBias,
    );
    const vol = (a: number, b: number) =>
      finished
        .filter((w) => w.startedAt >= a && w.startedAt < b)
        .reduce((sum, w) => sum + workoutVolumeKg(w), 0);
    const wk = vol(at - WEEK, at);
    const prev = [1, 2, 3, 4]
      .map((k) => vol(at - (k + 1) * WEEK, at - k * WEEK))
      .filter((v) => v > 0);
    const avg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : 0;
    const muscles = [...cur.fat.values()];
    return {
      idx: cur.idx,
      trend,
      deload,
      volPct: avg > 0 ? Math.round(((wk - avg) / avg) * 100) : null,
      stalled: muscles.filter((f) => f.stalled).sort((a, b) => b.score - a.score),
      hottest: muscles.filter((f) => f.sets > 0).sort((a, b) => b.score - a.score)[0] ?? null,
      recent: finished.some((w) => w.startedAt >= at - 14 * DAY),
    };
  }, [finished, hour, store.activities, sleepsForCalc, store.sleepSettings]);
  const open = () => goHash('#/progress/volume/fatigue');
  const level = levelOfIdx(data.idx);
  const tone = LEVEL_TONE[level];
  const levelTxt = s.level[level];
  const mName = (m: MuscleGroup) => t.muscleGroups[m] ?? m;
  if (!data.recent)
    return (
      <WidgetEmpty
        size={size}
        tone="rest"
        icon="gauge"
        kicker={s.fatigue}
        title={s.level.fresh}
        sub={s.noFatigue}
        onAction={open}
      />
    );
  const hint =
    data.deload.kind === 'systemic'
      ? s.deloadSystemic
      : data.deload.kind === 'local' && data.deload.muscle
        ? s.deloadLocal(mName(data.deload.muscle))
        : s.deloadNone;
  const levelBadge = (
    <ToneText tone={tone} strong>
      {levelTxt}
    </ToneText>
  );

  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="rest"
        icon="gauge"
        title={s.fatigueIs(levelTxt)}
        sub={hint}
        onClick={open}
      />
    );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="rest"
        kicker={s.fatigue}
        badge={levelBadge}
        value={data.idx}
        unit="/ 100"
        sub={hint}
        bodyLast
        onClick={open}
      >
        <WidgetBar value={data.idx / 100} tone={tone} />
      </Widget>
    );
  if (size === 'L') {
    const title = data.stalled[0]
      ? s.stalledTitle(mName(data.stalled[0].muscle))
      : data.deload.kind !== 'none'
        ? hint
        : s.lowFatigue;
    return (
      <Widget
        size="L"
        tone="rest"
        kicker={s.fatigue}
        badge={levelBadge}
        title={title}
        sub={title === hint ? undefined : hint}
        bodyLast
        onClick={open}
      >
        <WidgetBar value={data.idx / 100} tone={tone} height={8} />
      </Widget>
    );
  }
  const rows: { label: ReactNode; value: ReactNode }[] = [];
  if (data.stalled[0])
    rows.push({
      label: mName(data.stalled[0].muscle),
      value: <ToneText tone="injury">{s.stalled}</ToneText>,
    });
  if (data.hottest)
    rows.push({
      label: mName(data.hottest.muscle),
      value: s.nearLimit(Math.round(data.hottest.sets), data.hottest.mrv),
    });
  if (data.volPct !== null)
    rows.push({ label: s.volumeWeek, value: s.vs4(`${signed(data.volPct, 0)}%`) });
  return (
    <Widget
      size="XL"
      tone="rest"
      kicker={s.fatigue6}
      badge={hint}
      value={data.idx}
      unit={s.of100(levelTxt)}
      bodyLast
      onClick={open}
      footer={
        <Button
          variant={data.deload.kind !== 'none' ? 'primary' : 'secondary'}
          size="sm"
          fullWidth
          onClick={open}
        >
          {data.deload.kind !== 'none' ? s.planDeload : s.openFatigue}
        </Button>
      }
    >
      <WidgetSpark points={data.trend} height={72} tone={tone} area />
      <WidgetList rows={rows} />
    </Widget>
  );
}
