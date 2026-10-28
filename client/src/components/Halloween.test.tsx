import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { setTheme } from '../themes/registry';
import { offSeason } from '../themes/testClock';
import { HalloweenScene } from './HalloweenScene';
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
});
