import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { ThemeFrame } from './ThemeFrame';

// SPO-586: the loader is replaced so a test can hold a look's bundle "in flight" (the real one marks every look ready in tests)
const loadThemeCss = vi.hoisted(() => vi.fn<(id: string) => Promise<void>>());
vi.mock('../themes/lazy', () => ({ loadThemeCss }));

afterEach(() => {
  cleanup();
  loadThemeCss.mockReset();
  loadThemeCss.mockResolvedValue();
  document.head.querySelectorAll('style[data-test-bundle]').forEach((n) => n.remove());
  delete document.documentElement.dataset.glitch;
  document.documentElement.removeAttribute('data-density');
});

describe('ThemeFrame', () => {
  loadThemeCss.mockResolvedValue();
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

  const mountFrame = (themeId: string) => {
    const { container } = render(
      <ThemeFrame themeId={themeId} title={themeId}>
        <p data-testid="card">x</p>
      </ThemeFrame>,
    );
    const frame = container.querySelector('iframe') as HTMLIFrameElement;
    act(() => {
      frame.dispatchEvent(new Event('load'));
    });
    return frame;
  };
  /** the look's bundle puts its CSS on the page, as the real one does once it is fetched */
  const addBundleStyle = () => {
    const el = document.createElement('style');
    el.setAttribute('data-test-bundle', '');
    el.textContent = 'html[data-theme="cyberpunk"] .x{color:red}';
    document.head.appendChild(el);
  };

  it("asks for the look's bundle and copies the page styles only once it is in (SPO-586)", async () => {
    let done!: () => void;
    loadThemeCss.mockReturnValue(
      new Promise<void>((res) => {
        done = () => {
          addBundleStyle();
          res();
        };
      }),
    );
    const frame = mountFrame('cyberpunk');
    expect(loadThemeCss).toHaveBeenCalledWith('cyberpunk');
    // bundle still in flight: nothing is copied and the card is not drawn unstyled
    expect(frame.contentDocument?.querySelector('style[data-test-bundle]')).toBeNull();
    expect(frame.contentDocument?.querySelector('[data-testid="card"]')).toBeNull();
    await act(async () => {
      done();
    });
    expect(frame.contentDocument?.querySelector('style[data-test-bundle]')).not.toBeNull();
    expect(frame.contentDocument?.querySelector('[data-testid="card"]')).not.toBeNull();
  });

  it('still draws the card with what the page has when the bundle cannot be fetched', async () => {
    loadThemeCss.mockRejectedValue(new Error('offline'));
    addBundleStyle();
    const frame = mountFrame('cyberpunk');
    await act(async () => {
      await Promise.resolve();
    });
    expect(frame.contentDocument?.querySelector('[data-testid="card"]')).not.toBeNull();
  });

  it('does not touch a frame that was torn down while the bundle was on its way', async () => {
    let done!: () => void;
    loadThemeCss.mockReturnValue(new Promise<void>((res) => (done = res)));
    const { container, unmount } = render(
      <ThemeFrame themeId="glass" title="glass">
        <p>x</p>
      </ThemeFrame>,
    );
    const frame = container.querySelector('iframe') as HTMLIFrameElement;
    act(() => {
      frame.dispatchEvent(new Event('load'));
    });
    unmount();
    await expect(
      act(async () => {
        done();
      }),
    ).resolves.not.toThrow();
  });
});
