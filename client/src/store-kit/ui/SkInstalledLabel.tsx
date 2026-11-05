import type { ReactNode } from 'react';
import { SkIcon } from './SkIcon';
import '../tokens-a.css';
import './SkInstalledLabel.css';

/** "Installed" is a status, not a button: check icon + text, not interactive. */
export function SkInstalledLabel({ children }: { children: ReactNode }) {
  return (
    <span className="sk-inst-lbl" role="status">
      <SkIcon name="check" small />
      {children}
    </span>
  );
}
