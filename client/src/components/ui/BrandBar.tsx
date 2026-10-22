import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, LanguageSelector } from '../../ui';
import { FLAGS, LOCALE_IDS, LOCALES, setLocale, useT } from '../../i18n';
import { badgeText } from './Badge';
import { IconTile } from './IconTile';
import type { MoreMenuItem } from './MoreMenu';
import { toneClass, type Tone } from './tones';
import './BrandBar.css';

/** A header control that may collapse into the user drawer when the bar gets tight. */
export interface BrandEntry {
  id: string;
  /** The row's label in the drawer (and the control's accessible name). */
  label: string;
  /** Icon of the drawer row. */
  icon: string;
  /** The control as drawn in the bar. */
  node: ReactNode;
  /** Drawer row action (omit for a `submenu` row). */
  onSelect?: () => void;
  submenu?: MoreMenuItem['submenu'];
}

export interface BrandBarProps {
  /** Current app name beside the wordmark (Gym / Apex / …); also opens the app switcher. */
  app: string;
  onApp: () => void;
  /** Accessible label of the app-switcher button. */
  appLabel: string;
  /**
   * With `tone` + `icon` the app name becomes a visible switcher chip: the app's tile, its name and a
   * caret, in the app's own colour family (the same tile the launcher shows). Without them the
   * legacy text label is drawn.
   */
  tone?: Tone;
  icon?: string;
  /**
   * Controls that stay in the bar whatever its width (BellButton…).
   */
  actions?: ReactNode;
  /**
   * Controls that stay in the bar while there is room and collapse into the user drawer when the bar
   * gets tight, the LAST one first (the bar appends the language chip after them, so the language
   * goes first). The bar measures itself (no breakpoints): between the left part and the controls
   * a gap of at least 16px is kept.
   */
  entries?: BrandEntry[];
  /**
   * The account avatar at the very end of the bar (see components/suite/BrandAccount). A function
   * receives the collapsed entries as drawer rows.
   */
  avatar?: ReactNode | ((hidden: MoreMenuItem[]) => ReactNode);
  /** Told which entries are collapsed out of the bar, so the app can list them in its More menu. */
  onHiddenChange?: (hidden: MoreMenuItem[]) => void;
  /** Render as <header> (sub-apps) instead of <div>. */
  header?: boolean;
  className?: string;
}

/** Smallest space kept between the wordmark/chip and the control cluster. */
const MIN_GAP = 40; // breathing room kept between the app switcher and the controls

/** Top brand bar of every phone screen: "spotter" wordmark + app name + round control cluster. */
export function BrandBar({
  app,
  onApp,
  appLabel,
  tone,
  icon,
  actions,
  entries,
  avatar,
  onHiddenChange,
  header,
  className,
}: BrandBarProps) {
  const Tag = header ? 'header' : 'div';
  const chip = Boolean(tone && icon);
  const { locale } = useT();
  const language: BrandEntry = {
    id: 'language',
    label: LOCALES[locale].language,
    icon: 'globe',
    node: <LanguageSelector compact />,
    submenu: {
      title: LOCALES[locale].language,
      value: locale,
      options: LOCALE_IDS.map((id) => ({
        id,
        label: LOCALES[id].locale,
        icon: <span aria-hidden>{FLAGS[id]}</span>,
      })),
      onChange: (id) => setLocale(id as (typeof LOCALE_IDS)[number]),
    },
  };
  const all = [...(entries ?? []), language];
  const barRef = useRef<HTMLElement>(null);
  const leadRef = useRef<HTMLDivElement>(null);
  const fixedRef = useRef<HTMLDivElement>(null);
  // How many entries fit; before the first measure (and where nothing is laid out, as in jsdom) all do.
  const [fit, setFit] = useState(all.length);
  const count = all.length;
  useLayoutEffect(() => {
    const bar = barRef.current;
    const lead = leadRef.current;
    const fixed = fixedRef.current;
    if (!bar || !lead || !fixed) return;
    const measure = () => {
      if (!bar.clientWidth) return setFit(count);
      const cs = getComputedStyle(bar);
      const inner = bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const gap = parseFloat(getComputedStyle(fixed).columnGap) || 8;
      const ctl = fixed.querySelector<HTMLElement>('.uibrand-ctl')?.offsetWidth || 36;
      const room = inner - lead.offsetWidth - MIN_GAP - fixed.offsetWidth;
      setFit(Math.max(0, Math.min(count, Math.floor(room / (ctl + gap)))));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    return () => ro.disconnect();
  }, [count, app, chip]);
  // The first entries leave first (the health shield before the language), so the tail stays longest.
  const shown = all.slice(count - fit);
  const hidden: MoreMenuItem[] = all.slice(0, count - fit).map((e) => ({
    id: e.id,
    label: e.label,
    icon: e.icon,
    onSelect: e.onSelect ?? (() => undefined),
    submenu: e.submenu,
  }));
  const hiddenKey = hidden.map((h) => h.id).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the ids: the item objects are rebuilt every render
  useEffect(() => onHiddenChange?.(hidden), [hiddenKey]);
  return (
    <Tag
      ref={barRef as never}
      className={`uibrand app-brand${header ? ' apex-head' : ''}${className ? ` ${className}` : ''}`}
      aria-label="Spotter"
    >
      <div className="uibrand-lead app-brand-lead" ref={leadRef}>
        <span className="uibrand-word app-brand-word">spotter</span>
        {chip && tone && icon ? (
          <button
            type="button"
            className={`uibrand-chip ${toneClass(tone)}`}
            onClick={onApp}
            aria-label={appLabel}
            aria-haspopup="dialog"
          >
            <IconTile tone="inherit" size={22} icon={icon} />
            <span className="uibrand-chip-name">{app}</span>
            <Icon name="caret-down" className="uibrand-chip-caret" />
          </button>
        ) : (
          <button
            type="button"
            className="uibrand-app app-brand-app"
            onClick={onApp}
            aria-label={appLabel}
          >
            {app}
          </button>
        )}
      </div>
      <div className="uibrand-actions app-brand-actions">
        {shown.map((e) => (
          <Fragment key={e.id}>{e.node}</Fragment>
        ))}
        <div className="uibrand-fixed" ref={fixedRef}>
          {actions}
          {typeof avatar === 'function' ? avatar(hidden) : avatar}
        </div>
      </div>
    </Tag>
  );
}

export interface BellButtonProps {
  label: string;
  onClick: () => void;
  /** Unread count; 0 hides the badge. */
  count?: number;
  /** Filled bell (the notifications tab is open). */
  active?: boolean;
}

/** Notifications bell with unread badge — a BrandBar control. */
export function BellButton({ label, onClick, count = 0, active }: BellButtonProps) {
  const countText = badgeText(count);
  return (
    <button
      type="button"
      className="uibrand-ctl uibell app-bell"
      onClick={onClick}
      aria-label={label}
    >
      <Icon name="bell" weight={active ? 'fill' : undefined} className="app-brand-icon" />
      {countText && <span className="uibell-badge app-bell-badge">{countText}</span>}
    </button>
  );
}

export interface BrandIconButtonProps {
  label: string;
  icon: string;
  onClick: () => void;
  /** Icon colour family; `chronic` is the blue of the health-conditions shield. */
  tone?: 'chronic';
}

/** Icon control for the BrandBar cluster. With a `tone` the glyph takes that colour family. */
export function BrandIconButton({ label, icon, onClick, tone }: BrandIconButtonProps) {
  return (
    <button
      type="button"
      className={`uibrand-ctl uibell app-bell${tone ? ` is-${tone}` : ''}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon name={icon} className="app-brand-icon" />
    </button>
  );
}
