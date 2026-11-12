import { Icon } from '../ui';
import { useT } from '../i18n';
import { usePlannerHost } from '../plannerRt';

/**
 * "Planner · 2 today ›" under the week pills. Shown only while Planner is installed and a plan is left today; the words come from
 * the Planner chunk (the core carries none of them). Opens the Planner screen.
 */
export function PlannerWeekLink({ now, onOpen }: { now: number; onOpen: () => void }) {
  const { locale } = useT();
  const host = usePlannerHost();
  const line = host?.todayLine?.(now, locale) ?? null;
  if (!line) return null;
  return (
    <button type="button" className="td-week-planner" onClick={onOpen}>
      <Icon name="calendar-dots" />
      <span>{line}</span>
      <Icon name="caret-right" />
    </button>
  );
}
