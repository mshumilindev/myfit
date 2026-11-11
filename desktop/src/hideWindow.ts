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
 * What the window's close button does. The app keeps running only where something can bring it back: the tray icon (Windows,
 * Linux) or the menu bar icon (macOS, since SPO-552: Spotter lives there, so a reminder can still ring). With no icon showing,
 * closing quits: on macOS hiding without an icon left a black screen / a zombie process the owner could not get rid of (SPO-277).
 */
export function closeBehavior(
  platform: string,
  trayShown = platform !== 'darwin',
): 'quit' | 'hide' {
  return trayShown ? 'hide' : 'quit';
}
