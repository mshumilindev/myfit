/**
 * Overlays — Sheet, Dialog, ConfirmDialog, Toast/Snackbar/UpdatePlate.
 * The one implementation of every floating surface; look lives in Overlays.css
 * (+ glass.css). Re-exported from `ui.tsx` so existing imports keep working.
 */
import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  type TouchEvent as ReactTouchEvent,
  type RefObject,
  type ReactNode,
} from 'react';
import { Icon } from '../../ui';
import { useT } from '../../i18n';
import { IconButton } from './Button';
import { ConfirmEffectsDialog } from './ConfirmEffectsDialog';
import { activeAnchor } from './overlays/focus';
import { Portal } from './overlays/Portal';
import { useFixedPanelPosition } from './overlays/position';
import { useMobileSheetKeyboardMode } from './overlays/useSheetKeyboard';
import { useSheetGesture } from './overlays/useSheetGesture';
import { useSheetOverflowGuard } from './overlays/sheetOverflow';
import { useBlockingSheetTrap } from './overlays/sheetTrap';
import { toneClass, type Tone } from './tones';

import './Overlays.css';

// Public surface unchanged: everything below is re-exported from here.
export { Portal, useFixedPanelPosition };
export { Toast, UndoSnackbar, UpdatePlate } from './overlays/Toasts';
export type { SnackState, ToastState } from './overlays/Toasts';

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
  const uid = useId();
  return (
    <Portal>
      <div className="dialog-scrim" onClick={props.onClose}>
        <div
          className={`dialog ${toneClass(tone)}`}
          role="alertdialog"
          aria-labelledby={`${uid}-t`}
          aria-describedby={`${uid}-b`}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="dialog-title" id={`${uid}-t`}>
            {icon && <Icon name={icon} />}
            {props.title}
          </h2>
          <p className="dialog-body" id={`${uid}-b`}>
            {props.children}
          </p>
          <div className="dialog-actions">{props.actions}</div>
        </div>
      </div>
    </Portal>
  );
}

/**
 * Reusable confirm prompt for every destructive action (discard, delete of any kind). One component so wording and
 * behaviour stay consistent: a centred dialog from the Coach breakpoint up, a bottom sheet on a phone; Esc, the scrim
 * and Cancel dismiss; the confirm is the kit `danger` button when `danger`. Optional: a checkbox ("Also delete my
 * notes"), a line of fine print under it, and `loading` (the confirm shows the kit spinner and ignores a second tap).
 * Built on `ConfirmEffectsDialog`, which owns the presentation switch.
 */
export function ConfirmDialog(props: {
  title: ReactNode;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  tone?: Tone;
  icon?: string;
  /** An extra choice, unchecked by default (R-KIT-02). */
  checkbox?: { label: string; checked: boolean; onChange: (v: boolean) => void };
  /** Small print under the choice, without an icon. */
  fineprint?: ReactNode;
  /** The confirm shows the loading state and a second tap does nothing. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const danger = props.danger || props.tone === 'danger';
  return (
    <ConfirmEffectsDialog
      title={props.title}
      body={props.body}
      icon={props.icon ?? (props.danger ? 'trash' : 'question')}
      iconTone={danger ? 'danger' : 'accent'}
      tone={props.tone ?? (props.danger ? 'danger' : 'accent')}
      confirmVariant={danger ? 'danger' : 'primary'}
      cancelVariant="secondary"
      check={props.checkbox}
      small={props.fineprint}
      smallIcon={false}
      loading={props.loading}
      confirmLabel={props.confirmLabel}
      cancelLabel={props.cancelLabel}
      onConfirm={props.onConfirm}
      onCancel={props.onCancel}
    />
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
  /** Accessible name of the drawer (aria-label). */
  label?: string;
  /** Where focus goes back to on close (defaults to the element focused when the sheet opened). */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** `alertdialog` for a sheet that asks for a decision (the phone form of a confirm). Default `dialog`. */
  role?: 'dialog' | 'alertdialog';
  /** Name of the corner close button (default "Cancel"; "Close" where the content has its own Cancel). */
  closeLabel?: string;
  /** `light`: a faint scrim, for a panel over content that stays readable (the calendar behind a session panel). */
  scrim?: 'default' | 'light';
  /** A click on the scrim (default: close). A screen may pass the click on to what is under it. */
  onScrimClick?: (e: ReactMouseEvent<HTMLElement>) => void;
  /**
   * `false`: the sheet cannot be dismissed (no close button, the scrim, Escape and the grabber swipe do nothing). Only
   * for a blocking prompt the person must answer through its own buttons (the legal gate). Default `true`.
   */
  dismissible?: boolean;
  /** A consent prompt that must stay usable above a blocking sheet even when it mounted in the same commit (not made inert). */
  overTrap?: boolean;
}) {
  const { t } = useT();
  const dismissible = props.dismissible !== false;
  const sheetRef = useRef<HTMLDivElement>(null);
  const keyboardMode = useMobileSheetKeyboardMode(sheetRef);
  useSheetOverflowGuard(sheetRef);
  // A blocking sheet is modal for the keyboard and assistive tech too: focus cycles inside, the page behind is inert.
  useBlockingSheetTrap(sheetRef, !dismissible);
  const style = useFixedPanelPosition(
    'sheet',
    undefined,
    props.className?.split(/\s+/).includes('assign-sheet') ? 760 : undefined,
  );

  const g = useSheetGesture(sheetRef, props.onClose);
  const { mode, heightPx, liveH, drag, dragging, closing, requestClose } = g;
  const { onGrabStart, onGrabMove, onGrabEnd } = g;

  // Touch drags are handled by the touch events below. A mouse or pen (the desktop app, a laptop) sends no touch
  // events at all, so the same drag is wired to pointer events for those (touch pointers are skipped: no double run).
  const mouseGrab = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      // The close button keeps its own click: capturing the pointer would send the click to this strip instead.
      if ((e.target as HTMLElement).closest('button')) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      onGrabStart(e.clientY);
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'touch') onGrabMove(e.clientY);
    },
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'touch') onGrabEnd();
    },
    onPointerCancel: (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'touch') onGrabEnd();
    },
  };

  // Modal behaviour: focus moves into the drawer (to the drawer itself, so a phone keyboard is not
  // raised by accident; a field with autoFocus keeps it), Escape closes it, focus returns to the
  // opener when it unmounts.
  const returnFocusRef = props.returnFocusRef;
  // requestClose changes identity whenever the parent passes a fresh onClose (an inline arrow re-created on every
  // keystroke in a search field). The effect below must NOT re-run for that: its cleanup returns focus to the opener,
  // which blurred the field after each character. So the effect reads the latest callback through a ref.
  const requestCloseRef = useRef(requestClose);
  const dismissibleRef = useRef(dismissible);
  useEffect(() => {
    requestCloseRef.current = requestClose;
    dismissibleRef.current = dismissible;
  });
  useEffect(() => {
    const target = returnFocusRef;
    const opener = target?.current ?? activeAnchor();
    const el = sheetRef.current;
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !dismissibleRef.current) return;
      // A confirm dialog opened over the sheet owns Escape.
      if (document.querySelector('.dialog-scrim')) return;
      requestCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const back = target?.current ?? opener;
      if (back && back.isConnected) back.focus({ preventScroll: true });
    };
  }, [returnFocusRef]);

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
    // At rest in `full` the class (`.sheet-full`: 100dvh - safe-top - 8px) owns the height; an inline pixel height from
    // the gesture would override it and stop the drawer short of the screen edge
    if (h != null && !(mode === 'full' && liveH == null)) cssStyle.height = `${h}px`;
    if (drag !== 0) cssStyle.transform = `translateY(${drag}px)`;
  }

  // A blocking sheet has no swipe either: the gesture would slide it away and close it.
  const grab = dismissible
    ? {
        onTouchStart: (e: ReactTouchEvent<HTMLElement>) => onGrabStart(e.touches[0].clientY),
        onTouchMove: (e: ReactTouchEvent<HTMLElement>) => onGrabMove(e.touches[0].clientY),
        onTouchEnd: onGrabEnd,
        onTouchCancel: onGrabEnd,
        ...mouseGrab,
      }
    : {};

  return (
    <Portal>
      <div
        className={`scrim${closing ? ' scrim-closing' : ''}${props.scrim === 'light' ? ' scrim--light' : ''}`}
        onClick={dismissible ? (props.onScrimClick ?? requestClose) : undefined}
      />
      <div
        ref={sheetRef}
        className={classes}
        role={props.role ?? 'dialog'}
        aria-modal="true"
        aria-label={props.label}
        tabIndex={-1}
        style={baseStyle}
        data-over-trap={props.overTrap ? '' : undefined}
      >
        <div className="sheet-grip" {...grab}>
          <div className="grabber" />
        </div>
        <div className="sheet-chrome" {...grab}>
          {dismissible && (
            <IconButton
              className="sheet-close"
              icon="x"
              variant="fill"
              shape="round"
              size="sm"
              label={props.closeLabel ?? t.cancel}
              onClick={requestClose}
            />
          )}
        </div>
        {props.children}
      </div>
    </Portal>
  );
}
