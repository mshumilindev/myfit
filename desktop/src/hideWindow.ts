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
