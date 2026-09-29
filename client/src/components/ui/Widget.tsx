import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../../ui';
import { IconTile } from './IconTile';
import { Button } from './Button';
import { toneClass, type Tone } from './tones';
import './Widget.css';

/**
 * Today widget sizes (design "Spotter — Today Configurator", page v3):
 *   S  — square, 2 of 4 columns: one number + context
 *   M  — row on the full width: icon, title, subline, trailing
 *   L  — wide, full width, height of S: number + chart / list / action
 *   XL — big square, full width: the richest version
 * XS (shortcut) is a separate primitive — ShortcutTile.
 */
export type WidgetSize = 'S' | 'M' | 'L' | 'XL';
export const WIDGET_SIZES: WidgetSize[] = ['S', 'M', 'L', 'XL'];

export interface WidgetProps {
  size: WidgetSize;
  /** Colour family of the kicker, icon and accents (the sub-app's colour). */
  tone?: Tone;
  /** Phosphor icon — the M row's leading tile (and an optional S/L/XL header icon). */
  icon?: string;
  /** Small uppercase label at the top (S/L/XL). */
  kicker?: ReactNode;
  /** Right side of the kicker row: a delta, a date, a badge. */
  badge?: ReactNode;
  /** Headline number… */
  value?: ReactNode;
  /** …and its unit. */
  unit?: ReactNode;
  /** Headline text when there is no number (M title, a name). */
  title?: ReactNode;
  /** Secondary line under the headline. */
  sub?: ReactNode;
  /** M only: the trailing slot (chip, value, button). Defaults to a chevron when clickable. */
  trailing?: ReactNode;
  /** Free body between the header and the headline (charts, lists, grids). */
  children?: ReactNode;
  /** Bottom slot — usually one outlined action. */
  footer?: ReactNode;
  /** Put the body after the headline instead of before it. */
  bodyLast?: boolean;
  /** Tap target — the whole card (actions in `footer`/`trailing` stay clickable). */
  onClick?: () => void;
  /** Accessible name of the card when it is clickable. */
  ariaLabel?: string;
  /** Layout-only style for the frame (e.g. a fixed width in stories). */
  style?: CSSProperties;
  className?: string;
}

/** The card every Today widget is built on — one frame, four sizes. */
export function Widget({
  size,
  tone = 'neutral',
  icon,
  kicker,
  badge,
  value,
  unit,
  title,
  sub,
  trailing,
  children,
  footer,
  bodyLast = false,
  onClick,
  ariaLabel,
  style,
  className,
}: WidgetProps) {
  const cls = [
    'uiw',
    `uiw--${size.toLowerCase()}`,
    toneClass(tone),
    onClick ? 'is-clickable' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const hit = onClick ? (
    <button
      type="button"
      className="uiw-hit"
      onClick={onClick}
      aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
    />
  ) : null;

  if (size === 'M') {
    return (
      <div className={cls} style={style}>
        {hit}
        {icon && <IconTile tone="inherit" size={36} icon={icon} />}
        <div className="uiw-mid">
          <div className="uiw-title">
            {title ?? value}
            {title == null && unit != null && <span className="uiw-unit">{unit}</span>}
          </div>
          {sub != null && <div className="uiw-sub">{sub}</div>}
        </div>
        {trailing != null ? (
          <div className="uiw-trailing">{trailing}</div>
        ) : onClick ? (
          <span className="uiw-go" aria-hidden="true">
            <Icon name="caret-right" />
          </span>
        ) : null}
      </div>
    );
  }

  const head =
    kicker != null || badge != null ? (
      <div className="uiw-head">
        {kicker != null && <span className="uiw-kicker">{kicker}</span>}
        {badge != null && <span className="uiw-badge">{badge}</span>}
      </div>
    ) : null;
  const headline =
    value != null || title != null || sub != null ? (
      <div className="uiw-headline">
        {value != null && (
          <div className="uiw-value">
            {value}
            {unit != null && <span className="uiw-unit">{unit}</span>}
          </div>
        )}
        {title != null && <div className="uiw-name">{title}</div>}
        {sub != null && <div className="uiw-sub">{sub}</div>}
      </div>
    ) : null;
  const body = children != null ? <div className="uiw-body">{children}</div> : null;
  return (
    <div className={cls} style={style}>
      {hit}
      {head}
      {bodyLast ? (
        <>
          {headline}
          {body}
        </>
      ) : (
        <>
          {body}
          {headline}
        </>
      )}
      {footer != null && <div className="uiw-footer">{footer}</div>}
    </div>
  );
}

/* ---------- Building blocks used inside widget bodies ---------- */

/** Horizontal progress bar in the widget's tone (0–1). */
export function WidgetBar({
  value,
  tone,
  height = 6,
}: {
  value: number;
  tone?: Tone;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <span
      className={['uiw-bar', tone ? toneClass(tone) : ''].filter(Boolean).join(' ')}
      style={{ height }}
    >
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Ring progress (0–1) with a centred label. */
export function WidgetRing({
  value,
  size = 84,
  tone,
  children,
}: {
  value: number;
  size?: number;
  tone?: Tone;
  children?: ReactNode;
}) {
  const c = 2 * Math.PI * 24;
  const on = Math.max(0, Math.min(1, value)) * c;
  return (
    <span
      className={['uiw-ring', tone ? toneClass(tone) : ''].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 58 58" width={size} height={size} aria-hidden="true">
        <circle cx="29" cy="29" r="24" className="uiw-ring-track" />
        <circle
          cx="29"
          cy="29"
          r="24"
          className="uiw-ring-fill"
          strokeDasharray={`${on} ${c}`}
          transform="rotate(-90 29 29)"
        />
      </svg>
      <span className="uiw-ring-label">{children}</span>
    </span>
  );
}

/** Sparkline over a series (auto-scaled). `area` fills under the line. */
export function WidgetSpark({
  points,
  width = 300,
  height = 64,
  tone,
  area = false,
}: {
  points: number[];
  width?: number;
  height?: number;
  tone?: Tone;
  area?: boolean;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - 4 - ((p - min) / span) * (height - 8);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const line = `M${xy.join(' L')}`;
  return (
    <svg
      className={['uiw-spark', tone ? toneClass(tone) : ''].filter(Boolean).join(' ')}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {area && <path className="uiw-spark-area" d={`${line} L${width} ${height} L0 ${height}Z`} />}
      <path className="uiw-spark-line" d={line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Column chart; `highlight` indexes are drawn in the tone, the rest neutral. */
export function WidgetBars({
  values,
  height = 52,
  highlight = [],
  labels,
  tone,
}: {
  values: number[];
  height?: number;
  highlight?: number[];
  labels?: string[];
  tone?: Tone;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className={['uiw-bars', tone ? toneClass(tone) : ''].filter(Boolean).join(' ')}>
      <div className="uiw-bars-cols" style={{ height }}>
        {values.map((v, i) => (
          <span
            key={i}
            className={highlight.includes(i) ? 'is-on' : ''}
            style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
          />
        ))}
      </div>
      {labels && (
        <div className="uiw-bars-labels">
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** A compact list inside L/XL widgets: label on the left, value on the right. */
export function WidgetList({
  rows,
}: {
  rows: { label: ReactNode; value?: ReactNode; icon?: string; tone?: Tone }[];
}) {
  return (
    <div className="uiw-list">
      {rows.map((r, i) => (
        <div key={i} className="uiw-list-row">
          {r.icon && <IconTile tone={r.tone ?? 'inherit'} size={30} icon={r.icon} />}
          <span className="uiw-list-label">{r.label}</span>
          {r.value != null && <span className="uiw-list-value">{r.value}</span>}
        </div>
      ))}
    </div>
  );
}

/** Tiny stat tiles in a row (XL footers: "Bedtime ±24 min · Tonight 23:00"). */
export function WidgetStats({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <div className="uiw-stats">
      {items.map((it, i) => (
        <div key={i} className="uiw-stat">
          <span className="uiw-stat-label">{it.label}</span>
          <span className="uiw-stat-value">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Delta text: positive = ok (green), negative = danger, `good` overrides the sign. */
export function WidgetDelta({ children, good }: { children: ReactNode; good?: boolean }) {
  const up = good ?? !String(children).trim().startsWith('−');
  return <span className={up ? 'uiw-delta is-good' : 'uiw-delta is-bad'}>{children}</span>;
}

/** A row of day dots/bars (streaks, week strips): on = tone, off = neutral. */
export function WidgetDots({
  values,
  height = 10,
  tone,
}: {
  values: boolean[];
  height?: number;
  tone?: Tone;
}) {
  return (
    <div className={['uiw-dots', tone ? toneClass(tone) : ''].filter(Boolean).join(' ')}>
      {values.map((on, i) => (
        <span key={i} className={on ? 'is-on' : ''} style={{ height }} />
      ))}
    </div>
  );
}

export interface WidgetEmptyProps {
  size: WidgetSize;
  tone?: Tone;
  icon: string;
  kicker: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  /** Label of the one inviting action; omit for a purely informative state. */
  action?: string;
  actionIcon?: string;
  onAction?: () => void;
}

/** Empty / zero-data state of a widget, consistent across every size:
 *  S = kicker + title · M = row with a "+" action · L = title + sub + action ·
 *  XL = a centred icon tile above the same content (never a blank square). */
export function WidgetEmpty({
  size,
  tone = 'neutral',
  icon,
  kicker,
  title,
  sub,
  action,
  actionIcon = 'plus',
  onAction,
}: WidgetEmptyProps) {
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone={tone}
        icon={icon}
        title={title}
        sub={sub}
        onClick={onAction}
        trailing={
          action && onAction ? (
            <Button
              variant="secondary"
              size="sm"
              icon={actionIcon}
              onClick={onAction}
              aria-label={action}
            />
          ) : undefined
        }
      />
    );
  return (
    <Widget
      size={size}
      tone={tone}
      kicker={kicker}
      title={title}
      sub={size === 'S' ? undefined : sub}
      onClick={onAction}
      footer={
        size === 'S' || !action || !onAction ? undefined : (
          <Button variant="primary" size="sm" icon={actionIcon} onClick={onAction}>
            {action}
          </Button>
        )
      }
    >
      {size === 'XL' && (
        <div className="uiw-empty-art">
          <IconTile tone={tone} size={56} icon={icon} />
        </div>
      )}
    </Widget>
  );
}
