/**
 * The Planner add-on's Today widget (design SPO-555, "Up next"). The core owns only this shell: the body is drawn by the Planner
 * chunk through `plannerHost.UpNext` once it has loaded, and the registry hides the widget while the add-on is not installed.
 */
import { usePlannerHost } from '../../plannerRt';
import type { WidgetDef } from '../registry';

export const PLANNER_WIDGETS: WidgetDef[] = [
  {
    id: 'planner-up-next',
    group: 'plan',
    icon: 'calendar-dots',
    tone: 'accent',
    name: (tw) => tw.plannerUpNext,
    render: (size, ctx) => (
      <PlannerUpNextBody
        size={size}
        now={ctx.now}
        open={() => ctx.shell.openOverlay({ screen: 'planner' })}
      />
    ),
  },
];

function PlannerUpNextBody({
  size,
  now,
  open,
}: {
  size: Parameters<WidgetDef['render']>[0];
  now: number;
  open: () => void;
}) {
  const host = usePlannerHost();
  const Body = host?.UpNext;
  return Body ? <Body size={size} now={now} onOpen={open} /> : null;
}
