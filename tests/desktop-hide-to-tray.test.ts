/**
 * Closing the desktop window hides it to the tray; in macOS full screen it must leave full screen first,
 * otherwise an empty black Space stays behind.
 */
import { describe, expect, it, vi } from 'vitest';
import { hideToTray, type HideableWindow } from '../desktop/src/hideWindow';

function fake(fullScreen: boolean) {
  let leave: (() => void) | undefined;
  const win = {
    isFullScreen: vi.fn(() => fullScreen),
    setFullScreen: vi.fn(),
    once: vi.fn((_e: 'leave-full-screen', cb: () => void) => {
      leave = cb;
    }),
    hide: vi.fn(),
  } satisfies HideableWindow;
  return { win, finishLeave: () => leave?.() };
}

describe('hideToTray', () => {
  it('hides immediately when the window is not full screen', () => {
    const { win } = fake(false);
    hideToTray(win);
    expect(win.hide).toHaveBeenCalledTimes(1);
    expect(win.setFullScreen).not.toHaveBeenCalled();
  });

  it('leaves full screen first and hides only after the transition ends', () => {
    const { win, finishLeave } = fake(true);
    hideToTray(win);
    expect(win.setFullScreen).toHaveBeenCalledWith(false);
    expect(win.hide).not.toHaveBeenCalled();
    finishLeave();
    expect(win.hide).toHaveBeenCalledTimes(1);
  });
});
