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

type Corners = [number, number, number, number]; // top-left, top-right, bottom-right, bottom-left

/**
 * The corner radii of what the person SEES for a field: its own, and the group's where the field touches the group's edge (a
 * row inside a `GroupedList` is square itself, the group clips it round), so the frame is cut exactly like the field.
 */
function visibleCorners(el: HTMLElement, b: DOMRect): Corners {
  const px = (cs: CSSStyleDeclaration, k: string) => parseFloat(cs.getPropertyValue(k)) || 0;
  const own = getComputedStyle(el);
  const r: Corners = [
    px(own, 'border-top-left-radius'),
    px(own, 'border-top-right-radius'),
    px(own, 'border-bottom-right-radius'),
    px(own, 'border-bottom-left-radius'),
  ];
  const host = el.parentElement?.closest<HTMLElement>('.uigl-rows');
  if (!host) return r;
  const hs = getComputedStyle(host);
  const hb = host.getBoundingClientRect();
  const near = (a: number, c: number) => Math.abs(a - c) <= 2;
  const top = near(b.top, hb.top);
  const bottom = near(b.bottom, hb.bottom);
  const left = near(b.left, hb.left);
  const right = near(b.right, hb.right);
  if (top && left) r[0] = Math.max(r[0], px(hs, 'border-top-left-radius'));
  if (top && right) r[1] = Math.max(r[1], px(hs, 'border-top-right-radius'));
  if (bottom && right) r[2] = Math.max(r[2], px(hs, 'border-bottom-right-radius'));
  if (bottom && left) r[3] = Math.max(r[3], px(hs, 'border-bottom-left-radius'));
  return r;
}

/**
 * The dashed frame and tint over the one field that is still missing (the element carrying `data-guide-hit`). It lives in a
 * portal and follows the field's rectangle (resize, scroll), so overflow, clip-paths and a theme's own pseudo-elements on the
 * field cannot cut or replace it. The corners are the field's visible ones, so a square theme gets a square frame.
 */
function GuideFrame() {
  const [box, setBox] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
    r: Corners;
  } | null>(null);
  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>('[data-guide-hit]');
    if (!el) return;
    const measure = () => {
      const b = el.getBoundingClientRect();
      setBox({ x: b.left, y: b.top, w: b.width, h: b.height, r: visibleCorners(el, b) });
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
  // The stroke sits 1px inside the edge (2px wide), so each radius shrinks by 1. The dash pattern (8 + 6) must divide the outline
  // exactly, or the loop shows a seam where it starts: pathLength is the outline rounded to a whole number of periods.
  const w = Math.max(0, box.w - 2);
  const h = Math.max(0, box.h - 2);
  const cap = Math.min(w, h) / 2;
  const [tl, tr, br, bl] = box.r.map((v) => Math.min(Math.max(0, v - 1), cap)) as Corners;
  const d = [
    `M ${1 + tl} 1`,
    `H ${1 + w - tr}`,
    `A ${tr} ${tr} 0 0 1 ${1 + w} ${1 + tr}`,
    `V ${1 + h - br}`,
    `A ${br} ${br} 0 0 1 ${1 + w - br} ${1 + h}`,
    `H ${1 + bl}`,
    `A ${bl} ${bl} 0 0 1 1 ${1 + h - bl}`,
    `V ${1 + tl}`,
    `A ${tl} ${tl} 0 0 1 ${1 + tl} 1`,
    'Z',
  ].join(' ');
  const perimeter = 2 * (w + h) - 2 * (tl + tr + br + bl) + (Math.PI / 2) * (tl + tr + br + bl);
  const period = 14;
  return (
    <div
      className="uisg-frame"
      aria-hidden
      style={{
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        borderRadius: box.r.map((v) => `${v}px`).join(' '),
      }}
    >
      <svg>
        <path d={d} pathLength={Math.max(1, Math.round(perimeter / period)) * period} />
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
