import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';

import { Button } from './Button';
import { Portal } from './overlays/Portal';
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
 * when everything is filled (Save is then enabled).
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

/**
 * The dashed frame and tint over the one field that is still missing (the element carrying `data-guide-hit`). It lives in a
 * portal and follows the field's rectangle (resize, scroll), so overflow, clip-paths and a theme's own pseudo-elements on the
 * field cannot cut or replace it. The radius is read from the field, so a square theme gets a square frame.
 */
function GuideFrame() {
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number; r: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>('[data-guide-hit]');
    if (!el) return;
    const measure = () => {
      const b = el.getBoundingClientRect();
      const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      setBox({ x: b.left, y: b.top, w: b.width, h: b.height, r });
    };
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, []);
  if (!box) return null;
  // The dash pattern (8 + 6) must divide the outline exactly, or the loop shows a seam where it starts: pathLength is the
  // outline rounded to a whole number of periods, so the dashes stretch a hair instead.
  const w2 = Math.max(0, box.w - 2);
  const h2 = Math.max(0, box.h - 2);
  const rr = Math.min(Math.max(0, box.r - 1), w2 / 2, h2 / 2);
  const perimeter = 2 * (w2 + h2) - 8 * rr + 2 * Math.PI * rr;
  const period = 14;
  return (
    <div
      className="uisg-frame"
      aria-hidden
      style={{ left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: box.r }}
    >
      <svg>
        <rect
          x={1}
          y={1}
          width={w2}
          height={h2}
          rx={rr}
          pathLength={Math.max(1, Math.round(perimeter / period)) * period}
        />
      </svg>
    </div>
  );
}

export function SaveGuide({ guide, label, heading, onSave, className, ...rest }: SaveGuideProps) {
  const flagId = useId();
  const { missing, ready, active } = guide;
  return (
    <div className="uisg">
      {active && guide.firstId && (
        <Portal>
          <GuideFrame key={guide.firstId} />
        </Portal>
      )}
      {active && (
        <div className="uisg-flag uit--guide" role="status" id={flagId}>
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
      </Button>
    </div>
  );
}
