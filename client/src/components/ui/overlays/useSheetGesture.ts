import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Drag-to-resize / dismiss of a bottom sheet: grow to full height, snap back, or slide away on a pull or flick.
 * `requestClose` plays the closing slide (240 ms) and then calls `onClose`.
 */
export function useSheetGesture(sheetRef: RefObject<HTMLElement | null>, onClose: () => void) {
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
      window.setTimeout(onClose, 240);
      return true;
    });
  }, [onClose]);

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

  return {
    mode,
    heightPx,
    liveH,
    drag,
    dragging,
    closing,
    requestClose,
    onGrabStart,
    onGrabMove,
    onGrabEnd,
  };
}
