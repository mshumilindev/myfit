import { Widget, WidgetEmpty, WidgetList, type WidgetSize } from '../components/ui/Widget';
import { useT, type LocaleId } from '../i18n';
import { dayShort, durText } from './fmt';
import { fill, STRINGS, type PlannerStrings } from './strings';
import { usePlans } from './sync';
import { localParts } from './zoned';
import { upNextItems, type UpNextItem } from './upNextModel';

const hhmm = (i: UpNextItem) => localParts(i.startAt, i.plan.timing.tz).time;

/** "Now", "In 45 min", "In 2 h 10", or the weekday and time once it is a day or more away. */
export function whenText(s: PlannerStrings, locale: LocaleId, i: UpNextItem, now: number): string {
  if (i.ongoing) return s.nowLabel;
  const mins = Math.max(1, Math.ceil((i.startAt - now) / 60_000));
  if (mins < 24 * 60) return fill(s.inRel, { x: durText(s, mins) });
  return `${dayShort(locale, localParts(i.startAt, i.plan.timing.tz).day)} ${hhmm(i)}`;
}

/** The Today widget "Planner: up next" (S / M / L / XL). The core renders this through `plannerHost.UpNext`. */
export function UpNext({
  size,
  now,
  onOpen,
}: {
  size: WidgetSize;
  now: number;
  onOpen: () => void;
}) {
  const { locale } = useT();
  const s = STRINGS[locale];
  const plans = usePlans();
  const items = upNextItems(plans, now, size === 'XL' ? 5 : 3);
  const first = items[0];
  if (!first)
    return (
      <WidgetEmpty
        size={size}
        tone="accent"
        icon="calendar-dots"
        kicker={s.upNextPlanner}
        title={s.nothingNext}
        action={s.addPlan}
        onAction={onOpen}
      />
    );
  const when = whenText(s, locale, first, now);
  const title = first.plan.title;
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="accent"
        icon={first.plan.icon}
        title={`${title} · ${hhmm(first)}`}
        sub={when}
        onClick={onOpen}
        ariaLabel={`${s.upNextPlanner}: ${title}`}
      />
    );
  const rows = items.slice(size === 'S' ? 0 : 1).map((i) => ({
    label: i.plan.title,
    value: i.ongoing ? s.nowLabel : hhmm(i),
    icon: i.plan.icon,
    tone: 'accent' as const,
  }));
  return (
    <Widget
      size={size}
      tone="accent"
      icon={first.plan.icon}
      kicker={s.upNextPlanner}
      value={size === 'S' ? hhmm(first) : undefined}
      title={title}
      sub={first.plan.mode === 'ring' && size !== 'S' ? `${when} · ${s.ringsUntil}` : when}
      onClick={onOpen}
      ariaLabel={`${s.upNextPlanner}: ${title}`}
      bodyLast
    >
      {size !== 'S' && rows.length > 0 ? <WidgetList rows={rows} /> : undefined}
    </Widget>
  );
}
