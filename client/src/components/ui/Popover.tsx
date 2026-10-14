import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { Portal } from './Overlays';
import {
  computePopoverPosition,
  type Placement,
  type PopoverAlign,
  type PopoverSide,
} from './popoverPosition';
import './Popover.css';

export interface PopoverProps {
  open: boolean;
  /** Esc, outside press (no scrim) or scrim press. */
  onClose: () => void;
  /** The element the popover points at; focus returns to it on close. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Preferred side; flips to the opposite one when it does not fit. */
  side?: PopoverSide;
  align?: PopoverAlign;
  /** Gap to the anchor in px (the arrow lives in it). Default 8. */
  offset?: number;
  /** Panel width in px; capped to the viewport. Omit to size to the content. */
  width?: number;
  /** Dim layer behind the panel that also swallows the outside press. `dim` darkens the page. */
  scrim?: boolean | 'dim';
  arrow?: boolean;
  /** Accessible name (or use `labelledBy`). */
  label?: string;
  labelledBy?: string;
  /** `dialog` (default) for panels with controls; `menu` for an item list. */
  role?: 'dialog' | 'menu' | 'listbox';
  /** Give focus back to the anchor on close. Default true. */
  returnFocus?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Anchored floating panel (kit `popover`, R-KIT-28): placed next to an anchor
 * element with collision handling (flip, clamp, height cap), an optional scrim
 * and arrow. Non-modal: Esc and an outside press close it, focus moves in and
 * returns to the anchor. Phone surfaces that should be a bottom sheet use
 * `Sheet` instead; callers pick by width (`useMinWidth`).
 */
function PopoverPanel({
  onClose,
  anchorRef,
  side = 'bottom',
  align = 'start',
  offset = 8,
  width,
  scrim = false,
  arrow = false,
  label,
  labelledBy,
  role = 'dialog',
  returnFocus = true,
  className,
  children,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Placement | null>(null);
  const gap = arrow ? Math.max(offset, 12) : offset;

  const measure = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    const body = bodyRef.current;
    if (!anchor || !panel || !body) return;
    const r = anchor.getBoundingClientRect();
    setPlace(
      computePopoverPosition({
        anchor: { left: r.left, top: r.top, width: r.width, height: r.height },
        panel: { width: panel.offsetWidth, height: body.scrollHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        side,
        align,
        offset: gap,
      }),
    );
  }, [anchorRef, side, align, gap]);

  useLayoutEffect(() => {
    measure();
    // The anchor can attach in the same commit (a story opens the panel at mount): until it is there
    // the panel stays hidden, so measure again on the next frames instead of waiting for a resize.
    let raf = 0;
    let tries = 0;
    const retry = () => {
      if (anchorRef.current || tries++ > 10) {
        measure();
        return;
      }
      raf = window.requestAnimationFrame(retry);
    };
    if (!anchorRef.current) raf = window.requestAnimationFrame(retry);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (ro && bodyRef.current) ro.observe(bodyRef.current);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      ro?.disconnect();
    };
  }, [measure, anchorRef]);

  // Focus in on open, back to the anchor on close.
  useEffect(() => {
    const anchor = anchorRef.current;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      if (returnFocus && anchor && document.body.contains(anchor)) {
        // The anchor may be a wrapper around the real trigger.
        const target = anchor.matches('button, a[href], input, select, textarea, [tabindex]')
          ? anchor
          : (anchor.querySelector<HTMLElement>('button, a[href], input, [tabindex]') ?? anchor);
        target.focus({ preventScroll: true });
      }
    };
  }, [anchorRef, returnFocus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const onPress = (e: PointerEvent) => {
      if (scrim) return; // the scrim handles it
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPress, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPress, true);
    };
  }, [onClose, scrim, anchorRef]);

  const style: CSSProperties = {
    left: place?.left ?? 0,
    top: place?.top ?? 0,
    width: width != null ? Math.min(width, window.innerWidth - 16) : undefined,
    visibility: place ? 'visible' : 'hidden',
    ['--pop-arrow' as string]: `${place?.arrow ?? 0}px`,
  };
  const cls = ['uipop', `uipop--${place?.side ?? side}`, arrow ? 'uipop--arrow' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <Portal>
      {scrim && (
        <div
          className={`uipop-scrim${scrim === 'dim' ? ' uipop-scrim--dim' : ''}`}
          onClick={onClose}
          aria-hidden
          data-testid="popover-scrim"
        />
      )}
      <div
        ref={panelRef}
        className={cls}
        style={style}
        role={role}
        aria-label={label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        <div ref={bodyRef} className="uipop-body" style={{ maxHeight: place?.maxHeight }}>
          {children}
        </div>
      </div>
    </Portal>
  );
}

/** Renders nothing while closed; the panel (and its measured position) exists only while open. */
export function Popover(props: PopoverProps) {
  return props.open ? <PopoverPanel {...props} /> : null;
}
