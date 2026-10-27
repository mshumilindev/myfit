import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { ThemeFrame } from './ThemeFrame';

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.glitch;
  document.documentElement.removeAttribute('data-density');
});

describe('ThemeFrame', () => {
  it('copies the look axes but NOT a transition in progress (it would keep the veil for good)', () => {
    document.documentElement.dataset.glitch = 'out';
    document.documentElement.setAttribute('data-density', 'regular');
    const { container } = render(
      <ThemeFrame themeId="cyberpunk" title="Cyberpunk">
        <p>x</p>
      </ThemeFrame>,
    );
    const frame = container.querySelector('iframe') as HTMLIFrameElement;
    act(() => {
      frame.dispatchEvent(new Event('load'));
    });
    const html = frame.contentDocument?.documentElement;
    expect(html?.getAttribute('data-theme')).toBe('cyberpunk');
    expect(html?.getAttribute('data-density')).toBe('regular');
    expect(html?.hasAttribute('data-glitch')).toBe(false);
  });
});
