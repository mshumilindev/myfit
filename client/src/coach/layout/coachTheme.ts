import { useEffect } from 'react';

/**
 * Coach overlays (the share picker, the detail panels) are portaled to <body>, outside any app wrapper, so they read
 * the app identity from the document root. In the trainer app the root already carries `theme-coach`; a Coach overlay
 * opened from the client's own app (brass) puts it on for as long as the overlay is open, so it wears the tourmaline
 * plate and selected states instead of the brass of the page under it. Nothing is removed that this hook did not add.
 */
export function useCoachOverlayTheme(active = true): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const el = document.documentElement;
    if (el.classList.contains('theme-coach')) return;
    el.classList.add('theme-coach');
    return () => el.classList.remove('theme-coach');
  }, [active]);
}
