import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../cx';
import { SkScrim } from './SkScrim';
import '../tokens-e.css';
import './SkSheet.css';

export type SkSheetVariant = 'auto' | 'sheet' | 'modal';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Dialog surface: bottom sheet (with grabber) on mobile, centred modal from the wide breakpoint (`auto`),
 * or forced with `variant`. Scrim, focus trap, Escape, aria-modal; focus returns to the opener on close.
 */
export function SkSheet({
  open,
  onClose,
  label,
  variant = 'auto',
  contained,
  dismissOnScrim = true,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  /** Accessible name of the dialog (e.g. "Remove Health?"). */
  label: string;
  variant?: SkSheetVariant;
  /** Position inside the nearest positioned ancestor instead of the viewport (frames, stories). */
  contained?: boolean;
  dismissOnScrim?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    return () => opener?.focus?.();
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (!items.length) {
      e.preventDefault();
      return;
    }
    const firstEl = items[0];
    const lastEl = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === firstEl || active === ref.current)) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && active === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  };

  return (
    <>
      <SkScrim contained={contained} onDismiss={dismissOnScrim ? onClose : undefined} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cx('sk-sheet', `sk-sheet-${variant}`, contained && 'sk-sheet-in', className)}
      >
        <div className="sk-grab" aria-hidden="true" />
        {children}
      </div>
    </>
  );
}
