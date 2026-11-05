import type { ReactNode } from 'react';
import { Sheet } from '../ui';
import type { Tone } from './ui/tones';

/** The Start content as a sheet (mobile) or a standing side panel (desktop). */
export function StartFrame(props: {
  inline: boolean;
  closeRequested?: boolean;
  tone?: Tone;
  onClose: () => void;
  sub: ReactNode;
  children: ReactNode;
}) {
  if (!props.inline)
    return (
      <Sheet
        onClose={props.onClose}
        className="start-sheet"
        tone={props.tone}
        closeRequested={props.closeRequested}
      >
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
