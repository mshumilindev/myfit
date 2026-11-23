import { useState, type ReactNode } from 'react';
import { Sheet } from '../ui';
import type { Tone } from './ui/tones';
import { useDensityFit } from './startDensity';
import './StartSheetDensity.css';

/** The Start content as a sheet (mobile) or a standing side panel (desktop). */
export function StartFrame(props: {
  inline: boolean;
  closeRequested?: boolean;
  tone?: Tone;
  /** Accessible name of the drawer (it shows no title of its own). */
  label?: string;
  onClose: () => void;
  sub: ReactNode;
  children: ReactNode;
}) {
  // The drawer keeps the full look while everything fits and tightens only when it does not (SPO-561).
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // a squeeze change re-renders the kit sheet, so it can return to the compact height when the content got shorter
  const [, bump] = useState(0);
  useDensityFit(anchor, !props.inline, () => bump((n) => n + 1));
  if (!props.inline)
    return (
      <Sheet
        onClose={props.onClose}
        className="start-sheet"
        tone={props.tone}
        label={props.label}
        closeRequested={props.closeRequested}
      >
        <span hidden ref={setAnchor} />
        {props.children}
      </Sheet>
    );
  return (
    <>
      <div className="start-inline">{props.children}</div>
      {props.sub}
    </>
  );
}
