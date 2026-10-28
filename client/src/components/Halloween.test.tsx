import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { setTheme } from '../themes/registry';
import { offSeason } from '../themes/testClock';
import { HalloweenScene } from './HalloweenScene';
import HalloweenSceneView from './HalloweenScene.view';
import { HALLOWEEN_SCENE_DESKTOP, HALLOWEEN_SCENE_PORTRAIT } from './halloweenScene.generated';
import { HalloweenBats } from './HalloweenBats';
import { HalloweenLantern } from './ui/HalloweenLantern';

offSeason();
afterEach(() => {
  cleanup();
  setTheme('glass');
  delete document.documentElement.dataset.glitch;
});

describe('Halloween theme pieces (SPO-378)', () => {
  it('render nothing in other themes', () => {
    setTheme('glass');
    const { container } = render(
      <>
        <HalloweenScene />
        <HalloweenBats />
        <HalloweenLantern />
      </>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('the lantern is aria-hidden and only exists in the Halloween theme', () => {
    setTheme('halloween');
    const { container } = render(<HalloweenLantern />);
    const el = container.querySelector('.hw-lantern');
    expect(el?.getAttribute('aria-hidden')).toBe('true');
  });

  it('the scene is lazy-mounted and aria-hidden in the Halloween theme', async () => {
    setTheme('halloween');
    const { findByTestId } = render(<HalloweenScene />);
    const scene = await findByTestId('halloween-scene');
    expect(scene.getAttribute('aria-hidden')).toBe('true');
  });

  it('the bat swarm is mounted ahead of time in the Halloween theme (CSS hides it until html[data-glitch] is set)', async () => {
    setTheme('halloween');
    const { findByTestId } = render(<HalloweenBats />);
    const bats = await findByTestId('halloween-bats');
    expect(bats.getAttribute('aria-hidden')).toBe('true');
  });

  it('the scene art follows the width (phone art below 720 px, desktop art above) and the listener is removed on unmount', () => {
    let matches = false;
    const listeners = new Set<() => void>();
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return matches;
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }));
    try {
      const { container, unmount } = render(<HalloweenSceneView />);
      const viewBox = (svg: string) => /viewBox="([^"]+)"/.exec(svg)?.[1];
      const art = () => container.querySelector('.hw-art svg')?.getAttribute('viewBox');
      expect(viewBox(HALLOWEEN_SCENE_PORTRAIT)).not.toBe(viewBox(HALLOWEEN_SCENE_DESKTOP));
      expect(art()).toBe(viewBox(HALLOWEEN_SCENE_PORTRAIT));
      matches = true;
      act(() => listeners.forEach((fn) => fn()));
      expect(art()).toBe(viewBox(HALLOWEEN_SCENE_DESKTOP));
      unmount();
      expect(listeners.size).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('the scene pauses while the tab is hidden', () => {
    const { container } = render(<HalloweenSceneView />);
    const scene = container.querySelector<HTMLElement>('.hw-scene');
    expect(scene?.dataset.paused).toBe('false');
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(scene?.dataset.paused).toBe('true');
    hidden.mockRestore();
  });
});
