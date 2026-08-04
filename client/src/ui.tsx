/**
 * Shared UI primitives from the design system (S-49/S-50 kit + dialogs/sheets).
 * Every surface here mirrors the boards; keep visual changes in styles.css.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type CSSProperties,
  type RefObject,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { getMutationPending, subscribeMutation } from './api';
import { AndroidLogo } from '@phosphor-icons/react/AndroidLogo';
import { AppleLogo } from '@phosphor-icons/react/AppleLogo';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { ArrowCounterClockwise } from '@phosphor-icons/react/ArrowCounterClockwise';
import { ArrowRight } from '@phosphor-icons/react/ArrowRight';
import { ArrowUpRight } from '@phosphor-icons/react/ArrowUpRight';
import { ArrowsClockwise } from '@phosphor-icons/react/ArrowsClockwise';
import { Archive } from '@phosphor-icons/react/Archive';
import { Barbell } from '@phosphor-icons/react/Barbell';
import { Export } from '@phosphor-icons/react/Export';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { Camera } from '@phosphor-icons/react/Camera';
import { Cards } from '@phosphor-icons/react/Cards';
import { CaretLeft } from '@phosphor-icons/react/CaretLeft';
import { CaretRight } from '@phosphor-icons/react/CaretRight';
import { Carrot } from '@phosphor-icons/react/Carrot';
import { ChartLine } from '@phosphor-icons/react/ChartLine';
import { ChartLineUp } from '@phosphor-icons/react/ChartLineUp';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { Clock } from '@phosphor-icons/react/Clock';
import { ClockCountdown } from '@phosphor-icons/react/ClockCountdown';
import { CloudSlash } from '@phosphor-icons/react/CloudSlash';
import { Copy } from '@phosphor-icons/react/Copy';
import { Crosshair } from '@phosphor-icons/react/Crosshair';
import { DotsSixVertical } from '@phosphor-icons/react/DotsSixVertical';
import { DotsThree } from '@phosphor-icons/react/DotsThree';
import { DotsThreeVertical } from '@phosphor-icons/react/DotsThreeVertical';
import { DownloadSimple } from '@phosphor-icons/react/DownloadSimple';
import { Eraser } from '@phosphor-icons/react/Eraser';
import { Envelope } from '@phosphor-icons/react/Envelope';
import { Eye } from '@phosphor-icons/react/Eye';
import { Flame } from '@phosphor-icons/react/Flame';
import { Globe } from '@phosphor-icons/react/Globe';
import { House } from '@phosphor-icons/react/House';
import { ImageSquare } from '@phosphor-icons/react/ImageSquare';
import { Info } from '@phosphor-icons/react/Info';
import { Key } from '@phosphor-icons/react/Key';
import { ListChecks } from '@phosphor-icons/react/ListChecks';
import { ListPlus } from '@phosphor-icons/react/ListPlus';
import { LockSimple } from '@phosphor-icons/react/LockSimple';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { MapPin } from '@phosphor-icons/react/MapPin';
import { MapPinLine } from '@phosphor-icons/react/MapPinLine';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { Phone } from '@phosphor-icons/react/Phone';
import { Play } from '@phosphor-icons/react/Play';
import { Plus } from '@phosphor-icons/react/Plus';
import { QrCode } from '@phosphor-icons/react/QrCode';
import { CaretLineDown } from '@phosphor-icons/react/CaretLineDown';
import { CaretLineUp } from '@phosphor-icons/react/CaretLineUp';
import { Check } from '@phosphor-icons/react/Check';
import { Circle } from '@phosphor-icons/react/Circle';
import { Columns } from '@phosphor-icons/react/Columns';
import { Cylinder } from '@phosphor-icons/react/Cylinder';
import { Devices } from '@phosphor-icons/react/Devices';
import { Equals } from '@phosphor-icons/react/Equals';
import { Fire } from '@phosphor-icons/react/Fire';
import { FrameCorners } from '@phosphor-icons/react/FrameCorners';
import { FunnelSimple } from '@phosphor-icons/react/FunnelSimple';
import { PersonSimple } from '@phosphor-icons/react/PersonSimple';
import { Plugs } from '@phosphor-icons/react/Plugs';
import { Robot } from '@phosphor-icons/react/Robot';
import { Rows } from '@phosphor-icons/react/Rows';
import { Toolbox } from '@phosphor-icons/react/Toolbox';
import { WaveSine } from '@phosphor-icons/react/WaveSine';
import { Scales } from '@phosphor-icons/react/Scales';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { SignOut } from '@phosphor-icons/react/SignOut';
import { SquaresFour } from '@phosphor-icons/react/SquaresFour';
import { Star } from '@phosphor-icons/react/Star';
import { Timer } from '@phosphor-icons/react/Timer';
import { Trash } from '@phosphor-icons/react/Trash';
import { Trophy } from '@phosphor-icons/react/Trophy';
import { UploadSimple } from '@phosphor-icons/react/UploadSimple';
import { User } from '@phosphor-icons/react/User';
import { UserFocus } from '@phosphor-icons/react/UserFocus';
import { WarningCircle } from '@phosphor-icons/react/WarningCircle';
import { X } from '@phosphor-icons/react/X';
import type { IconProps } from '@phosphor-icons/react/dist/lib/types';
import { FLAGS, LOCALE_IDS, LOCALES, setLocale, useT } from './i18n';

/**
 * Icons are bundled SVG components (@phosphor-icons/react) — the same Phosphor
 * glyphs the boards use, but with no icon font to load (nothing to 404, no
 * FOUC, works offline). The <i> wrapper keeps the existing `i { font-size }`
 * CSS contract: the SVG is sized 1em.
 */
const ICONS: Record<string, ComponentType<IconProps>> = {
  'android-logo': AndroidLogo,
  'apple-logo': AppleLogo,
  'arrow-clockwise': ArrowClockwise,
  'arrow-counter-clockwise': ArrowCounterClockwise,
  'arrow-right': ArrowRight,
  'arrow-up-right': ArrowUpRight,
  'arrows-clockwise': ArrowsClockwise,
  archive: Archive,
  barbell: Barbell,
  export: Export,
  'calendar-blank': CalendarBlank,
  camera: Camera,
  'caret-left': CaretLeft,
  'caret-right': CaretRight,
  carrot: Carrot,
  'chart-line': ChartLine,
  'chart-line-up': ChartLineUp,
  'check-circle': CheckCircle,
  clock: Clock,
  'clock-countdown': ClockCountdown,
  'cloud-slash': CloudSlash,
  copy: Copy,
  crosshair: Crosshair,
  'dots-six': DotsSixVertical,
  'dots-three': DotsThree,
  'dots-three-vertical': DotsThreeVertical,
  eraser: Eraser,
  envelope: Envelope,
  eye: Eye,
  flame: Flame,
  globe: Globe,
  house: House,
  'image-square': ImageSquare,
  info: Info,
  key: Key,
  cards: Cards,
  'list-checks': ListChecks,
  'list-plus': ListPlus,
  'lock-simple': LockSimple,
  'magnifying-glass': MagnifyingGlass,
  'map-pin': MapPin,
  'map-pin-slash': MapPinLine,
  'pencil-simple': PencilSimple,
  phone: Phone,
  play: Play,
  plus: Plus,
  'qr-code': QrCode,
  'caret-line-down': CaretLineDown,
  'caret-line-up': CaretLineUp,
  check: Check,
  circle: Circle,
  columns: Columns,
  cylinder: Cylinder,
  devices: Devices,
  equals: Equals,
  fire: Fire,
  'frame-corners': FrameCorners,
  'funnel-simple': FunnelSimple,
  'person-simple': PersonSimple,
  plugs: Plugs,
  robot: Robot,
  rows: Rows,
  toolbox: Toolbox,
  'wave-sine': WaveSine,
  scales: Scales,
  'shield-check': ShieldCheck,
  'sign-out': SignOut,
  star: Star,
  'squares-four': SquaresFour,
  timer: Timer,
  trash: Trash,
  trophy: Trophy,
  user: User,
  'user-focus': UserFocus,
  'download-simple': DownloadSimple,
  'upload-simple': UploadSimple,
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
  const classes = ['ui-icon', className].filter(Boolean).join(' ');
  return (
    <i className={classes} aria-hidden>
      {Glyph ? <Glyph size="1em" weight={weight} /> : null}
    </i>
  );
}

/** Media hook: true at the desktop breakpoint (≥720 px). */
export function useIsDesktop(): boolean {
  const [is, setIs] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 720px)').matches,
  );
  useEffect(() => {
    const q = window.matchMedia('(min-width: 720px)');
    const on = () => setIs(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return is;
}

/** S-10 · Today · skeleton — never a spinner. */
export function ScreenSkeleton({ label }: { label?: string }) {
  const recent = [
    { title: 120, sub: 180 },
    { title: 96, sub: 164 },
    { title: 130, sub: 150 },
  ] as const;
  return (
    <div className="screen screen-skel" role="status" aria-live="polite" aria-label={label}>
      <div className="skel-head">
        <div className="sk" style={{ width: 120, height: 10 }} />
        <div className="sk" style={{ width: 210, height: 26 }} />
      </div>
      <div className="skel-week">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="sk" style={{ flex: 1, height: 46 }} />
        ))}
      </div>
      <div className="sk skel-cta" />
      <div className="skel-tiles">
        <div className="sk" style={{ flex: 1, height: 92 }} />
        <div className="sk" style={{ flex: 1, height: 92 }} />
      </div>
      <div className="skel-recent">
        <div className="sk" style={{ width: 70, height: 9 }} />
        {recent.map((row, i) => (
          <div key={i} className="skel-recent-row">
            <div className="sk" style={{ width: 40, height: 9 }} />
            <div className="skel-recent-body">
              <div className="sk" style={{ width: row.title, height: 13 }} />
              <div className="sk" style={{ width: row.sub, height: 9 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** AD-06 people rows, or S-50 avatar-row when `withMeta` is false. */
export function RowListSkeleton({
  rows = 3,
  withAvatar = true,
  withMeta = true,
  className,
}: {
  rows?: number;
  withAvatar?: boolean;
  withMeta?: boolean;
  className?: string;
}) {
  return (
    <div
      className={['row-list-skel', className].filter(Boolean).join(' ')}
      aria-hidden
      role="presentation"
    >
      {withMeta && <div className="sk" style={{ width: 120, height: 10 }} />}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="row-list-skel-item">
          {withAvatar && (
            <div
              className="sk row-list-skel-avatar"
              style={withMeta ? undefined : { width: 44, height: 44, borderRadius: 12 }}
            />
          )}
          {withMeta ? (
            <>
              <div className="sk row-list-skel-line" />
              <div className="sk row-list-skel-meta" style={{ width: 70 }} />
              <div className="sk row-list-skel-meta" style={{ width: 90 }} />
            </>
          ) : (
            <div className="row-list-skel-body">
              <div className="sk" style={{ width: '40%', height: 13 }} />
              <div className="sk" style={{ width: '65%', height: 9 }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** O-10 · Profile · avatar & people skeleton. */
export function ProfileSkeleton() {
  return (
    <div className="profile-skel" aria-hidden role="presentation">
      <div className="profile-skel-hero">
        <div className="sk profile-skel-avatar" />
        <div className="profile-skel-id">
          <div className="sk" style={{ width: '55%', height: 18 }} />
          <div className="sk" style={{ width: '42%', height: 12 }} />
          <div className="sk" style={{ width: 72, height: 22, borderRadius: 999 }} />
        </div>
      </div>
      <div className="sk" style={{ width: 160, height: 10 }} />
      <div className="profile-skel-people">
        {[0, 1].map((i) => (
          <div key={i} className="profile-skel-person">
            <div className="sk profile-skel-person-avatar" />
            <div className="profile-skel-person-body">
              <div className="sk" style={{ width: '46%', height: 14 }} />
              <div className="sk" style={{ width: '62%', height: 11 }} />
            </div>
          </div>
        ))}
      </div>
      <div className="profile-skel-rows">
        {[0, 1, 2].map((i) => (
          <div key={i} className="sk profile-skel-row" />
        ))}
      </div>
    </div>
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
  preferredWidth?: number,
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
      const preferredW = preferredWidth ?? (kind === 'sheet' ? 430 : 176);
      const width = Math.min(preferredW, viewportW - Math.max(gutter * 2, 36));
      const minPanelH = kind === 'sheet' ? 320 : 220;
      const target = anchorRef?.current ?? anchor;
      const rect = target && document.body.contains(target) ? target.getBoundingClientRect() : null;

      let left = viewportW - width - gutter;
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
  }, [anchor, anchorRef, kind, preferredWidth]);

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
  const style = useFixedPanelPosition(
    'sheet',
    undefined,
    props.className?.split(/\s+/).includes('assign-sheet') ? 760 : undefined,
  );
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
        type="button"
        aria-label={LOCALES[locale].language}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((x) => !x)}
      >
        <span aria-hidden>{FLAGS[locale]}</span>
        <span className="lang-chip-label">{LOCALES[locale].locale}</span>
        <Icon name="caret-line-down" className="lang-chip-caret" />
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
      <h4 className="t">{props.title}</h4>
      <p className="s">{props.body}</p>
      {props.children}
    </div>
  );
}

/** Full-page scrim + spinner while a mutation (callable / tracked write) is in flight. */
export function ServerBusyOverlay() {
  const { t } = useT();
  const busy = useSyncExternalStore(
    subscribeMutation,
    () => getMutationPending() > 0,
    () => false,
  );
  if (!busy) return null;
  return (
    <Portal>
      <div className="server-busy-scrim" role="alert" aria-busy="true" aria-live="assertive">
        <div className="sp" aria-label={t.saving} />
      </div>
    </Portal>
  );
}
