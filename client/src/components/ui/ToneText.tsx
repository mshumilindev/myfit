import type { ReactNode } from 'react';
import { toneClass, type Tone } from './tones';

/** Inline text in a colour family's base colour ("Unwell · day 3"). */
export function ToneText({
  tone,
  strong = false,
  children,
}: {
  tone: Tone;
  strong?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={toneClass(tone)}
      style={{ color: 'var(--t-base)', fontWeight: strong ? 600 : undefined }}
    >
      {children}
    </span>
  );
}
