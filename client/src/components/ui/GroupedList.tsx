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
import type { GuideFieldProps } from './SaveGuide';
import './GroupedList.css';
import './Chamfer.css';
import './Floor.css';

export interface GroupedListProps {
  header?: ReactNode;
  footer?: ReactNode;
  /** Footer as an error (danger colour, role="alert"). */
  footerError?: boolean;
  /** Extra footer lines (each its own paragraph). */
  notes?: ReactNode[];
  /** Surface of the rows: `surface` on the page, `raised` inside a panel / sheet,
   *  `flat` none — for a control (segmented tiles) that draws its own edge. */
  surface?: 'surface' | 'raised' | 'flat';
  children: ReactNode;
  className?: string;
  /** Accessible name for the group (defaults to nothing — the header is visual). */
  label?: string;
  /**
   * The rows are a real list: `ul[aria-label=label]` whose children are `<li>` (each holding a
   * ListRow). Hairlines and the surface are the same; use it where the list is read as a list.
   */
  list?: boolean;
  /** The rows container is itself a widget (e.g. `listbox` whose children are `role=option` rows). */
  rowsRole?: string;
  /** DOM id of the rows container (aria-controls / aria-owns targets). */
  rowsId?: string;
  /**
   * The whole group is one required field (a choice among its rows): `guide.field(id)` frames and tints the group as a single
   * block, not row by row. Use `ListRow`'s own `guide` only when one row is the field.
   */
  guide?: GuideFieldProps;
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
  list = false,
  rowsRole,
  rowsId,
  guide,
}: GroupedListProps) {
  const rowsClass = ['uigl-rows', guide?.className].filter(Boolean).join(' ');
  const guideAttrs = guide
    ? { onClickCapture: guide.onClickCapture, 'data-guide-hit': guide['data-guide-hit'] }
    : {};
  return (
    <section
      className={[
        'uigl',
        surface === 'raised' ? 'uigl--raised' : '',
        surface === 'flat' ? 'uigl--flat' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={list || rowsRole ? undefined : label}
    >
      {header != null && <div className="uigl-h">{header}</div>}
      {list ? (
        <ul className={rowsClass} aria-label={label} {...guideAttrs}>
          {children}
        </ul>
      ) : (
        <div
          className={rowsClass}
          {...guideAttrs}
          id={rowsId}
          role={rowsRole}
          aria-label={rowsRole ? label : undefined}
        >
          {children}
        </div>
      )}
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
  | 'aria-expanded'
  | 'aria-pressed'
  | 'aria-current'
  | 'aria-label'
  | 'aria-describedby'
  | 'aria-controls'
  | 'aria-haspopup'
  | 'aria-selected'
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
  /** Long values wrap (right-aligned, several lines) instead of staying on one line. */
  wrap?: boolean;
  /** ARIA role of the row element (`menuitem` inside a menu popover). */
  role?: string;
  /** DOM id (aria-activedescendant targets, label references). */
  id?: string;
  /** Compact row (Brass Glass list cards): tighter padding. */
  dense?: boolean;
  /** Bold label (Brass Glass): the row's name outweighs its sub-line. */
  strong?: boolean;
  className?: string;
  /** `useSaveGuide().field(id)` of a required field: the reserved dashed frame and its dismiss press. */
  guide?: GuideFieldProps;
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
    wrap,
    role,
    id,
    dense,
    strong,
    className: classNameProp,
    guide,
    ...aria
  } = props;
  const className = [classNameProp, guide?.className].filter(Boolean).join(' ') || undefined;
  const guideAttrs = guide
    ? { onClickCapture: guide.onClickCapture, 'data-guide-hit': guide['data-guide-hit'] }
    : {};
  const cls = [
    'uirow',
    icon ? 'has-icon' : '',
    action ? 'uirow--action' : '',
    tone ? toneClass(tone) : '',
    tone && action ? 'is-toned' : '',
    selected ? 'is-selected' : '',
    dim ? 'is-dim' : '',
    dense ? 'uirow--dense' : '',
    strong ? 'uirow--strong' : '',
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
            wrap ? 'is-wrap' : '',
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
      <button
        type="button"
        id={id}
        role={role}
        className={cls}
        onClick={onClick}
        disabled={disabled}
        {...guideAttrs}
        {...aria}
      >
        {inner}
      </button>
    );
  if (as === 'label')
    return (
      <label className={cls} id={id} role={role} {...guideAttrs} {...aria}>
        {inner}
      </label>
    );
  return (
    <div className={cls} id={id} role={role} {...guideAttrs} {...aria}>
      {inner}
    </div>
  );
}

/** Padded expansion area under a row (calendar, chips, inline confirm). */
export function ListPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={['uirow-panel', className].filter(Boolean).join(' ')}>{children}</div>;
}
