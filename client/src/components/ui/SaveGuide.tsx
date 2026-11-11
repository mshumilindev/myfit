import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { Button } from './Button';
import type { ButtonProps } from './Button';

import './SaveGuide.css';

/** Put this class on the first unfilled field: the Guide outline (tone `guide`, no text). */
export const GUIDE_OUTLINE_CLASS = 'uisg-hit';

export interface SaveGuideItem {
  id: string;
  /** What is still needed, as the flag lists it. */
  label: string;
  done: boolean;
}

export interface SaveGuideProps extends Omit<ButtonProps, 'disabled' | 'onClick' | 'children'> {
  label: ReactNode;
  /** One entry per required thing, in form order. */
  items: SaveGuideItem[];
  /** Header of the flag (localised by the caller). */
  heading: string;
  /** Runs only when nothing is missing. */
  onSave: () => void;
  /** Press on the unavailable Save: the id of the first missing item (the form outlines that field). */
  onReveal?: (firstMissingId: string | null) => void;
}

/**
 * A Save that explains itself. While something required is missing it carries one dot per item
 * (done / next / open), stays pressable (`aria-disabled`) and, on press, raises a flag with what is
 * still needed; the form outlines the first missing field. All dots vanish when everything is filled.
 * Signal colour = the `guide` tone: Learn colour of the theme, reserved pink when that is monochrome.
 */
export function SaveGuide({
  label,
  items,
  heading,
  onSave,
  onReveal,
  className,
  ...rest
}: SaveGuideProps) {
  const missing = items.filter((i) => !i.done);
  const ready = missing.length === 0;
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const firstId = missing[0]?.id ?? null;

  // The flag follows the form: it closes (and the outline goes) when everything is filled.
  if (ready && open) setOpen(false);
  useEffect(() => {
    if (ready) onReveal?.(null);
  }, [ready, onReveal]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) {
        setOpen(false);
        onReveal?.(null);
      }
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open, onReveal]);

  const press = () => {
    if (ready) return onSave();
    setOpen(true);
    onReveal?.(firstId);
  };

  return (
    <div ref={wrap} className="uisg uit--guide">
      {open && !ready && (
        <div className="uisg-flag" role="status">
          <b className="uisg-head">{heading}</b>
          {missing.map((i) => (
            <span key={i.id}>{i.label}</span>
          ))}
        </div>
      )}
      <Button
        {...rest}
        className={['uisg-btn', ready ? '' : 'is-off', className ?? ''].filter(Boolean).join(' ')}
        aria-disabled={ready ? undefined : true}
        onClick={press}
      >
        {label}
        {!ready && (
          <span className="uisg-dots" aria-hidden>
            {items.map((i) => (
              <i
                key={i.id}
                className={i.done ? 'is-done' : i.id === firstId ? 'is-next' : undefined}
              />
            ))}
          </span>
        )}
      </Button>
    </div>
  );
}
