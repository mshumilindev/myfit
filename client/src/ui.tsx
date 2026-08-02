/**
 * Shared UI primitives from the design system (S-49/S-50 kit + dialogs/sheets).
 * Every surface here mirrors the boards; keep visual changes in styles.css.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type RefObject,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowRight,
  ArrowUpRight,
  ArrowsClockwise,
  Barbell,
  CalendarBlank,
  CaretLeft,
  Carrot,
  ChartLine,
  ChartLineUp,
  CheckCircle,
  Clock,
  ClockCountdown,
  CloudSlash,
  Copy,
  Crosshair,
  DotsThreeVertical,
  Eraser,
  Flame,
  Globe,
  House,
  Info,
  ListPlus,
  MagnifyingGlass,
  MapPin,
  MapPinLine,
  PencilSimple,
  Phone,
  Play,
  Plus,
  Robot,
  ShieldCheck,
  Star,
  SquaresFour,
  Timer,
  Trash,
  Trophy,
  WarningCircle,
  X,
  type IconProps,
} from '@phosphor-icons/react';
import { FLAGS, LOCALE_IDS, LOCALES, setLocale, useT } from './i18n';

/**
 * Icons are bundled SVG components (@phosphor-icons/react) — the same Phosphor
 * glyphs the boards use, but with no icon font to load (nothing to 404, no
 * FOUC, works offline). The <i> wrapper keeps the existing `i { font-size }`
 * CSS contract: the SVG is sized 1em.
 */
const ICONS: Record<string, ComponentType<IconProps>> = {
  'arrow-clockwise': ArrowClockwise,
  'arrow-counter-clockwise': ArrowCounterClockwise,
  'arrow-right': ArrowRight,
  'arrow-up-right': ArrowUpRight,
  'arrows-clockwise': ArrowsClockwise,
  barbell: Barbell,
  'calendar-blank': CalendarBlank,
  'caret-left': CaretLeft,
  carrot: Carrot,
  'chart-line': ChartLine,
  'chart-line-up': ChartLineUp,
  'check-circle': CheckCircle,
  clock: Clock,
  'clock-countdown': ClockCountdown,
  'cloud-slash': CloudSlash,
  copy: Copy,
  crosshair: Crosshair,
  'dots-three-vertical': DotsThreeVertical,
  eraser: Eraser,
  flame: Flame,
  globe: Globe,
  house: House,
  info: Info,
  'list-plus': ListPlus,
  'magnifying-glass': MagnifyingGlass,
  'map-pin': MapPin,
  'map-pin-slash': MapPinLine,
  'pencil-simple': PencilSimple,
  phone: Phone,
  play: Play,
  plus: Plus,
  robot: Robot,
  'shield-check': ShieldCheck,
  star: Star,
  'squares-four': SquaresFour,
  timer: Timer,
  trash: Trash,
  trophy: Trophy,
  'warning-circle': WarningCircle,
  x: X,
};

export function Icon({
  name,
  className,
  weight = 'bold',
}: {
  name: string;
  className?: string;
  weight?: IconProps['weight'];
}) {
  const Glyph = ICONS[name];
  return (
    <i className={className} aria-hidden style={{ display: 'inline-flex', lineHeight: 0 }}>
      {Glyph ? <Glyph size="1em" weight={weight} /> : null}
    </i>
  );
}

export function Spinner({ size = 14, onAccent = false }: { size?: number; onAccent?: boolean }) {
  return (
    <span
      className={`sp${onAccent ? ' on-accent' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

function Portal(props: { children: ReactNode }) {
  if (typeof document === 'undefined') return <>{props.children}</>;
  return createPortal(props.children, document.body);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function activeAnchor(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function useFixedPanelPosition(
  kind: 'sheet' | 'popover',
  anchorRef?: RefObject<HTMLElement | null>,
): CSSProperties {
  const [anchor] = useState(activeAnchor);
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const place = () => {
      const isDesktop = !!window.matchMedia && window.matchMedia('(min-width: 720px)').matches;
      if (kind === 'sheet' && !isDesktop) {
        setStyle({});
        return;
      }

      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const gutter = kind === 'sheet' ? 0 : 8;
      const preferredW = kind === 'sheet' ? 430 : 176;
      const width = Math.min(preferredW, viewportW - Math.max(gutter * 2, 36));
      const minPanelH = kind === 'sheet' ? 320 : 220;
      const target = anchorRef?.current ?? anchor;
      const rect = target && document.body.contains(target) ? target.getBoundingClientRect() : null;

      const appRect = document.querySelector('.app')?.getBoundingClientRect();
      let left =
        kind === 'sheet' && appRect
          ? clamp(appRect.right - width, 0, viewportW - width)
          : viewportW - width - gutter;
      let top = gutter;

      if (kind === 'sheet') {
        top = 0;
      } else if (rect && rect.width > 0 && rect.height > 0) {
        if (kind === 'popover') {
          left = clamp(rect.right - width, gutter, viewportW - width - gutter);
          top = clamp(rect.bottom + 6, gutter, viewportH - minPanelH - gutter);
        }
      }

      setStyle({
        '--overlay-left': `${Math.round(left)}px`,
        '--overlay-top': `${Math.round(top)}px`,
        '--overlay-width': `${Math.round(width)}px`,
        '--overlay-max-height': `${Math.round(viewportH - top - gutter)}px`,
      } as CSSProperties);
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, anchorRef, kind]);

  return style;
}

export function Dialog(props: {
  title: ReactNode;
  danger?: boolean;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
}) {
  return (
    <Portal>
      <div className="dialog-scrim" onClick={props.onClose}>
        <div className="dialog" role="alertdialog" onClick={(e) => e.stopPropagation()}>
          <h2 className="dialog-title">
            {props.danger && <Icon name="trash" />}
            {props.title}
          </h2>
          <p className="dialog-body">{props.children}</p>
          <div className="dialog-actions">{props.actions}</div>
        </div>
      </div>
    </Portal>
  );
}

/**
 * Reusable confirm prompt for every destructive action (discard, delete of any
 * kind). One component so wording/behaviour stay consistent: esc / scrim / the
 * cancel button all dismiss; the confirm is a ruby outline when danger.
 */
export function ConfirmDialog(props: {
  title: ReactNode;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props]);
  return (
    <Dialog
      title={props.title}
      danger={props.danger}
      onClose={props.onCancel}
      actions={
        <>
          <button className="btn btn-secondary" onClick={props.onCancel}>
            {props.cancelLabel}
          </button>
          <button
            className={props.danger ? 'danger-outline' : 'btn btn-primary'}
            onClick={props.onConfirm}
          >
            {props.confirmLabel}
          </button>
        </>
      }
    >
      {props.body}
    </Dialog>
  );
}

export function Sheet(props: {
  children: ReactNode;
  onClose: () => void;
  padded?: boolean;
  className?: string;
}) {
  const { t } = useT();
  const style = useFixedPanelPosition('sheet');
  return (
    <Portal>
      <div className="scrim" onClick={props.onClose} />
      <div
        className={`sheet${props.className ? ` ${props.className}` : ''}`}
        role="dialog"
        style={props.padded === false ? { ...style, padding: '14px 12px 26px', gap: 2 } : style}
      >
        <div className="sheet-chrome">
          <div className="grabber" />
          <button className="sheet-close" onClick={props.onClose} aria-label={t.cancel}>
            <Icon name="x" />
          </button>
        </div>
        {props.children}
      </div>
    </Portal>
  );
}

export interface SnackState {
  id?: number;
  text: string;
  onUndo: () => void;
}

/** Undo snackbar: 5 s countdown, then commits (design S-22/S-26). */
export function Snackbar({ snack, onDone }: { snack: SnackState; onDone: () => void }) {
  const { t } = useT();
  const [left, setLeft] = useState(5);
  useEffect(() => {
    const iv = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    if (left <= 0) onDone();
  }, [left, onDone]);
  return (
    <div className="snackbar">
      <Icon name="trash" />
      <span className="snack-text">{snack.text}</span>
      <button
        className="snack-undo"
        onClick={() => {
          snack.onUndo();
          onDone();
        }}
      >
        {t.undo}
      </button>
      <span className="snack-count">{Math.max(left, 0)}s</span>
    </div>
  );
}

export interface ToastState {
  kind: 'ok' | 'danger';
  icon: string;
  text: string;
}

/** Auto-dismissing toast (3.2 s). Multiple stack bottom-right as a queue. */
export function Toast({
  toast,
  id,
  onExpire,
}: {
  toast: ToastState;
  id: number;
  onExpire: (id: number) => void;
}) {
  useEffect(() => {
    const to = setTimeout(() => onExpire(id), 3200);
    return () => clearTimeout(to);
  }, [id, onExpire]);
  return (
    <div className={`toast ${toast.kind}`}>
      <Icon name={toast.icon} />
      <span>{toast.text}</span>
    </div>
  );
}

export function Switch({ on }: { on: boolean }) {
  // Presentational only: the enclosing .toggle-row button owns the click, so
  // the switch must not also handle it (double toggle would cancel out).
  return (
    <span className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={on}>
      <span className="knob" />
    </span>
  );
}

/**
 * Compact language selector — flag chip on every screen (documented addition
 * on top of the boards; see docs/DESIGN.md). Opens a popover with all locales.
 */
export function LanguageSelector() {
  const { locale } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const popStyle = useFixedPanelPosition('popover', ref);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  return (
    <div className="lang" ref={ref}>
      <button
        className="lang-chip"
        aria-label={LOCALES[locale].language}
        aria-expanded={open}
        onClick={() => setOpen((x) => !x)}
      >
        <span aria-hidden>{FLAGS[locale]}</span>
      </button>
      {open && (
        <Portal>
          <div className="lang-pop" role="menu" ref={popRef} style={popStyle}>
            {LOCALE_IDS.map((id) => (
              <button
                key={id}
                role="menuitemradio"
                aria-checked={id === locale}
                className={`lang-item${id === locale ? ' active' : ''}`}
                onClick={() => {
                  setLocale(id);
                  setOpen(false);
                }}
              >
                <span aria-hidden>{FLAGS[id]}</span>
                <span>{LOCALES[id].locale}</span>
              </button>
            ))}
          </div>
        </Portal>
      )}
    </div>
  );
}

export function EmptyState(props: {
  icon: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name={props.icon} />
      <div className="t">{props.title}</div>
      <div className="s">{props.body}</div>
      {props.children}
    </div>
  );
}
