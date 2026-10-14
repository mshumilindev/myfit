import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode, RefObject } from 'react';
import { Icon } from '../../ui';
import { Badge } from './Badge';
import {
  RAIL_EXTRA_TILE,
  RAIL_GAP,
  RAIL_TILE,
  fitLayout,
  splitEntries,
  type RailEntry,
  type RailFootEntry,
} from './railOverflow';
import './Rail.css';

interface RailMode {
  labelled: boolean;
  compact: boolean;
}
const RailModeContext = createContext<RailMode>({ labelled: false, compact: false });

export interface RailItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Icon name; omit when passing a custom `glyph`. */
  icon?: string;
  /** Custom graphic in place of the icon (e.g. the mastery ring) — same tile, same states. */
  glyph?: ReactNode;
  /** Visible label under the icon (some foot items are icon-only). */
  label?: ReactNode;
  /** Accessible name; defaults to the label when it is a string. */
  ariaLabel?: string;
  active?: boolean;
  /** Filled icon when active (nav items). */
  fillWhenActive?: boolean;
  /** Always-filled icon (the bell). */
  fill?: boolean;
  /** Small count badge (notifications). Free-form node; the original rail badge look. */
  badge?: ReactNode;
  /** Unread count shown with the shared kit `Badge` (1..9, "9+"; 0 hidden). */
  count?: number;
  /** Spoken after the name when `count` is shown ("3 unread"), e.g. from the coach dictionary. */
  countLabel?: string;
  /** Live-session dot (the Today item while a session is open). */
  live?: boolean;
  /** Spoken after the name while `live` is on ("session in progress"). */
  liveLabel?: string;
  /**
   * Hover / focus-visible tooltip text. Defaults to the accessible name on a
   * `compact` rail (icons only); an explicit value shows it on any rail.
   */
  tooltip?: string;
}

/** One rail tile: icon, optional label, badge / count / live dot, optional tooltip. */
export function RailItem({
  icon,
  glyph,
  label,
  ariaLabel,
  active,
  fillWhenActive,
  fill,
  badge,
  count,
  countLabel,
  live,
  liveLabel,
  tooltip,
  className,
  onKeyDown,
  onMouseLeave,
  onBlur,
  ...rest
}: RailItemProps) {
  const { compact } = useContext(RailModeContext);
  const [tipOff, setTipOff] = useState(false);
  const name = ariaLabel ?? (typeof label === 'string' ? label : undefined);
  const tip = tooltip ?? (compact ? name : undefined);
  const hasCount = typeof count === 'number' && count > 0;
  const spoken =
    name == null
      ? undefined
      : [name, hasCount ? countLabel : undefined, live ? liveLabel : undefined]
          .filter(Boolean)
          .join(', ');
  const cls = [
    'rail-item',
    active ? 'active' : '',
    label == null ? 'rail-item--icon' : '',
    tip && tipOff ? 'is-tip-off' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={cls}
      aria-label={spoken}
      // The custom tooltip replaces the native title (no double tooltip).
      title={tip ? undefined : name}
      onKeyDown={(e) => {
        // WCAG 1.4.13: the tooltip can be dismissed without moving focus.
        if (e.key === 'Escape' && tip) setTipOff(true);
        onKeyDown?.(e);
      }}
      onMouseLeave={(e) => {
        setTipOff(false);
        onMouseLeave?.(e);
      }}
      onBlur={(e) => {
        setTipOff(false);
        onBlur?.(e);
      }}
      {...rest}
    >
      {glyph ?? (
        <Icon name={icon ?? ''} weight={fill || (fillWhenActive && active) ? 'fill' : undefined} />
      )}
      {label != null && <span className="rail-label">{label}</span>}
      {badge != null && <span className="rail-notif-badge">{badge}</span>}
      {hasCount && <Badge n={count ?? 0} anchor="corner" />}
      {live && <span className="rail-live-dot" aria-hidden />}
      {tip && (
        <span className="rail-tip" aria-hidden>
          {tip}
        </span>
      )}
    </button>
  );
}

export interface RailOverflow {
  entries: RailEntry[];
  /**
   * Extras at the bottom of the rail, above the pinned foot (`foot`: Apps, avatar). They collapse
   * into More FIRST and ALL AT ONCE (as soon as one does not fit); only then do `entries` start
   * collapsing from the end. The More item sits in the nav column, right below the last visible entry.
   */
  footEntries?: RailFootEntry[];
  /** Spoken after the More label while hidden entries carry a count ("3 unread"). */
  moreCountLabel?: (n: number) => string;
  /** Label (88px rail), tooltip (60px rail) and accessible name of the More item. */
  moreLabel: string;
  /** Renders the menu for the collapsed entries (a `MoreMenu` popover anchored to `anchorRef`). */
  renderMenu: (ctx: {
    /** Collapsed nav entries followed by collapsed foot extras (original order in each group). */
    hidden: RailEntry[];
    /** Only the collapsed nav entries. */
    hiddenNav: RailEntry[];
    /** Only the collapsed foot extras: list them as their own group under the nav entries. */
    hiddenFoot: RailFootEntry[];
    open: boolean;
    onClose: () => void;
    anchorRef: RefObject<HTMLElement | null>;
  }) => ReactNode;
}

export interface RailProps {
  /** The brand mark at the top. */
  brand: ReactNode;
  /** Nav items (RailItem) — the middle of the rail. Ignored when `overflow` is set. */
  children?: ReactNode;
  /**
   * Height-aware nav (app-agnostic): the entries are laid out top to bottom; the rail measures the
   * height of its nav column (ResizeObserver, no breakpoints) and only when they do not all fit
   * does it collapse entries into a trailing "More" item. When everything fits there is NO More
   * item. Collapse order = highest `priority` first, default from the END of the list; collapsed
   * entries keep their order and are handed to `renderMenu`.
   */
  overflow?: RailOverflow;
  /** The foot: mastery, notifications, apps, settings, language, account. */
  foot?: ReactNode;
  className?: string;
  /** Coach wide rail: 88px, 13px label under every icon. */
  labelled?: boolean;
  /** Coach narrow rail: 60px, icons only, tooltip (hover + focus-visible) and aria-label. Wins over `labelled`. */
  compact?: boolean;
  /**
   * Which width swaps this rail for the tab bar. `app` (default) keeps the
   * real app's 720; `coach` hides the rail below 768 (see breakpoints.ts).
   */
  breakpoint?: 'app' | 'coach';
  /** Accessible name of the landmark. */
  ariaLabel?: string;
}

/**
 * The desktop rail (kit `rail`, ≥720px; Coach ≥768px): brand on top, nav tiles,
 * a foot. Both the Gym rail (App.tsx) and the sub-app rail (AppRail) render
 * this; the accent skin comes from the wrapping .theme-* class. Hidden on
 * phones, where TabBar takes over. `labelled` / `compact` are the Coach
 * variants (R-KIT-20); defaults reproduce the real rail exactly.
 */
/**
 * Overflow state of a rail: which entries are visible, which collapsed into More, and whether the
 * More menu is open. Tiles have a FIXED size (RAIL_TILE, 52px pitch); only the number of visible
 * tiles follows the height of the nav column.
 */
function useRailOverflow(
  overflow: RailOverflow | undefined,
  navRef: RefObject<HTMLDivElement | null>,
  tile: number,
  extraTile: number,
) {
  const shown = useRef({ extras: 0 });
  const [fit, setFit] = useState<{ nav: number; extras: number } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const entries = overflow?.entries ?? [];
  const extras = overflow?.footEntries ?? [];
  const n = entries.length;
  const f = extras.length;
  const enabled = !!overflow;

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      // The visible extras sit in the foot and take room from the nav column: add them back to
      // get the room nav + More + extras compete for. More lives inside the nav column.
      const room = nav.clientHeight + shown.current.extras * (extraTile + RAIL_GAP);
      setFit(fitLayout(room, n, tile, f, extraTile));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [n, f, enabled, navRef, tile, extraTile]);

  const navCount = Math.min(fit?.nav ?? n, n);
  const extraCount = Math.min(fit?.extras ?? f, f);
  const { visible, hidden } = splitEntries(entries, navCount);
  // Extras are all-or-nothing (fitLayout): either every extra stays or all are hidden.
  const visibleExtras = extras.slice(0, extraCount);
  const hiddenExtras = extras.slice(extraCount);
  useLayoutEffect(() => {
    shown.current = { extras: visibleExtras.length };
  });
  const any = hidden.length + hiddenExtras.length > 0;
  const open = moreOpen && any;
  return { visible, hidden, visibleExtras, hiddenExtras, open, setMoreOpen };
}

function OverflowMenu({
  render,
  hiddenNav,
  hiddenFoot,
  ...ctx
}: {
  render: RailOverflow['renderMenu'];
  hiddenNav: RailEntry[];
  hiddenFoot: RailFootEntry[];
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  return <>{render({ ...ctx, hidden: [...hiddenNav, ...hiddenFoot], hiddenNav, hiddenFoot })}</>;
}

export function Rail({
  brand,
  children,
  overflow,
  foot,
  className,
  labelled,
  compact,
  breakpoint = 'app',
  ariaLabel,
}: RailProps) {
  const mode: RailMode = { labelled: !!labelled && !compact, compact: !!compact };
  const navRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const ov = useRailOverflow(
    overflow,
    navRef,
    mode.labelled ? RAIL_TILE.labelled : mode.compact ? RAIL_TILE.compact : RAIL_TILE.default,
    mode.labelled
      ? RAIL_EXTRA_TILE.labelled
      : mode.compact
        ? RAIL_EXTRA_TILE.compact
        : RAIL_EXTRA_TILE.default,
  );
  const hiddenAll = [...ov.hidden, ...ov.hiddenExtras];
  const showMore = !!overflow && hiddenAll.length > 0;
  // Hidden entries keep their badge / live dot alive on the More tile.
  const moreCount = hiddenAll.reduce((sum, e) => sum + (e.count ?? 0), 0);
  const moreLive = hiddenAll.find((e) => e.live);
  return (
    <RailModeContext.Provider value={mode}>
      <aside
        className={[
          'rail',
          mode.labelled ? 'rail--labelled' : '',
          mode.compact ? 'rail--compact' : '',
          breakpoint === 'coach' ? 'rail--coach' : '',
          overflow ? 'rail--overflow' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={ariaLabel}
      >
        <div className="rail-brand">{brand}</div>
        {overflow ? (
          <div className="rail-nav" ref={navRef}>
            {ov.visible.map((e) => (
              <RailItem
                key={e.id}
                icon={e.icon}
                label={e.label}
                active={e.active}
                fillWhenActive
                onClick={e.onSelect}
                aria-haspopup={e.popup}
                {...(e.live ? { live: true, liveLabel: e.liveLabel } : {})}
                {...(e.count != null ? { count: e.count, countLabel: e.countLabel } : {})}
              />
            ))}
            {/* More: only when entries collapsed; right below the last visible nav entry. */}
            {showMore && overflow && (
              <div ref={moreRef} className="rail-more">
                <RailItem
                  icon="dots-three"
                  label={overflow.moreLabel}
                  tooltip={overflow.moreLabel}
                  active={ov.open || hiddenAll.some((e) => e.active)}
                  {...(moreCount > 0
                    ? { count: moreCount, countLabel: overflow.moreCountLabel?.(moreCount) }
                    : {})}
                  {...(moreLive ? { live: true, liveLabel: moreLive.liveLabel } : {})}
                  aria-haspopup="dialog"
                  aria-expanded={ov.open}
                  onClick={() => ov.setMoreOpen((o) => !o)}
                />
              </div>
            )}
          </div>
        ) : (
          children
        )}
        {(foot != null || ov.visibleExtras.length > 0) && (
          <div className="rail-foot">
            {ov.visibleExtras.map((e) => (
              <div key={e.id} className="rail-extra">
                {e.node ?? (
                  <RailItem
                    icon={e.icon}
                    fill={e.fill}
                    ariaLabel={e.label}
                    tooltip={e.label}
                    active={e.active}
                    onClick={e.onSelect}
                    {...(e.badge != null
                      ? { badge: e.badge }
                      : e.count != null
                        ? { count: e.count, countLabel: e.countLabel }
                        : {})}
                  />
                )}
              </div>
            ))}
            {foot}
          </div>
        )}
        {overflow && (
          <OverflowMenu
            render={overflow.renderMenu}
            hiddenNav={ov.hidden}
            hiddenFoot={ov.hiddenExtras}
            open={ov.open}
            onClose={() => ov.setMoreOpen(false)}
            anchorRef={moreRef}
          />
        )}
      </aside>
    </RailModeContext.Provider>
  );
}
