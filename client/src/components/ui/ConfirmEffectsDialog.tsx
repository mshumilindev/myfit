import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from '../../ui';
import { useT } from '../../i18n';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Portal, Sheet } from './Overlays';
import { COACH_BREAKPOINT, useMinWidth } from './breakpoints';
import { toneClass, type Tone } from './tones';
import './ConfirmEffectsDialog.css';

export interface ConfirmEffectsDialogProps {
  title: ReactNode;
  body?: ReactNode;
  /** The thing being deleted, quoted (two lines max) so it is clear which one. */
  quote?: string;
  /** Who stops seeing what: one line each, with an icon. */
  effects?: readonly { icon: string; text: string }[];
  /** Optional extra choice ("Also delete my notes"), unchecked by default. */
  check?: { label: string; checked: boolean; onChange: (v: boolean) => void };
  /** The small print ("You can undo for 8 seconds..."). */
  small?: ReactNode;
  /** Icon before the small print (default a countdown clock, the undo line); `false` = none. */
  smallIcon?: string | false;
  /** Colour family of the whole prompt (default `accent`). */
  tone?: Tone;
  /** Absent = an information dialog with only the cancel / close button (security code, re-auth result). */
  confirmLabel?: string;
  cancelLabel: string;
  /** Free content after the effects and the choice (a security code, a re-authentication field). */
  children?: ReactNode;
  /** Colour of the title icon: `danger` (default, something goes away) or `accent` (a calm question). */
  iconTone?: 'danger' | 'accent';
  /** The confirm button shows the kit loading state and the dialog ignores a second tap. */
  loading?: boolean;
  /** `false` = Esc and the scrim do not close it and a phone shows the centred dialog, not a sheet (an idle lock must be answered). Default true. */
  dismissable?: boolean;
  icon?: string;
  /** Look of the confirming button (default `danger`: something goes away). `primary` for a plain "Go ahead". */
  confirmVariant?: 'danger' | 'primary';
  /** Look of the cancelling button (default `primary`: the safe choice is the offered one). */
  cancelVariant?: 'primary' | 'secondary';
  /** Which button takes focus when the dialog opens (default `cancel`, the safe one). */
  initialFocus?: 'cancel' | 'confirm';
  onConfirm?: () => void;
  onCancel: () => void;
}

/**
 * Confirmation for a destructive action that says who stops seeing what (kit group `Coach/Confirm dialog`):
 * a centred glass dialog from the Coach breakpoint up, a bottom sheet below it. Cancel is focused first and is the
 * kit primary; the destructive button is the kit `danger`. Esc, the scrim and Cancel dismiss. The plain
 * `ConfirmDialog` in Overlays stays for one-line confirms.
 */
export function ConfirmEffectsDialog(p: ConfirmEffectsDialogProps) {
  const { t } = useT();
  const desktop = useMinWidth(COACH_BREAKPOINT);
  const titleId = useId();
  const actRef = useRef<HTMLDivElement>(null);
  const focusConfirm = useRef(p.initialFocus === 'confirm');
  const cancelFn = useRef(p.onCancel);
  const dismissable = useRef(p.dismissable !== false);
  useEffect(() => {
    cancelFn.current = p.onCancel;
    dismissable.current = p.dismissable !== false;
  });
  useEffect(() => {
    const btns = actRef.current?.querySelectorAll('button');
    btns?.[focusConfirm.current ? 1 : 0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (dismissable.current) cancelFn.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const content = (
    <div className={`uicfx${p.iconTone === 'accent' ? ' uicfx--calm' : ''}`}>
      <h2 className="uicfx-title" id={titleId}>
        <Icon name={p.icon ?? 'trash'} />
        {p.title}
      </h2>
      {p.body != null && <p className="uicfx-body">{p.body}</p>}
      {p.quote && (
        <blockquote className="uicfx-quote">
          <span className="uicfx-quote-t">{p.quote}</span>
        </blockquote>
      )}
      {p.effects && p.effects.length > 0 && (
        <ul className="uicfx-fx">
          {p.effects.map((e) => (
            <li key={e.text}>
              <Icon name={e.icon} />
              <span>{e.text}</span>
            </li>
          ))}
        </ul>
      )}
      {p.children}
      {p.check && (
        <label className="uicfx-check">
          <Checkbox checked={p.check.checked} onChange={p.check.onChange} />
          <span>{p.check.label}</span>
        </label>
      )}
      {p.small && (
        <p className="uicfx-small">
          {p.smallIcon !== false && <Icon name={p.smallIcon ?? 'clock-countdown'} />}
          {p.small}
        </p>
      )}
      <div className="uicfx-act" ref={actRef}>
        <Button variant={p.cancelVariant ?? 'primary'} onClick={p.onCancel}>
          {p.cancelLabel}
        </Button>
        {p.confirmLabel && p.onConfirm && (
          <Button
            variant={p.confirmVariant ?? 'danger'}
            loading={p.loading}
            disabled={p.loading}
            onClick={p.onConfirm}
          >
            {p.confirmLabel}
          </Button>
        )}
      </div>
    </div>
  );

  // a dialog that must be answered (idle lock) is never a swipe-to-dismiss sheet
  if (!desktop && p.dismissable !== false) {
    return (
      <Sheet
        role="alertdialog"
        closeLabel={t.close}
        onClose={p.onCancel}
        className="uicfx-sheet"
        tone={p.tone ?? 'accent'}
        label={typeof p.title === 'string' ? p.title : undefined}
      >
        {content}
      </Sheet>
    );
  }
  return (
    <Portal>
      <div className="dialog-scrim" onClick={() => dismissable.current && p.onCancel()}>
        <div
          className={`dialog uicfx-dialog ${toneClass(p.tone ?? 'accent')}`}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    </Portal>
  );
}
