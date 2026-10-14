import { act } from '@testing-library/react';
import { RAIL_GAP } from './railOverflow';

/**
 * Test helper for Rail `overflow`: jsdom has no layout, so the nav column's height
 * (`.rail-nav` clientHeight) is a number we set: `height` = the room nav + More + foot extras share
 * (the helper subtracts the visible extras, More is inside the column), and a stub ResizeObserver re-runs the rail's
 * measurement when it changes. Tile height / gap fall back to the rail's constants
 * (labelled 64, compact 44, default 46; gap 5.6).
 */
let height = 0;
const observers = new Set<{ cb: () => void }>();
let restore: (() => void) | null = null;

export function installRailMeasure(initial: number): void {
  height = initial;
  const proto = HTMLElement.prototype;
  const prev = Object.getOwnPropertyDescriptor(proto, 'clientHeight');
  Object.defineProperty(proto, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      if (!this.classList.contains('rail-nav')) return 0;
      // Like the real layout: every visible foot extra takes room from the nav column
      // (`height` is the room nav + More + extras compete for; More sits inside the column).
      const doc = this.ownerDocument;
      const mode = doc.querySelector('.rail--labelled')
        ? 'labelled'
        : doc.querySelector('.rail--compact')
          ? 'compact'
          : 'default';
      const extraTile = { labelled: 44, compact: 44, default: 46 }[mode];
      const extras = doc.querySelectorAll('.rail-extra').length;
      return height - extras * (extraTile + RAIL_GAP);
    },
  });
  const prevRO = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    private entry: { cb: () => void };
    constructor(cb: () => void) {
      this.entry = { cb };
    }
    observe() {
      observers.add(this.entry);
    }
    unobserve() {}
    disconnect() {
      observers.delete(this.entry);
    }
  };
  restore = () => {
    if (prev) Object.defineProperty(proto, 'clientHeight', prev);
    else delete (proto as { clientHeight?: unknown }).clientHeight;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = prevRO;
    observers.clear();
    restore = null;
  };
}

export function setRailHeight(h: number): void {
  height = h;
  act(() => observers.forEach((o) => o.cb()));
}

export function uninstallRailMeasure(): void {
  restore?.();
}
