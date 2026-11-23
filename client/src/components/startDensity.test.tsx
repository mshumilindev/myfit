import { useState } from 'react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { fitDensity, MAX_DENSITY, overflowsVertically, useDensityFit } from './startDensity';

/** jsdom has no layout: fake a drawer whose content height shrinks 100px per density level. */
function fakeSheet(client: number, fullContent: number, step = 100): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientHeight', { get: () => client, configurable: true });
  Object.defineProperty(el, 'scrollHeight', {
    get: () => fullContent - step * Number(el.dataset.fit ?? 0),
  });
  return el;
}

afterEach(cleanup);

describe('fitDensity', () => {
  it('keeps the full look (level 0) when everything fits', () => {
    const el = fakeSheet(800, 700);
    expect(fitDensity(el)).toBe(0);
    expect(el.dataset.fit).toBe('0');
  });

  it('tightens one level at a time, only as far as needed', () => {
    const el = fakeSheet(600, 800);
    expect(fitDensity(el)).toBe(2);
    expect(el.dataset.fit).toBe('2');
  });

  it('stops at the last level when even that overflows (the drawer then scrolls)', () => {
    const el = fakeSheet(300, 900);
    expect(fitDensity(el)).toBe(MAX_DENSITY);
  });

  it('starts over from the full look when the room grows', () => {
    const el = fakeSheet(600, 800);
    expect(fitDensity(el)).toBe(2);
    Object.defineProperty(el, 'clientHeight', { get: () => 900 });
    expect(fitDensity(el)).toBe(0);
  });

  it('tolerates a 1px rounding difference', () => {
    expect(overflowsVertically(fakeSheet(600, 601))).toBe(false);
    expect(overflowsVertically(fakeSheet(600, 602))).toBe(true);
  });
});

function Harness({ enabled, client, full }: { enabled: boolean; client: number; full: number }) {
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  useDensityFit(anchor, enabled);
  return (
    <div
      className="sheet"
      data-testid="sheet"
      ref={(el) => {
        if (el && !('__fake' in el)) {
          Object.defineProperty(el, '__fake', { value: true });
          Object.defineProperty(el, 'clientHeight', { get: () => client, configurable: true });
          Object.defineProperty(el, 'scrollHeight', {
            get: () => full - 100 * Number(el.dataset.fit ?? 0),
          });
        }
      }}
    >
      <div ref={setAnchor} />
    </div>
  );
}

describe('useDensityFit', () => {
  it('sets data-fit on the drawer from the measured overflow', () => {
    const { getByTestId } = render(<Harness enabled client={600} full={800} />);
    expect(getByTestId('sheet').dataset.fit).toBe('2');
  });

  it('leaves the markup alone when disabled (desktop side panel)', () => {
    const { getByTestId } = render(<Harness enabled={false} client={600} full={800} />);
    expect(getByTestId('sheet').dataset.fit).toBeUndefined();
  });

  it('removes the attribute on unmount of the effect', () => {
    const { getByTestId, rerender } = render(<Harness enabled client={600} full={800} />);
    const sheet = getByTestId('sheet');
    rerender(<Harness enabled={false} client={600} full={800} />);
    expect(sheet.dataset.fit).toBeUndefined();
  });

  it('re-measures from the full look after a window resize', async () => {
    const { getByTestId } = render(<Harness enabled client={600} full={800} />);
    const sheet = getByTestId('sheet');
    Object.defineProperty(sheet, 'clientHeight', { get: () => 900, configurable: true });
    window.dispatchEvent(new Event('resize'));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(sheet.dataset.fit).toBe('0');
  });
});
