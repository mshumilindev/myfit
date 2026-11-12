import { Button } from '../components/ui/Button';
import { Widget, WidgetEmpty, WidgetList, type WidgetSize } from '../components/ui/Widget';
import { useT, type LocaleId } from '../i18n';
import { dayShort, durText, weekdayShorts } from './fmt';
import { fill, STRINGS, type PlannerStrings } from './strings';
import { usePlans } from './sync';
import { addDays, localParts, parseDay, weekday } from './zoned';
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
  if (!first) return <UpNextEmpty size={size} now={now} onOpen={onOpen} />;
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

/**
 * Nothing planned: a small week strip (today ringed) and one clear way in. The M size stays a single row, from L up the card
 * shows the week so it still looks like a planner, not an error.
 */
function UpNextEmpty({ size, now, onOpen }: { size: WidgetSize; now: number; onOpen: () => void }) {
  const { locale } = useT();
  const s = STRINGS[locale];
  if (size === 'M' || size === 'S')
    return (
      <WidgetEmpty
        size={size}
        tone="accent"
        icon="calendar-dots"
        kicker={s.upNextPlanner}
        title={s.nothingNext}
        sub={s.emptyHint}
        action={s.addPlan}
        onAction={onOpen}
      />
    );
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = localParts(now, tz).day;
  const monday = addDays(today, -weekday(today));
  const names = weekdayShorts(locale);
  return (
    <Widget
      size={size}
      tone="accent"
      icon="calendar-dots"
      kicker={s.upNextPlanner}
      title={s.nothingNext}
      sub={s.emptyHint}
      onClick={onOpen}
      ariaLabel={`${s.upNextPlanner}: ${s.nothingNext}`}
      footer={
        <Button variant="primary" size="sm" icon="plus" onClick={onOpen}>
          {s.addPlan}
        </Button>
      }
    >
      <div className="pl-upweek" aria-hidden="true">
        {names.map((n, i) => {
          const d = addDays(monday, i);
          return (
            <span key={d} className={d === today ? 'pl-upweek-d is-today' : 'pl-upweek-d'}>
              <span>{n}</span>
              <b>{parseDay(d).d}</b>
            </span>
          );
        })}
      </div>
    </Widget>
  );
}
