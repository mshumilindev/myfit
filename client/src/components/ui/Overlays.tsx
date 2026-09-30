/**
 * Overlays — Sheet, Dialog, ConfirmDialog, Toast/Snackbar/UpdatePlate.
 * The one implementation of every floating surface; look lives in Overlays.css
 * (+ glass.css). Re-exported from `ui.tsx` so existing imports keep working.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { Icon } from '../../ui';
import { useT } from '../../i18n';
import { Button, IconButton } from './Button';
import { toneClass, type Tone } from './tones';

import './Overlays.css';

export function Portal(props: { children: ReactNode }) {
  if (typeof document === 'undefined') return <>{props.children}</>;
  // React bubbles portal events through the COMPONENT tree, not the DOM: a tap
  // on a sheet's scrim (or anything inside it) would otherwise reach whatever
  // row/button rendered the sheet and trigger it "under" the drawer. The
  // wrapper is layout-neutral and stops clicks at the portal boundary.
  return createPortal(
    <div className="portal-layer" onClick={(e) => e.stopPropagation()}>
      {props.children}
    </div>,
    document.body,
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function activeAnchor(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function isTextEditableElement(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  // A <select> opens a native picker, not a text keyboard, so it must NOT put
  // the sheet into keyboard mode (that's what made the Range picker jump).
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

function useMobileSheetKeyboardMode(sheetRef: RefObject<HTMLElement | null>): boolean {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const isPhone = () => !window.matchMedia || !window.matchMedia('(min-width: 720px)').matches;
    const focusedInsideSheet = () => {
      const active = document.activeElement;
      return !!sheetRef.current?.contains(active) && isTextEditableElement(active);
    };
    const update = () => {
      const vv = window.visualViewport;
      const top = vv?.offsetTop ?? 0;
      const height = vv?.height ?? window.innerHeight;
      sheetRef.current?.style.setProperty('--sheet-keyboard-top', `${Math.max(0, top)}px`);
      sheetRef.current?.style.setProperty('--sheet-keyboard-height', `${Math.round(height)}px`);
      setExpanded(isPhone() && focusedInsideSheet());
    };
    const updateAfterFocusSettles = () => window.setTimeout(update, 160);

    update();
    const frame = window.requestAnimationFrame(update);
    window.addEventListener('focusin', update);
    window.addEventListener('focusout', updateAfterFocusSettles);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('focusin', update);
      window.removeEventListener('focusout', updateAfterFocusSettles);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [sheetRef]);

  return expanded;
}

export function useFixedPanelPosition(
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
  /** Colour family of the prompt (defaults to danger when `danger`, else accent). */
  tone?: Tone;
  /** Title icon (defaults to a trash can for danger, none otherwise). */
  icon?: string;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
}) {
  const tone: Tone = props.tone ?? (props.danger ? 'danger' : 'accent');
  const icon = props.icon ?? (props.danger ? 'trash' : undefined);
  return (
    <Portal>
      <div className="dialog-scrim" onClick={props.onClose}>
        <div
          className={`dialog ${toneClass(tone)}`}
          role="alertdialog"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="dialog-title">
            {icon && <Icon name={icon} />}
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
  tone?: Tone;
  icon?: string;
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
      tone={props.tone}
      icon={props.icon}
      onClose={props.onCancel}
      actions={
        <>
          <Button variant="secondary" onClick={props.onCancel}>
            {props.cancelLabel}
          </Button>
          <Button
            variant={props.danger || props.tone === 'danger' ? 'danger' : 'primary'}
            onClick={props.onConfirm}
          >
            {props.confirmLabel}
          </Button>
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
  /** Colour family for the whole drawer (background, grabber, border, title) —
   *  e.g. the day-state colour in the calendar drawers. */
  tone?: Tone;
}) {
  const { t } = useT();
  const sheetRef = useRef<HTMLDivElement>(null);
  const keyboardMode = useMobileSheetKeyboardMode(sheetRef);
  const style = useFixedPanelPosition(
    'sheet',
    undefined,
    props.className?.split(/\s+/).includes('assign-sheet') ? 760 : undefined,
  );

  // The sheet is bottom-anchored, so dragging the grabber UP grows its HEIGHT
  // (top edge rises, bottom stays put); dragging DOWN first shrinks the height
  // back toward the default, and only once it's below the default does the whole
  // drawer translate down into the dismiss zone. `heightPx` is the committed
  // snap height (set after the first drag so height transitions can animate),
  // `liveH` the height while a finger is down, `drag` the dismiss-zone offset.
  const [mode, setMode] = useState<'default' | 'full'>('default');
  const [heightPx, setHeightPx] = useState<number | null>(null);
  const [liveH, setLiveH] = useState<number | null>(null);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const defaultHRef = useRef(0);
  const g = useRef({
    startY: 0,
    lastY: 0,
    lastT: 0,
    vel: 0,
    active: false,
    startH: 0,
    defaultH: 0,
    fullH: 0,
  });

  const requestClose = useCallback(() => {
    setClosing((c) => {
      if (c) return c;
      window.setTimeout(props.onClose, 240);
      return true;
    });
  }, [props.onClose]);

  const onGrabStart = (clientY: number) => {
    const el = sheetRef.current;
    if (!el) return;
    const startH = el.getBoundingClientRect().height;
    if (mode === 'default') defaultHRef.current = startH;
    const defaultH = defaultHRef.current || startH;
    const fullH = Math.max(defaultH, window.innerHeight - 46);
    g.current = {
      startY: clientY,
      lastY: clientY,
      lastT: Date.now(),
      vel: 0,
      active: true,
      startH,
      defaultH,
      fullH,
    };
    setDragging(true);
  };
  const onGrabMove = (clientY: number) => {
    const s = g.current;
    if (!s.active) return;
    const now = Date.now();
    const dt = now - s.lastT;
    if (dt > 0) s.vel = (clientY - s.lastY) / dt; // px/ms, +down
    s.lastY = clientY;
    s.lastT = now;
    const dy = clientY - s.startY;
    const rawH = s.startH - dy; // up (dy<0) grows, down (dy>0) shrinks
    if (rawH >= s.defaultH) {
      // Height zone: grow toward full, with a little rubber-band past it.
      setLiveH(rawH > s.fullH ? s.fullH + (rawH - s.fullH) * 0.3 : rawH);
      setDrag(0);
    } else {
      // Dismiss zone: height pinned at default, whole sheet slides down.
      setLiveH(s.defaultH);
      setDrag(s.defaultH - rawH);
    }
  };
  const onGrabEnd = () => {
    const s = g.current;
    if (!s.active) return;
    s.active = false;
    setDragging(false);
    setLiveH(null);
    const dy = s.lastY - s.startY;
    const rawH = s.startH - dy;
    const flickDown = s.vel > 0.7;
    const flickUp = s.vel < -0.7;
    if (rawH < s.defaultH) {
      // Ended in the dismiss zone: close on a big pull or a downward flick.
      const dismiss = s.defaultH - rawH;
      if (dismiss > 100 || flickDown) return requestClose();
      setMode('default');
      setHeightPx(s.defaultH);
      setDrag(0);
      return;
    }
    // Height zone: snap to full or default by where it crossed the midpoint.
    const toFull = rawH > (s.defaultH + s.fullH) / 2 || flickUp;
    setMode(toFull ? 'full' : 'default');
    setHeightPx(toFull ? s.fullH : s.defaultH);
    setDrag(0);
  };

  const classes = [
    'sheet',
    keyboardMode ? 'sheet-keyboard-expanded' : '',
    mode === 'full' ? 'sheet-full' : '',
    dragging ? 'sheet-dragging' : '',
    closing ? 'sheet-closing' : '',
    props.tone ? `sheet--toned ${toneClass(props.tone)}` : '',
    props.className,
  ]
    .filter(Boolean)
    .join(' ');

  const baseStyle =
    props.padded === false ? { ...style, padding: '14px 12px 26px', gap: 2 } : { ...style };
  const cssStyle = baseStyle as CSSProperties;
  if (closing) {
    // Slide fully out; the transform transition carries it from its current spot.
    cssStyle.transform = 'translateY(100%)';
  } else {
    const h = liveH ?? heightPx;
    if (h != null) cssStyle.height = `${h}px`;
    if (drag !== 0) cssStyle.transform = `translateY(${drag}px)`;
  }

  return (
    <Portal>
      <div className={`scrim${closing ? ' scrim-closing' : ''}`} onClick={requestClose} />
      <div ref={sheetRef} className={classes} role="dialog" style={baseStyle}>
        <div
          className="sheet-grip"
          onTouchStart={(e) => onGrabStart(e.touches[0].clientY)}
          onTouchMove={(e) => onGrabMove(e.touches[0].clientY)}
          onTouchEnd={onGrabEnd}
          onTouchCancel={onGrabEnd}
        >
          <div className="grabber" />
        </div>
        <div
          className="sheet-chrome"
          onTouchStart={(e) => onGrabStart(e.touches[0].clientY)}
          onTouchMove={(e) => onGrabMove(e.touches[0].clientY)}
          onTouchEnd={onGrabEnd}
          onTouchCancel={onGrabEnd}
        >
          <IconButton
            className="sheet-close"
            icon="x"
            variant="fill"
            shape="round"
            size="sm"
            label={t.cancel}
            onClick={requestClose}
          />
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
export function UndoSnackbar({ snack, onDone }: { snack: SnackState; onDone: () => void }) {
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
    <div className={`snackbar ${toneClass('danger')}`}>
      <Icon name="trash" />
      <span className="snack-text">{snack.text}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          snack.onUndo();
          onDone();
        }}
      >
        {t.undo}
      </Button>
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
    <div className={`toast ${toast.kind} ${toneClass(toast.kind)}`}>
      <Icon name={toast.icon} />
      <span>{toast.text}</span>
    </div>
  );
}

/**
 * "New build is live" plate — persists (no auto-dismiss) until the user taps
 * Reload. Raised by the service-worker update signal (see pwaUpdate); the app
 * renders it in the toast holder when a replacement worker has taken control.
 */
export function UpdatePlate() {
  const { t } = useT();
  return (
    <div className={`toast update ${toneClass('accent')}`} role="alert">
      <Icon name="arrows-clockwise" />
      <span className="update-text">{t.updateReady}</span>
      <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
        {t.reload}
      </Button>
    </div>
  );
}
