import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { setTheme } from '../themes/registry';
import { ChristmasScene } from './ChristmasScene';
import ChristmasSceneView from './ChristmasScene.view';
import { BOKEH } from './christmasBokeh';
import { ChristmasSnow } from './ChristmasSnow';
import ChristmasSnowView from './ChristmasSnow.view';
import { ChristmasWreath } from './ui/ChristmasWreath';

afterEach(() => {
  cleanup();
  setTheme('glass');
  delete document.documentElement.dataset.glitch;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Christmas theme pieces (SPO-393)', () => {
  it('render nothing in other themes', () => {
    setTheme('glass');
    const { container } = render(
      <>
        <ChristmasScene />
        <ChristmasSnow />
        <ChristmasWreath />
      </>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('the wreath is aria-hidden and only exists in the Christmas theme', () => {
    setTheme('christmas');
    const { container } = render(<ChristmasWreath />);
    expect(container.querySelector('.xw-wreath')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('.xw-bl')).toHaveLength(3);
    // the plus is drawn over the artwork so it reads on the dark centre; five sparkles replace the water-ring ripple
    expect(container.querySelectorAll('.xw-plus path')).toHaveLength(2);
    expect(container.querySelectorAll('.xw-sp')).toHaveLength(5);
  });

  it('the scene is lazy-mounted and aria-hidden in the Christmas theme', async () => {
    setTheme('christmas');
    const { findByTestId } = render(<ChristmasScene />);
    const scene = await findByTestId('christmas-scene');
    expect(scene.getAttribute('aria-hidden')).toBe('true');
  });

  it('the scene is golden bokeh: gold discs always, accent discs numbered for the per-app count rule', () => {
    const GOLD_COUNT = BOKEH.filter((b) => b.k === undefined).length;
    const ACCENT_TOTAL = BOKEH.length - GOLD_COUNT;
    const { container } = render(<ChristmasSceneView />);
    expect(GOLD_COUNT).toBeGreaterThan(20);
    expect(ACCENT_TOTAL).toBe(14);
    expect(container.querySelectorAll('.xb')).toHaveLength(GOLD_COUNT + ACCENT_TOTAL);
    expect(container.querySelectorAll('.xb[data-acc="0"]')).toHaveLength(GOLD_COUNT);
    const ks = [...container.querySelectorAll<HTMLElement>('.xb[data-acc="1"]')].map((e) =>
      Number(e.style.getPropertyValue('--k')),
    );
    expect(ks).toEqual(Array.from({ length: ACCENT_TOTAL }, (_, i) => i + 1));
    // seeded: the same picture on every start
    expect(BOKEH[0]).toEqual(BOKEH[0]);
  });

  it('the scene layout follows the width and the listener is removed on unmount', () => {
    let matches = false;
    const listeners = new Set<() => void>();
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return matches;
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }));
    const { container, unmount } = render(<ChristmasSceneView />);
    const wide = () => container.querySelector('.xc-scene')?.getAttribute('data-wide');
    expect(wide()).toBe('false');
    matches = true;
    act(() => listeners.forEach((fn) => fn()));
    expect(wide()).toBe('true');
    unmount();
    expect(listeners.size).toBe(0);
  });

  it('the scene pauses while the tab is hidden', () => {
    const { container } = render(<ChristmasSceneView />);
    const scene = container.querySelector<HTMLElement>('.xc-scene');
    expect(scene?.dataset.paused).toBe('false');
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(scene?.dataset.paused).toBe('true');
    hidden.mockRestore();
  });

  it('the snow canvas is mounted idle in the Christmas theme', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    setTheme('christmas');
    const { findByTestId } = render(<ChristmasSnow />);
    const cv = await findByTestId('christmas-snow');
    expect(cv.getAttribute('aria-hidden')).toBe('true');
    expect(cv.dataset.live).toBe('false');
  });
});

describe('snow canvas phases', () => {
  function stubCanvas() {
    const calls = { draws: 0, clears: 0 };
    const ctx = {
      setTransform: vi.fn(),
      clearRect: () => calls.clears++,
      fillRect: () => calls.draws++,
      drawImage: () => calls.draws++,
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillRect2: vi.fn(),
      createRadialGradient: () => ({ addColorStop: vi.fn() }),
      globalAlpha: 1,
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    return calls;
  }

  it('draws only while a switch runs, keeps blowing after `in`, and goes quiet when the flakes are gone', async () => {
    const calls = stubCanvas();
    let now = 0;
    const cbs: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => cbs.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const frame = () => {
      const cb = cbs.shift();
      now += 16;
      cb?.(now);
    };
    const { getByTestId } = render(<ChristmasSnowView />);
    const cv = getByTestId('christmas-snow') as HTMLCanvasElement;
    expect(cv.dataset.live).toBe('false');

    const root = document.documentElement;
    await act(async () => {
      root.dataset.glitch = 'out';
      await Promise.resolve();
    });
    expect(cv.dataset.live).toBe('true');
    for (let i = 0; i < 30; i++) frame();
    expect(calls.draws).toBeGreaterThan(0);

    await act(async () => {
      root.dataset.glitch = 'load';
      await Promise.resolve();
    });
    expect(cv.dataset.live).toBe('true');
    await act(async () => {
      root.dataset.glitch = 'in';
      await Promise.resolve();
    });
    await act(async () => {
      delete root.dataset.glitch;
      await Promise.resolve();
    });
    // the glitch attribute is gone but the snow is still blowing across the new app
    expect(cv.dataset.live).toBe('true');
    for (let i = 0; i < 400 && cv.dataset.live === 'true'; i++) frame();
    expect(cv.dataset.live).toBe('false');
  });
});
