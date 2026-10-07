/**
 * Cycle widget: a quiet one-line read of today (day and a rough phase). Never advice, never a
 * plan change. Off / paused / stale / log-only states show a neutral line and open the Cycle.
 */
import { Widget } from '../../components/ui/Widget';
import { cycleToday } from '../../cycle/cycleView';
import { PHASE_TONE } from '../../views/health/cycle/text';
import type { WidgetCtx, WidgetDef } from '../registry';

function CycleBody({ size, ctx }: { size: Parameters<WidgetDef['render']>[0]; ctx: WidgetCtx }) {
  const { store, now, t, shell } = ctx;
  const open = () => shell.openOverlay({ screen: 'health', cyc: 'hub' });
  const today = cycleToday(store.cycle, store.conditions, now);
  const shown = store.cycle.surfaces.today;
  const phase = {
    menses: t.cycPhMenses,
    early: t.cycPhEarly,
    mid: t.cycPhMid,
    late: t.cycPhLate,
  };
  let title: string = t.cycTitle;
  let sub: string | undefined;
  let tone: 'conditioning' | (typeof PHASE_TONE)[keyof typeof PHASE_TONE] = 'conditioning';
  if (today.kind === 'ok' && shown) {
    tone = PHASE_TONE[today.est.phase];
    title = phase[today.est.phase];
    sub = t.cycRowDay(today.est.dayOfCycle, t.cycApprox);
  } else if (today.kind === 'off') sub = t.cycRowOff;
  else if (today.kind === 'paused')
    sub = today.why === 'pregnancy' ? t.cycRowPaused : t.cycRowMenopause;
  else if (today.kind === 'stale') sub = t.cycStaleBtn;
  else if (today.kind === 'log') sub = t.cycRowLog;
  return (
    <Widget
      size={size}
      tone={tone}
      icon="drop-half"
      kicker={t.cycTitle}
      title={title}
      sub={sub}
      onClick={open}
      ariaLabel={t.cycTitle}
    />
  );
}

const cycle: WidgetDef = {
  id: 'cycle',
  group: 'body',
  icon: 'drop-half',
  tone: 'conditioning',
  name: (tw) => tw.cycleWidget,
  render: (size, ctx) => <CycleBody size={size} ctx={ctx} />,
};

export const CYCLE_WIDGETS: WidgetDef[] = [cycle];
