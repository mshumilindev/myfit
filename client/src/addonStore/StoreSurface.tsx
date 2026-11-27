import type { ReactNode } from 'react';

/**
 * The store's own surface inside the app (banner, entry row, set-options nudge): its colours follow the app's
 * light / dark mode, so the store kit reads right on the app's page. One place for that rule.
 */
export function StoreSurface({ className, children }: { className?: string; children: ReactNode }) {
  const root = typeof document === 'undefined' ? null : document.documentElement;
  const dark = root ? root.dataset.mode !== 'light' || root.dataset.sleep === 'night' : true;
  return (
    <div className={`sk-root ${dark ? 'sk-dark' : 'sk-light'}${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}
