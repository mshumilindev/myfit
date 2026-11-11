import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';

import { Button } from './Button';
import type { ButtonProps } from './Button';

import './SaveGuide.css';

/**
 * SaveGuide: a Save that explains itself (Guide family, tone `guide`).
 *
 * Use it wherever Save is blocked until required values are filled (never a bare `disabled` Save):
 *
 *   const guide = useSaveGuide([{ id: 'title', label: 'Title', done: !!title.trim() }]);
 *   <ListRow {...} guide={guide.field('title')} />        // or spread guide.field('x') on any element
 *   <SaveGuide guide={guide} label="Save" heading="Still needed" onSave={save} />
 *
 * Flow: while something is missing Save carries one dot per item (done / next / open) and stays
 * pressable (`aria-disabled`). A press raises the flag with what is still needed and dashes the first
 * missing field. Only a press on that dashed field (or Esc) dismisses it, and the field gets focus;
 * a press anywhere else does nothing. The flag and the dashes follow the form live and vanish for good
 * when everything is filled.
 */
export interface GuideItem {
  id: string;
  /** What is still needed, as the flag lists it. */
  label: string;
  done: boolean;
  /** How to put the cursor in this item; default: the first input / button inside the field element. */
  focus?: () => void;
}

/** Props for the element of a required field: the reserved dashed frame + the dismiss/focus press. */
export interface GuideFieldProps {
  className: string;
  onClickCapture: (e: MouseEvent<HTMLElement>) => void;
  'data-guide-hit'?: '';
}

export interface SaveGuideApi {
  items: GuideItem[];
  missing: GuideItem[];
  ready: boolean;
  /** The flag is up and something is still missing. */
  active: boolean;
  /** The first missing item (the one that is dashed). */
  firstId: string | null;
  /** A press on Save: returns true when nothing is missing (the caller saves), otherwise raises the flag. */
  press: () => boolean;
  dismiss: () => void;
  /** Spread on the element of the required field `id` (ListRow takes it as its `guide` prop). */
  field: (id: string) => GuideFieldProps;
}

const FOCUSABLE = 'input, textarea, select, button, [tabindex]:not([tabindex="-1"])';

export function useSaveGuide(items: GuideItem[]): SaveGuideApi {
  const [open, setOpen] = useState(false);
  const missing = useMemo(() => items.filter((i) => !i.done), [items]);
  const ready = missing.length === 0;
  const active = open && !ready;
  const first = missing[0];
  const firstId = first?.id ?? null;

  // Everything filled: the guide is over (a later edit that empties a field starts from a calm form).
  if (ready && open) setOpen(false);

  const dismiss = useCallback(() => setOpen(false), []);
  const press = useCallback(() => {
    if (ready) return true;
    setOpen(true);
    return false;
  }, [ready]);

  useEffect(() => {
    if (!active) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [active]);

  const field = useCallback(
    (id: string): GuideFieldProps => {
      const hit = active && id === firstId;
      return {
        className: `uisg-f${hit ? ' is-hit' : ''}`,
        ...(hit ? { 'data-guide-hit': '' as const } : {}),
        onClickCapture: (e) => {
          if (!hit) return;
          setOpen(false);
          const el = e.currentTarget;
          const item = items.find((i) => i.id === id);
          // after the press itself has settled, so a label / button row does not steal the focus back
          queueMicrotask(() => {
            if (item?.focus) item.focus();
            else el.querySelector<HTMLElement>(FOCUSABLE)?.focus();
          });
        },
      };
    },
    [active, firstId, items],
  );

  return { items, missing, ready, active, firstId, press, dismiss, field };
}

export interface SaveGuideProps extends Omit<ButtonProps, 'disabled' | 'onClick' | 'children'> {
  guide: SaveGuideApi;
  label: ReactNode;
  /** Header of the flag (localised by the caller). */
  heading: string;
  /** Runs only when nothing is missing. */
  onSave: () => void;
}

export function SaveGuide({ guide, label, heading, onSave, className, ...rest }: SaveGuideProps) {
  const flagId = useId();
  const { items, missing, ready, active, firstId } = guide;
  return (
    <div className="uisg uit--guide">
      {active && (
        <div className="uisg-flag" role="status" id={flagId}>
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
        aria-describedby={active ? flagId : undefined}
        onClick={() => {
          if (guide.press()) onSave();
        }}
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
