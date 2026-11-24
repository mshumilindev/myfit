/**
 * The Readiness widget of Today (add-on Fatigue & readiness): recovery across muscles (recovery.ts). The body lives in the lazy chunk
 * and reaches the Today shell through `fatigueHost.ReadinessWidget`.
 */
import { Widget, WidgetBar, WidgetList, WidgetRing } from '../components/ui/Widget';
import { Button } from '../components/ui/Button';
import { muscleReadiness } from '../recovery';
import { pct } from '../today/widgets/format';
import type { FatigueWidgetCtx } from './widgetCtx';
import type { FatigueWidgetProps } from '../fatigueApi';

export function ReadinessWidget({ size, ctx: rawCtx }: FatigueWidgetProps) {
  const ctx = rawCtx as FatigueWidgetCtx;
  const { store, now, t, tw, shell } = ctx;
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
}
