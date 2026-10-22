import { useEffect, type RefObject } from 'react';

const TABBABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function tabbables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getAttribute('aria-hidden') !== 'true',
  );
}

/**
 * Where Tab / Shift+Tab goes inside a blocking sheet: a cycle (last -> first, first -> last). Returns the element to
 * focus, or null to let the browser move focus normally. Pure, so it is unit-tested without a keyboard.
 */
function trapTarget(
  items: readonly HTMLElement[],
  active: Element | null,
  sheet: HTMLElement,
  shift: boolean,
): HTMLElement | null {
  if (items.length === 0) return sheet;
  const first = items[0];
  const last = items[items.length - 1];
  const inside = active ? sheet.contains(active) : false;
  if (!inside) return shift ? last : first;
  if (active === sheet) return shift ? last : first;
  if (shift && active === first) return last;
  if (!shift && active === last) return first;
  return null;
}

interface TrapEntry {
  sheet: HTMLElement;
  layer: Element;
}
/** Blocking sheets that are mounted now, oldest first. Only the TOP one handles Tab (two at once must not fight). */
const stack: TrapEntry[] = [];
/** How many blocking sheets made an element inert: it is released only when the last of them goes away. */
const inertCount = new Map<Element, number>();

function makeInert(el: Element): boolean {
  const n = inertCount.get(el);
  if (n === undefined && el.hasAttribute('inert')) return false; // inert for another reason: not ours to release
  inertCount.set(el, (n ?? 0) + 1);
  el.setAttribute('inert', '');
  return true;
}
function releaseInert(el: Element): void {
  const n = (inertCount.get(el) ?? 1) - 1;
  if (n > 0) {
    inertCount.set(el, n);
    return;
  }
  inertCount.delete(el);
  el.removeAttribute('inert');
}

/**
 * A blocking (non-dismissible) sheet keeps keyboard focus inside itself while it is mounted:
 *  - Tab / Shift+Tab cycle through the sheet's own controls;
 *  - everything that was in the page when it opened (the app root, other portals, a blocking sheet under it) is made
 *    `inert`, so neither the keyboard nor a screen reader can reach what the person must not use yet. Layers mounted
 *    LATER (a confirm dialog or a sheet opened from it) are not touched and stay usable. Restored exactly on unmount;
 *    inert is ref-counted, so closing the lower of two blocking sheets leaves the page inert for the one still open.
 *  - with several blocking sheets only the top one acts on Tab.
 * Focus inside a LATER layer (a dialog scrim, or any other portal layer / `aria-modal` outside this sheet) owns Tab.
 */
export function useBlockingSheetTrap(
  sheetRef: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const layer = sheet.closest('.portal-layer') ?? sheet;
    const entry: TrapEntry = { sheet, layer };
    stack.push(entry);
    const made: Element[] = [];
    for (const el of Array.from(document.body.children)) {
      if (el === layer || el.contains(layer)) continue;
      if (el.querySelector('[data-over-trap]')) continue; // a consent prompt above the gate stays usable
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
      if (makeInert(el)) made.push(el);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.defaultPrevented) return;
      if (stack[stack.length - 1] !== entry) return; // a newer blocking sheet owns Tab
      if (document.querySelector('.dialog-scrim')) return;
      const active = document.activeElement;
      // Focus is in a layer mounted after this sheet (e.g. a Sheet rendered by a confirm dialog on a phone): it owns Tab.
      if (active && !layer.contains(active) && active.closest('.portal-layer, [aria-modal="true"]'))
        return;
      const next = trapTarget(tabbables(sheet), active, sheet, e.shiftKey);
      if (!next) return;
      e.preventDefault();
      next.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      for (const el of made) releaseInert(el);
    };
  }, [sheetRef, active]);
}
