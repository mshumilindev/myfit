import { useState } from 'react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fitDensity,
  MAX_STAGE,
  overflowsFullRoom,
  overflowsVertically,
  useDensityFit,
} from './startDensity';

/** jsdom has no layout: fake a drawer whose content shrinks 100px per stage, continuously by --ss-k inside it. */
const squeeze = (el: HTMLElement) =>
  Number(el.dataset.fit ?? 0) * 100 + Number(el.style.getPropertyValue('--ss-k') || 0) * 100;
function fakeSheet(client: number, fullContent: number): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientHeight', { get: () => client, configurable: true });
  Object.defineProperty(el, 'scrollHeight', { get: () => fullContent - squeeze(el) });
  return el;
}

afterEach(cleanup);

describe('fitDensity', () => {
  it('keeps the full look when everything fits', () => {
    const el = fakeSheet(800, 700);
    expect(fitDensity(el, overflowsVertically)).toEqual({ stage: 0, k: 0 });
    expect(el.dataset.fit).toBe('0');
  });

  it('squeezes continuously, only as far as needed', () => {
    const el = fakeSheet(600, 750); // needs 150px: stage 1, k = 0.5
    const f = fitDensity(el, overflowsVertically);
    expect(f.stage).toBe(1);
    expect(f.k).toBeGreaterThan(0.45);
    expect(f.k).toBeLessThan(0.55);
    expect(el.style.getPropertyValue('--ss-k')).toBe(f.k.toFixed(3));
  });

  it('stays inside stage 0 when a little squeeze is enough', () => {
    const f = fitDensity(fakeSheet(600, 640), overflowsVertically);
    expect(f.stage).toBe(0);
    expect(f.k).toBeGreaterThan(0);
    expect(f.k).toBeLessThan(0.5);
  });

  it('stops at the last stage when even that overflows (the drawer then scrolls)', () => {
    const el = fakeSheet(300, 900);
    expect(fitDensity(el, overflowsVertically)).toEqual({ stage: MAX_STAGE, k: 1 });
  });

  it('starts over from the full look when the room grows', () => {
    const el = fakeSheet(600, 800);
    expect(fitDensity(el, overflowsVertically).stage).toBe(1);
    Object.defineProperty(el, 'clientHeight', { get: () => 900 });
    expect(fitDensity(el, overflowsVertically)).toEqual({ stage: 0, k: 0 });
  });

  it('counts even a 1px scroll as overflow', () => {
    expect(overflowsVertically(fakeSheet(600, 600))).toBe(false);
    expect(overflowsVertically(fakeSheet(600, 601))).toBe(true);
  });

  it('measures against the full room and restores the class it lifted', () => {
    const el = fakeSheet(600, 700);
    Object.defineProperty(el, 'clientHeight', {
      get: () => (el.classList.contains('sheet-full') ? 800 : 600),
    });
    expect(overflowsFullRoom(el)).toBe(false);
    expect(el.classList.contains('sheet-full')).toBe(false);
    el.classList.add('sheet-full');
    expect(overflowsFullRoom(el)).toBe(false);
    expect(el.classList.contains('sheet-full')).toBe(true);
  });
});

function fakeLayout(el: HTMLElement, client: number, full: number) {
  if ('__fake' in el) return;
  Object.defineProperty(el, '__fake', { value: true });
  Object.defineProperty(el, 'clientHeight', { get: () => client, configurable: true });
  Object.defineProperty(el, 'scrollHeight', {
    get: () => full - squeeze(el),
    configurable: true,
  });
}

function Harness({
  enabled,
  client,
  full,
  onSettle,
}: {
  enabled: boolean;
  client: number;
  full: number;
  onSettle?: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  useDensityFit(anchor, enabled, onSettle);
  return (
    <div
      className="sheet"
      data-testid="sheet"
      ref={(el) => {
        if (el) fakeLayout(el, client, full);
      }}
    >
      <div ref={setAnchor} />
    </div>
  );
}

describe('useDensityFit', () => {
  it('sets data-fit and --ss-k on the drawer from the measured overflow', () => {
    const { getByTestId } = render(<Harness enabled client={600} full={800} />);
    const sheet = getByTestId('sheet');
    expect(sheet.dataset.fit).toBe('1');
    expect(Number(sheet.style.getPropertyValue('--ss-k'))).toBeGreaterThan(0.9);
  });

  it('tells the owner after a pass', () => {
    const onSettle = vi.fn();
    render(<Harness enabled client={600} full={800} onSettle={onSettle} />);
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it('leaves the markup alone when disabled (desktop side panel)', () => {
    const { getByTestId } = render(<Harness enabled={false} client={600} full={800} />);
    expect(getByTestId('sheet').dataset.fit).toBeUndefined();
  });

  it('removes the attributes when the hook turns off', () => {
    const { getByTestId, rerender } = render(<Harness enabled client={600} full={800} />);
    const sheet = getByTestId('sheet');
    rerender(<Harness enabled={false} client={600} full={800} />);
    expect(sheet.dataset.fit).toBeUndefined();
    expect(sheet.style.getPropertyValue('--ss-k')).toBe('');
  });

  it('re-measures from the full look after a window resize', async () => {
    const { getByTestId } = render(<Harness enabled client={600} full={800} />);
    const sheet = getByTestId('sheet');
    Object.defineProperty(sheet, 'clientHeight', { get: () => 900, configurable: true });
    window.dispatchEvent(new Event('resize'));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(sheet.dataset.fit).toBe('0');
    expect(Number(sheet.style.getPropertyValue('--ss-k'))).toBe(0);
  });
});

describe('useDensityFit · content watched by ResizeObserver', () => {
  it('re-measures when the content grows while the drawer keeps its height (font swap)', async () => {
    const callbacks: Array<() => void> = [];
    const observed: Element[] = [];
    class FakeRO {
      constructor(cb: () => void) {
        callbacks.push(cb);
      }
      observe(el: Element) {
        observed.push(el);
      }
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeRO);
    try {
      const { getByTestId } = render(<Harness enabled client={600} full={640} />);
      const sheet = getByTestId('sheet');
      expect(sheet.dataset.fit).toBe('0');
      expect(observed).toContain(sheet);
      expect(observed).toContain(sheet.firstElementChild);
      Object.defineProperty(sheet, 'scrollHeight', {
        get: () => 850 - squeeze(sheet),
        configurable: true,
      });
      callbacks.forEach((cb) => cb());
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      expect(sheet.dataset.fit).toBe('2');
      // unchanged sizes: the observer callback does not schedule another pass
      const k = sheet.style.getPropertyValue('--ss-k');
      callbacks.forEach((cb) => cb());
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      expect(sheet.style.getPropertyValue('--ss-k')).toBe(k);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
