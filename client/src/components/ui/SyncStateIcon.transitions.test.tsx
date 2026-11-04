import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { SyncStateIcon } from './SyncStateIcon';
import {
  DURATION_MS,
  SHAPES,
  SYNC_ICON_STATES,
  pieces,
  type SyncIconState,
} from './syncStateShapes';

/** SPO-377: every ordered pair of states, with and without reduced motion. */
const target = (s: SyncIconState) => pieces(SHAPES[s]).map((p) => p.d);
const drawn = (c: HTMLElement) =>
  [...c.querySelectorAll('svg path')].map((p) => p.getAttribute('d') ?? '');

const PAIRS = SYNC_ICON_STATES.flatMap((a) =>
  SYNC_ICON_STATES.filter((b) => b !== a).map((b) => [a, b] as const),
);

let frames: FrameRequestCallback[] = [];
let ids = 0;
const raf = vi.fn((cb: FrameRequestCallback) => {
  frames.push(cb);
  return ++ids;
});
const caf = vi.fn();

function reduced(on: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: on && q.includes('reduce'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}
/** Run queued frames at the given clock until none are left (bounded). */
function run(at: number, max = 400) {
  for (let n = 0; n < max && frames.length; n++) {
    const f = frames;
    frames = [];
    for (const cb of f) cb(at);
  }
}

beforeEach(() => {
  frames = [];
  ids = 0;
  raf.mockClear();
  caf.mockClear();
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', caf);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SyncStateIcon transitions', () => {
  it('covers all 56 ordered pairs of the 8 states', () => {
    expect(SYNC_ICON_STATES).toHaveLength(8);
    expect(PAIRS).toHaveLength(56);
  });

  it('the first render draws the shape of its own state', () => {
    for (const s of SYNC_ICON_STATES) {
      const { container, unmount } = render(<SyncStateIcon state={s} label={s} />);
      expect(drawn(container)).toEqual(target(s));
      unmount();
    }
  });

  describe('reduced motion: jumps to the final shape, never animates', () => {
    it.each(PAIRS)('%s -> %s', (a, b) => {
      reduced(true);
      const { container, rerender } = render(<SyncStateIcon state={a} label="x" />);
      rerender(<SyncStateIcon state={b} label="x" />);
      expect(container.querySelector('[data-state]')?.getAttribute('data-state')).toBe(b);
      expect(drawn(container)).toEqual(target(b));
      expect(raf).not.toHaveBeenCalled();
      expect(container.querySelector('svg g')?.getAttribute('transform') ?? '').toBe('');
    });

    it('a spinning syncing icon is upright at once when leaving syncing', () => {
      reduced(true);
      const { container, rerender } = render(<SyncStateIcon state="syncing" label="x" />);
      rerender(<SyncStateIcon state="synced" label="x" />);
      expect(container.querySelector('svg g')?.getAttribute('transform') ?? '').toBe('');
      expect(raf).not.toHaveBeenCalled();
    });
  });

  describe('normal motion: turns into the next shape and settles on it', () => {
    it.each(PAIRS)('%s -> %s', (a, b) => {
      reduced(false);
      const { container, rerender } = render(<SyncStateIcon state={a} label="x" />);
      rerender(<SyncStateIcon state={b} label="x" />);
      expect(container.querySelector('[data-state]')?.getAttribute('data-state')).toBe(b);
      expect(raf).toHaveBeenCalled();
      // a frame well after the tween: the stroke is exactly the target
      act(() => run(performance.now() + DURATION_MS + 50, 3));
      expect(drawn(container)).toEqual(target(b));
    });

    it('mid-tween the stroke is neither the old nor the new shape', () => {
      reduced(false);
      const { container, rerender } = render(<SyncStateIcon state="synced" label="x" />);
      rerender(<SyncStateIcon state="failed" label="x" />);
      act(() => run(performance.now() + DURATION_MS / 2, 1));
      const mid = drawn(container);
      expect(mid).not.toEqual(target('synced'));
      expect(mid).not.toEqual(target('failed'));
    });

    it('the loop stops by itself once a calm target is reached', () => {
      reduced(false);
      const { rerender } = render(<SyncStateIcon state="synced" label="x" />);
      rerender(<SyncStateIcon state="offline" label="x" />);
      act(() => run(performance.now() + DURATION_MS + 50, 10));
      expect(frames).toHaveLength(0);
    });

    it('syncing keeps spinning (the loop never ends), and leaving it settles upright', () => {
      reduced(false);
      const { container, rerender } = render(<SyncStateIcon state="saving" label="x" />);
      rerender(<SyncStateIcon state="syncing" label="x" />);
      let t = performance.now() + DURATION_MS + 50;
      for (let k = 0; k < 5; k++) act(() => run((t += 16), 1));
      expect(frames).toHaveLength(1);
      expect(container.querySelector('svg g')?.getAttribute('transform')).toContain('rotate(');
      rerender(<SyncStateIcon state="synced" label="x" />);
      for (let k = 0; k < 400 && frames.length; k++) act(() => run((t += 16), 1));
      expect(frames).toHaveLength(0);
      expect(container.querySelector('svg g')?.getAttribute('transform') ?? '').toBe('');
      expect(drawn(container)).toEqual(target('synced'));
    });

    it('failed shakes first and then stands still', () => {
      reduced(false);
      const { container, rerender } = render(<SyncStateIcon state="synced" label="x" />);
      rerender(<SyncStateIcon state="failed" label="x" />);
      const t0 = performance.now();
      act(() => run(t0 + 30, 1));
      expect(container.querySelector('svg g')?.getAttribute('transform') ?? '').toContain(
        'translate(',
      );
      act(() => run(t0 + DURATION_MS + 100, 5));
      expect(frames).toHaveLength(0);
      expect(container.querySelector('svg g')?.getAttribute('transform') ?? '').toBe('');
    });

    it('an unchanged state does not start any animation', () => {
      reduced(false);
      const { rerender } = render(<SyncStateIcon state="offline" label="x" />);
      rerender(<SyncStateIcon state="offline" label="y" count={2} />);
      expect(raf).not.toHaveBeenCalled();
    });
  });

  describe('off screen: no loop while nobody can see it', () => {
    it('a hidden document does not request frames and cancels the pending one', () => {
      reduced(false);
      const { rerender } = render(<SyncStateIcon state="synced" label="x" />);
      rerender(<SyncStateIcon state="syncing" label="x" />);
      expect(frames).toHaveLength(1);
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      try {
        act(() => {
          document.dispatchEvent(new Event('visibilitychange'));
        });
        expect(caf).toHaveBeenCalled();
        const before = raf.mock.calls.length;
        act(() => run(performance.now() + 100, 3));
        expect(raf.mock.calls.length).toBe(before);
      } finally {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      }
    });

    it('becoming visible again resumes a spinning icon', () => {
      reduced(false);
      const { rerender } = render(<SyncStateIcon state="synced" label="x" />);
      rerender(<SyncStateIcon state="syncing" label="x" />);
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      const before = raf.mock.calls.length;
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(raf.mock.calls.length).toBeGreaterThan(before);
    });

    it('IntersectionObserver: out of view stops the loop, in view restarts it', () => {
      reduced(false);
      let cb: IntersectionObserverCallback = () => undefined;
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(c: IntersectionObserverCallback) {
            cb = c;
          }
          observe() {}
          disconnect() {}
        },
      );
      const { rerender } = render(<SyncStateIcon state="synced" label="x" />);
      rerender(<SyncStateIcon state="syncing" label="x" />);
      act(() =>
        cb([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver),
      );
      act(() => run(performance.now() + 100, 1));
      expect(frames).toHaveLength(0);
      act(() =>
        cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver),
      );
      expect(frames).toHaveLength(1);
    });

    it('unmount cancels the pending frame', () => {
      reduced(false);
      const { rerender, unmount } = render(<SyncStateIcon state="synced" label="x" />);
      rerender(<SyncStateIcon state="syncing" label="x" />);
      unmount();
      expect(caf).toHaveBeenCalled();
    });
  });
});
