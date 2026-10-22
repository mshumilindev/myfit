/**
 * Shared helpers for the view behaviour tests (`<View>.cases.test.tsx`): a controllable IntersectionObserver, a spying
 * Shell, store seeding and a fixed clock. Synthetic data only; mock only boundaries (firebase / api) in the test file.
 */
import { vi } from 'vitest';
import { __getStateForTests, __replaceStateForTests, type StoreState } from '../../store';

import { NOW } from '../../today/__fixtures__/widgetHarness';

export * from '../../today/__fixtures__/widgetHarness';

/** A pristine copy of the store as the run found it; reseed between tests. */
export const PRISTINE: StoreState = __getStateForTests();

export function reseed(over: Partial<StoreState> = {}): StoreState {
  const next = { ...PRISTINE, ...over } as StoreState;
  __replaceStateForTests(next);
  return next;
}

export function freezeClock(at: number = NOW): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at);
}

type IOCallback = (entries: Array<Partial<IntersectionObserverEntry>>) => void;
const observers = new Set<{ cb: IOCallback; els: Set<Element> }>();

/** Install a fake IntersectionObserver; `intersect(el)` reports `el` as visible to every observer watching it. */
export function installIntersectionObserver(): { intersect: (el: Element, on?: boolean) => void } {
  class FakeIO {
    private rec: { cb: IOCallback; els: Set<Element> };
    constructor(cb: IOCallback) {
      this.rec = { cb, els: new Set() };
      observers.add(this.rec);
    }
    observe(el: Element) {
      this.rec.els.add(el);
    }
    unobserve(el: Element) {
      this.rec.els.delete(el);
    }
    disconnect() {
      observers.delete(this.rec);
    }
    takeRecords() {
      return [];
    }
  }
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIO;
  return {
    intersect(el, on = true) {
      for (const o of [...observers])
        if (o.els.has(el)) o.cb([{ target: el, isIntersecting: on } as IntersectionObserverEntry]);
    },
  };
}

/** Pin `matchMedia`: queries containing `min-width` match when `desktop` is true. */
export function setDesktop(on: boolean): void {
  window.matchMedia = ((q: string) => ({
    matches: on && q.includes('min-width'),
    media: q,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
