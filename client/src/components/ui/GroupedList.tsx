/**
 * Settings-style grouped lists (iOS "inset grouped"): an uppercase header, a
 * rounded surface of rows separated by inset hairlines, and a muted footer.
 * Rows (ListRow) carry an optional IconTile, a label with a sub-line, a value,
 * and a trailing chevron / checkmark / switch / custom node. ListPanel is the
 * padded area a row expands into (a Calendar, preset chips, a confirm).
 */
import type { AriaAttributes, MouseEvent, ReactNode } from 'react';
import { Icon } from '../../ui';
import { toneClass, type Tone } from './tones';
import './GroupedList.css';

export interface GroupedListProps {
  header?: ReactNode;
  footer?: ReactNode;
  /** Footer as an error (danger colour, role="alert"). */
  footerError?: boolean;
  /** Extra footer lines (each its own paragraph). */
  notes?: ReactNode[];
  /** Surface of the rows: `surface` on the page, `raised` inside a panel / sheet. */
  surface?: 'surface' | 'raised';
  children: ReactNode;
  className?: string;
  /** Accessible name for the group (defaults to nothing — the header is visual). */
  label?: string;
}

export function GroupedList({
  header,
  footer,
  footerError = false,
  notes,
  surface = 'surface',
  children,
  className,
  label,
}: GroupedListProps) {
  return (
    <section
      className={['uigl', surface === 'raised' ? 'uigl--raised' : '', className]
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
    >
      {header != null && <div className="uigl-h">{header}</div>}
      <div className="uigl-rows">{children}</div>
      {footer != null && (
        <div
          className={`uigl-f${footerError ? ' is-error' : ''}`}
          role={footerError ? 'alert' : undefined}
        >
          {footer}
        </div>
      )}
      {notes?.map((n, i) => (
        <div key={i} className="uigl-f">
          {n}
        </div>
      ))}
    </section>
  );
}

type RowAria = Pick<
  AriaAttributes,
  'aria-expanded' | 'aria-pressed' | 'aria-current' | 'aria-label' | 'aria-describedby'
>;

export interface ListRowProps extends RowAria {
  /** Leading glyph — usually an <IconTile>. */
  icon?: ReactNode;
  /** A fixed-width time / clock column before the icon ("02:00"). */
  time?: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  /** Right-aligned value text. */
  value?: ReactNode;
  /** Colour family of the value (default muted grey). */
  valueTone?: Tone;
  valueStrong?: boolean;
  chevron?: boolean;
  /** Trailing checkmark (selected option). */
  check?: boolean;
  checkTone?: Tone;
  /** Any trailing node (Switch, badge, button). */
  trailing?: ReactNode;
  /** Extra inline content after the label (e.g. a text input). */
  children?: ReactNode;
  /** Clickable row (renders a <button>). */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  /** `label` wraps the row in a <label> (switch / input rows). */
  as?: 'div' | 'label';
  /** Centered bold action row ("I'm recovered", "Delete period"). */
  action?: boolean;
  /** Colour of an action row's text. */
  tone?: Tone;
  selected?: boolean;
  dim?: boolean;
  disabled?: boolean;
  /** Label keeps its width instead of flexing (label + input rows). */
  labelFixed?: boolean;
  className?: string;
}

export function ListRow(props: ListRowProps) {
  const {
    icon,
    time,
    label,
    sub,
    value,
    valueTone,
    valueStrong,
    chevron,
    check,
    checkTone = 'accent',
    trailing,
    children,
    onClick,
    as,
    action,
    tone,
    selected,
    dim,
    disabled,
    labelFixed,
    className,
    ...aria
  } = props;
  const cls = [
    'uirow',
    icon ? 'has-icon' : '',
    action ? 'uirow--action' : '',
    tone ? toneClass(tone) : '',
    tone && action ? 'is-toned' : '',
    selected ? 'is-selected' : '',
    dim ? 'is-dim' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const inner = action ? (
    <span className="uirow-action">{label}</span>
  ) : (
    <>
      {time != null && <span className="uirow-time">{time}</span>}
      {icon}
      <span className={`uirow-lb${labelFixed ? ' is-fixed' : ''}`}>
        <span className="uirow-l">{label}</span>
        {sub != null && <span className="uirow-s">{sub}</span>}
      </span>
      {children}
      {value != null && (
        <span
          className={[
            'uirow-v',
            valueTone ? `${toneClass(valueTone)} is-toned` : '',
            valueStrong ? 'is-strong' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {value}
        </span>
      )}
      {trailing}
      {check && (
        <span className={`uirow-check ${toneClass(checkTone)}`}>
          <Icon name="check" />
        </span>
      )}
      {chevron && <Icon name="caret-right" className="uirow-chev" />}
    </>
  );
  if (onClick)
    return (
      <button type="button" className={cls} onClick={onClick} disabled={disabled} {...aria}>
        {inner}
      </button>
    );
  if (as === 'label')
    return (
      <label className={cls} {...aria}>
        {inner}
      </label>
    );
  return (
    <div className={cls} {...aria}>
      {inner}
    </div>
  );
}

/** Padded expansion area under a row (calendar, chips, inline confirm). */
export function ListPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={['uirow-panel', className].filter(Boolean).join(' ')}>{children}</div>;
}
