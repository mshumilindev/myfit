import type { ComponentType } from 'react';
import type { IconProps } from '@phosphor-icons/react/dist/lib/types';

/**
 * The Add-ons glyph (a grid of squares with a plus), the same drawing the store uses for its Add-ons tab, so the
 * entry in More and in the rail reads as "add-ons" and not as the Apps squares (store-kit/icons.ts).
 */
export const AddonsGlyph: ComponentType<IconProps> = ({ size = '1em' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M6 4h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM15 4h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM6 13h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zM16.5 13v7M13 16.5h7" />
  </svg>
);
