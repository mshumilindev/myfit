import type { ReactNode } from 'react';
import { SkIcon } from './SkIcon';
import '../tokens-a.css';
import './SkRel.css';

/** Relation line ("Works with Health"): link icon + muted caption. */
export function SkRel({ children }: { children: ReactNode }) {
  return (
    <span className="sk-rel">
      <SkIcon name="link" small />
      {children}
    </span>
  );
}
