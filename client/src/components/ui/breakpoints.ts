import { useSyncExternalStore } from 'react';

/**
 * Phone / desktop swap widths.
 *
 * The real app (Gym, People, Apex… rails and tab bars, ~50 `@media (min-width:
 * 720px)` blocks in styles.css, App.tsx and learn/App.tsx) swaps at 720 and
 * stays there. The Coach shell swaps at 768 (R-KIT-31): it opts in per
 * component with `breakpoint="coach"` on `Rail` / `TabBar`, which only hides
 * the rail / shows the tab bar in the 720–767 band. CSS cannot read this
 * constant (no custom media without a build plugin), so the literal 768 in
 * Rail.css / TabBar.css is pinned to it by `breakpoints.test.ts`.
 */
export const APP_BREAKPOINT = 720;
export const COACH_BREAKPOINT = 768;
/** Coach: labelled 88px rail and the chat dock start here; below it the rail is icons only. */
export const COACH_WIDE_BREAKPOINT = 1280;

/** `(min-width: Npx)` media query string. */
export const minWidthQuery = (px: number): string => `(min-width: ${px}px)`;

/** Live `matchMedia(min-width)` for JS-side layout choices (no hidden focusable content). */
export function useMinWidth(px: number): boolean {
  const query = minWidthQuery(px);
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches,
    () => false,
  );
}
