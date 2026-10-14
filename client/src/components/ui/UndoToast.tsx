import type { CSSProperties } from 'react';
import { Snackbar } from './Snackbar';
import type { Tone } from './tones';
import './UndoToast.css';

export interface UndoToastProps {
  text: string;
  icon?: string;
  /** Icon colour. `danger` (the default) is right for a removal; a confirmation such as "Shared with Maria" is `ok`. */
  tone?: Tone;
  undoLabel: string;
  /** Spoken: "Undo is available for 8 seconds". */
  countdownLabel: string;
  /** The window; the bar shrinks over exactly this long (the bar IS the timer, no digits). */
  durationMs?: number;
  onUndo: () => void;
  /** `inline` stays in flow (docked above a composer); `fixed` floats bottom-left (bottom-right-safe on phone). */
  position?: 'inline' | 'fixed';
  /** Stories / tests: freeze the bar at this many ms left. */
  frozenLeftMs?: number;
}

/**
 * "Message deleted . Undo" with a visible countdown bar (kit group `Coach/Undo toast`). Presentational: the
 * caller owns the timer and the commit (the store waits `durationMs`, then erases for real). Built on the kit
 * `Snackbar`; one toast at a time (G9).
 */
export function UndoToast({
  text,
  icon = 'trash',
  tone = 'danger',
  undoLabel,
  countdownLabel,
  durationMs = 8000,
  onUndo,
  position = 'inline',
  frozenLeftMs,
}: UndoToastProps) {
  const delay = frozenLeftMs != null ? -(durationMs - frozenLeftMs) / 1000 : 0;
  return (
    <div
      className={`uiundo uiundo--${position}`}
      style={
        {
          '--undo-ms': `${durationMs}ms`,
          '--undo-delay': `${delay}s`,
        } as CSSProperties
      }
    >
      <Snackbar
        position="inline"
        tone={tone}
        icon={icon}
        text={text}
        sub={<span className="visually-hidden">{countdownLabel}</span>}
        action={{ label: undoLabel, onClick: onUndo }}
      />
      <i
        className={`uiundo-bar${frozenLeftMs != null ? ' is-frozen' : ''}`}
        aria-hidden
        data-testid="undo-bar"
      />
    </div>
  );
}
