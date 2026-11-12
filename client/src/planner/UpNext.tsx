import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Icon } from '../ui';
import { Widget, WidgetEmpty, WidgetList, type WidgetSize } from '../components/ui/Widget';
import type { Tone } from '../components/ui/tones';
import { useT, type LocaleId } from '../i18n';
import { dayShort, durText } from './fmt';
import { fill, STRINGS, type PlannerStrings } from './strings';
import { usePlans } from './sync';
import { localParts } from './zoned';
import { upNextItems, type UpNextItem } from './upNextModel';

/** A plan's own colour (`uit--<colour>` is defined with the Planner styles) in the kit's tone slot. */
const toneOf = (i: UpNextItem): Tone => i.plan.color as Tone;

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
  variant = 'card',
}: {
  size: WidgetSize;
  now: number;
  onOpen: () => void;
  variant?: 'card' | 'inline';
}) {
  if (variant === 'inline') return <UpNextInline size={size} now={now} onOpen={onOpen} />;
  return <UpNextCard size={size} now={now} onOpen={onOpen} />;
}

function UpNextCard({ size, now, onOpen }: { size: WidgetSize; now: number; onOpen: () => void }) {
  const { locale } = useT();
  const s = STRINGS[locale];
  const plans = usePlans();
  const items = upNextItems(plans, now, size === 'XL' ? 5 : 3, 7, true);
  const first = items[0];
  if (!first)
    return (
      <WidgetEmpty
        size={size}
        tone="accent"
        icon="calendar-dots"
        kicker={s.upNextPlanner}
        title={s.nothingToday}
        action={s.viewPlanner}
        onAction={onOpen}
      />
    );
  const when = whenText(s, locale, first, now);
  const title = first.plan.title;
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone={toneOf(first)}
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
    tone: toneOf(i),
  }));
  return (
    <Widget
      size={size}
      tone={toneOf(first)}
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
 * The same content without a card, for the inside of the week card (one card instead of two while Planner is installed): a divider,
 * "Up next · Planner" and the next plans (1 / 3 / 5 by size), or the empty line with the way in.
 */
function UpNextInline({
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
  const items = upNextItems(plans, now, size === 'XL' ? 5 : size === 'L' ? 3 : 1, 7, true);
  return (
    <div className={`pl-upin pl-upin--${size.toLowerCase()}`} data-size={size}>
      {size !== 'M' && <div className="pl-upin-k">{s.upNextPlanner}</div>}
      {items.length === 0 ? (
        <div className="pl-upin-empty">
          <div className="pl-upin-txt">
            <div className="pl-upin-t">{s.nothingToday}</div>
          </div>
          <Button variant="secondary" size="sm" onClick={onOpen}>
            {s.viewPlanner}
          </Button>
        </div>
      ) : (
        <Card as="button" emphasis="quiet" pad="none" className="pl-upin-list" onClick={onOpen}>
          {items.map((i) => (
            <span key={`${i.plan.id}-${i.startAt}`} className={`pl-upin-row uit--${i.plan.color}`}>
              <Icon name={i.plan.icon} />
              <span className="pl-upin-body">
                <span className="pl-upin-t">{i.plan.title}</span>
                {size === 'XL' && (
                  <span className="pl-upin-w">
                    {i.ongoing ? s.nowLabel : `${whenText(s, locale, i, now)} · ${hhmm(i)}`}
                  </span>
                )}
              </span>
              {size !== 'XL' && (
                <span className="pl-upin-w">
                  {i.ongoing ? s.nowLabel : `${whenText(s, locale, i, now)} · ${hhmm(i)}`}
                </span>
              )}
            </span>
          ))}
        </Card>
      )}
    </div>
  );
}
