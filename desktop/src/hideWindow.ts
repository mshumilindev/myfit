/**
 * Closing the window hides it to the tray. Hiding a window that is in macOS native full screen leaves its empty black
 * Space behind (the user sees a black screen and the app seems not to close), so leave full screen first and hide once
 * the transition has finished. Kept free of the `electron` import so it can be unit-tested.
 */
export interface HideableWindow {
  isFullScreen(): boolean;
  setFullScreen(flag: boolean): void;
  once(event: 'leave-full-screen', listener: () => void): unknown;
  hide(): void;
}

export function hideToTray(win: HideableWindow): void {
  if (win.isFullScreen()) {
    win.once('leave-full-screen', () => win.hide());
    win.setFullScreen(false);
    return;
  }
  win.hide();
}

/**
 * What the window's close button does. On macOS closing the window quits the app: hiding it to the menu bar left a
 * black screen / a zombie process the owner could not get rid of (SPO-277). Windows and Linux keep the tray: there the
 * tray icon is the only way to bring the app back and to receive notifications while the window is closed.
 */
export function closeBehavior(platform: string): 'quit' | 'hide' {
  return platform === 'darwin' ? 'quit' : 'hide';
}
