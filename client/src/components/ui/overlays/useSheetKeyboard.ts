import { useEffect, useState, type RefObject } from 'react';
import { isTextEditableElement } from './focus';

/** Phone keyboard mode of a sheet: expands over the visual viewport while a text field inside has focus. */
export function useMobileSheetKeyboardMode(sheetRef: RefObject<HTMLElement | null>): boolean {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const isPhone = () => !window.matchMedia || !window.matchMedia('(min-width: 720px)').matches;
    const focusedInsideSheet = () => {
      const active = document.activeElement;
      return !!sheetRef.current?.contains(active) && isTextEditableElement(active);
    };
    // While a finger / mouse button is down the layout must not move: tapping Save right
    // after typing blurs the field, the sheet collapses, the button slides away from under
    // the finger and the tap lands on nothing (the first Save tap was lost). The collapse
    // waits until the tap is over; pointerup fires before the click, so the click is kept.
    let pointerDown = false;
    const update = () => {
      const vv = window.visualViewport;
      const top = vv?.offsetTop ?? 0;
      const height = vv?.height ?? window.innerHeight;
      sheetRef.current?.style.setProperty('--sheet-keyboard-top', `${Math.max(0, top)}px`);
      sheetRef.current?.style.setProperty('--sheet-keyboard-height', `${Math.round(height)}px`);
      const next = isPhone() && focusedInsideSheet();
      if (!next && pointerDown) return;
      setExpanded(next);
    };
    // deferred updates must not outlive the sheet (they touch window / state after unmount)
    const timers = new Set<number>();
    const later = (ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        update();
      }, ms);
      timers.add(id);
    };
    const updateAfterFocusSettles = () => later(160);
    const onPointerDown = () => {
      pointerDown = true;
    };
    const onPointerEnd = () => {
      if (!pointerDown) return;
      pointerDown = false;
      later(0);
    };

    update();
    const frame = window.requestAnimationFrame(update);
    window.addEventListener('focusin', update);
    window.addEventListener('focusout', updateAfterFocusSettles);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerEnd, true);
    window.addEventListener('pointercancel', onPointerEnd, true);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
      window.cancelAnimationFrame(frame);
      window.removeEventListener('focusin', update);
      window.removeEventListener('focusout', updateAfterFocusSettles);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerEnd, true);
      window.removeEventListener('pointercancel', onPointerEnd, true);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [sheetRef]);

  return expanded;
}
