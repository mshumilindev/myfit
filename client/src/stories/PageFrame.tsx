import type { ReactNode } from 'react';

/** Full-height column like the app shell's main area, so `.screen` pages lay
 *  out (and scroll) exactly as in the app. */
export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="app-story-frame"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
      }}
    >
      {children}
    </div>
  );
}
