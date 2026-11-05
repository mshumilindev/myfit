import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Icon } from '../../ui';
import { Portal } from './overlays/Portal';
import { Badge } from './Badge';
import { ChristmasWreath } from './ChristmasWreath';
import { HalloweenLantern } from './HalloweenLantern';
import './TabBar.css';

export interface TabBarItem<Id extends string = string> {
  id: Id;
  label: ReactNode;
  icon: string;
  active?: boolean;
  /**
   * Corner badge on the icon. A number renders the kit `Badge` (1..9, "9+", 0
   * hidden); any other node is placed as given. Pair with `ariaLabel` so the
   * count is spoken (the badge glyph is aria-hidden).
   */
  badge?: ReactNode;
  /** Accessible name when it differs from the visible label ("Chat, 3 unread"). */
  ariaLabel?: string;
}

export interface TabBarProps<Id extends string = string> {
  /** Tabs. With a `fab` the first two sit left of the notch, the rest right of it. */
  items: readonly TabBarItem<Id>[];
  onSelect: (id: Id) => void;
  /** The trailing "Apps" button (opens the suite switcher). */
  apps?: { label: ReactNode; ariaLabel: string; onClick: () => void };
  /**
   * The trailing "More" tab (Coach, and every sub-app since the suite shell): opens the More
   * sheet (destinations, Apps last, account). Lit while the sheet is open or the current screen
   * lives inside it. Replaces `apps`; pass one or the other.
   */
  more?: {
    label: ReactNode;
    ariaLabel?: string;
    /** The sheet is open. */
    open?: boolean;
    /** Lit: open, or the current screen lives inside the sheet. Defaults to `open`. */
    active?: boolean;
    onClick: () => void;
  };
  /** Tab semantics (tablist / tab / aria-selected) — sub-apps that swap a panel. */
  tabs?: boolean;
  /** Filled icon on the active tab. */
  activeFill?: boolean;
  /** The floating Start "+" in the notch. */
  /** `attention` pulses a slow ripple to invite a session; turn it off once one is done today. */
  /** `open`: the Start drawer is up — the plus turns into a ×, stays above the drawer and closes it (`closeLabel`). */
  fab?: {
    ariaLabel: string;
    onClick: () => void;
    attention?: boolean;
    open?: boolean;
    closeLabel?: string;
  };
  /**
   * Which width swaps this bar for the rail. `app` (default) keeps the real
   * app's 720; `coach` keeps the bar up to 767 (see breakpoints.ts).
   */
  breakpoint?: 'app' | 'coach';
}

/**
 * The phone tab bar (kit `tabbar`): Today · Overview · (+) · Gyms · Apps. The
 * one shell piece whose shape the Brass Glass theme changes (glass plate,
 * glass FAB) — pages never draw their own bar.
 */
export function TabBar<Id extends string = string>({
  items,
  onSelect,
  apps,
  more,
  fab,
  tabs,
  activeFill,
  breakpoint = 'app',
}: TabBarProps<Id>) {
  const navRef = useRef<HTMLElement>(null);
  // The active-tab indicator is one element that slides between tabs (a theme draws it; see the Cyberpunk structure
  // sheet): measure the lit tab and publish its box as CSS variables. No markup is added, other themes ignore them.
  const measure = () => {
    const nav = navRef.current;
    if (!nav) return;
    const on = nav.querySelector<HTMLElement>(':scope > button.active');
    nav.style.setProperty('--tab-ind-o', on ? '1' : '0');
    if (on) {
      nav.style.setProperty('--tab-ind-x', `${on.offsetLeft}px`);
      nav.style.setProperty('--tab-ind-w', `${on.offsetWidth}px`);
    }
  };
  useLayoutEffect(measure);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    // Animate only after the first placement, so the strip does not slide in from the left edge on mount.
    const raf = requestAnimationFrame(() => nav.setAttribute('data-ind', ''));
    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(raf);
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);
  const btn = (x: TabBarItem<Id>) => {
    const icon = <Icon name={x.icon} weight={activeFill && x.active ? 'fill' : undefined} />;
    const badge =
      typeof x.badge === 'number' ? <Badge n={x.badge} anchor="corner" /> : (x.badge ?? null);
    const hasBadge = typeof x.badge === 'number' ? x.badge > 0 : x.badge != null;
    return (
      <button
        key={x.id}
        className={x.active ? 'active' : ''}
        role={tabs ? 'tab' : undefined}
        aria-selected={tabs ? !!x.active : undefined}
        aria-label={x.ariaLabel}
        onClick={() => onSelect(x.id)}
      >
        {/* No badge → the original markup, byte for byte. */}
        {hasBadge ? (
          <span className="tabbar-ico">
            {icon}
            {badge}
          </span>
        ) : (
          icon
        )}
        <span>{x.label}</span>
      </button>
    );
  };
  const wrapRef = useRef<HTMLDivElement>(null);
  const { shown, turned, covered, layerRef } = useFabLayer(wrapRef, !!fab?.open);
  const cols = items.length + (apps ? 1 : 0) + (more ? 1 : 0) + (fab ? 1 : 0);
  // A bar with a single destination navigates nowhere (the admin Users app): no bar at all.
  if (cols <= 1) return null;
  return (
    <div
      ref={wrapRef}
      className={`tabbar-wrap${fab ? ' tabbar-wrap--fab' : ''}${shown ? ' tabbar-wrap--fab-open' : ''}${breakpoint === 'coach' ? ' tabbar-wrap--coach' : ''}`}
    >
      <nav
        ref={navRef}
        className={`tabbar${fab ? ' tabbar-notched' : ''}${breakpoint === 'coach' ? ' tabbar--coach' : ''}`}
        role={tabs ? 'tablist' : undefined}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {fab ? items.slice(0, 2).map(btn) : items.map(btn)}
        {/* The notch — the Start "+" floats in it (sibling below, so the
            notch mask doesn't clip it). */}
        {fab && <span className="tabbar-gap" aria-hidden />}
        {fab && items.slice(2).map(btn)}
        {apps && (
          <button onClick={apps.onClick} aria-label={apps.ariaLabel}>
            <Icon name="squares-four" />
            <span>{apps.label}</span>
          </button>
        )}
        {more && (
          <button
            type="button"
            className={(more.active ?? more.open) ? 'active' : ''}
            aria-label={more.ariaLabel}
            aria-haspopup="dialog"
            aria-expanded={!!more.open}
            onClick={more.onClick}
          >
            <Icon name="dots-three" />
            <span>{more.label}</span>
          </button>
        )}
      </nav>
      {fab && <FabButton fab={fab} open={false} hidden={shown} />}
      {fab && shown && (
        <Portal>
          {/* data-over-trap: a drawer's focus trap must not make the × inert when the drawer mounts after it */}
          <div
            className={`tabbar-fab-layer${covered ? ' is-covered' : ''}`}
            ref={layerRef}
            data-over-trap=""
          >
            <FabButton fab={fab} open={turned} twin />
          </div>
        </Portal>
      )}
    </div>
  );
}

function FabButton({
  fab,
  open,
  hidden,
  twin,
}: {
  fab: NonNullable<TabBarProps['fab']>;
  open: boolean;
  hidden?: boolean;
  /** The portal twin: no attention ripple of its own (the real button's keeps running underneath). */
  twin?: boolean;
}) {
  return (
    <button
      type="button"
      className={`tabbar-fab${fab.attention && !twin ? ' is-attention' : ''}${open ? ' is-open' : ''}`}
      onClick={fab.onClick}
      aria-label={fab.open && fab.closeLabel ? fab.closeLabel : fab.ariaLabel}
      aria-expanded={fab.open ?? false}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
    >
      <Icon name="plus" weight="bold" />
      <HalloweenLantern />
      <ChristmasWreath />
    </button>
  );
}

/**
 * While the Start drawer is up the button must sit above it, and the drawer lives in a portal on <body> — a
 * button inside the bar can never outrank it when any ancestor makes its own stacking layer. So the open button is
 * drawn by a twin in the same portal layer, fixed over the real one (which hides meanwhile). It mounts as a plus,
 * turns on the next frame, and on close turns back before it is removed.
 */
function useFabLayer(wrapRef: RefObject<HTMLDivElement | null>, open: boolean) {
  const [shown, setShown] = useState(false);
  const [turned, setTurned] = useState(false);
  const [covered, setCovered] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);
  // opening mounts the twin as a plus; closing turns it back (state follows the prop, adjusted while rendering)
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setShown(true);
    else setTurned(false);
  }
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setTurned(true)));
      return () => cancelAnimationFrame(id);
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(() => setShown(false), reduce ? 0 : FAB_TURN_MS);
    return () => window.clearTimeout(id);
  }, [open]);
  // the twin sits exactly over the bar (re-measured on resize / rotation)
  useLayoutEffect(() => {
    if (!shown) return;
    const place = () => {
      const w = wrapRef.current;
      const l = layerRef.current;
      if (!w || !l) return;
      const r = w.getBoundingClientRect();
      l.style.setProperty('--fab-layer-left', `${r.left}px`);
      l.style.setProperty('--fab-layer-top', `${r.top}px`);
      l.style.setProperty('--fab-layer-w', `${r.width}px`);
      l.style.setProperty('--fab-layer-h', `${r.height}px`);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [shown, wrapRef]);
  // The button belongs to the Start drawer only: a drawer / page opened on top of it (gym picker, activity, …)
  // is a later layer in <body>, and then the button steps back instead of floating over it.
  useEffect(() => {
    if (!shown) return;
    const check = () => setCovered(coversStartDrawer(layerRef.current?.parentElement ?? null));
    const first = requestAnimationFrame(check);
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true });
    return () => {
      cancelAnimationFrame(first);
      mo.disconnect();
    };
  }, [shown]);
  return { shown, turned, covered, layerRef };
}
/**
 * True when a drawer / dialog / page other than the Start drawer is open. Order in <body> does not matter: the
 * Start drawer's chunk may load after the button's twin was mounted (the app lazy-loads it), so "a later layer"
 * would wrongly count the Start drawer itself. The Start drawer is recognised by its own class.
 */
export function coversStartDrawer(own: Element | null): boolean {
  for (const n of Array.from(document.body.children)) {
    if (n === own || n.querySelector('.start-sheet')) continue;
    if (n.matches('.uifp-layer') || n.querySelector('.scrim, .sheet, .dialog-scrim, .uifp-layer'))
      return true;
  }
  return false;
}
/** Longer than the turn itself (TabBar.css `--fab-turn-dur`), so the twin is removed once it is a plus again. */
const FAB_TURN_MS = 360;
