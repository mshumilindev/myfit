import type { ReactNode } from 'react';
import { Chip } from './Chip';
import { SetRow } from './SetRow';
import './SessionExercise.css';

export interface SessionExerciseProps {
  name: string;
  /** "Shoulders, Triceps" */
  muscles?: string;
  /** The target strip text ("3 × 6 · 60 kg · RPE 8 · rest 2:30"). Absent = a bare exercise: nothing is prescribed. */
  target?: string;
  /** Said under the name when there is no target ("No target for this exercise"). */
  noTarget?: string;
  setLabel: string;
  kgPlaceholder: string;
  repsPlaceholder: string;
  /**
   * Preview (the trainer's "what the client sees"): the same markup, nothing focusable, nothing logged. The live session
   * (SessionView) keeps its own input rows until the client app adopts this card (M7).
   */
  preview?: boolean;
  caption?: ReactNode;
}

/**
 * The first set of an exercise in the client's live session, with the trainer's target above it (kit group
 * `Coach/Session exercise`). Built from the kit SetRow and Chip, so the preview in the editor is the real thing.
 */
export function SessionExercise({
  name,
  muscles,
  target,
  noTarget,
  setLabel,
  kgPlaceholder,
  repsPlaceholder,
  preview,
  caption,
}: SessionExerciseProps) {
  return (
    <div className="uisx" data-readonly={preview || undefined}>
      <div className="uisx-h">
        <b className="uisx-n">{name}</b>
        {muscles && <small className="uisx-m">{muscles}</small>}
      </div>
      {target ? (
        <Chip tone="accent" icon="target" size="xs" className="uisx-target">
          {target}
        </Chip>
      ) : (
        noTarget && <span className="uisx-none">{noTarget}</span>
      )}
      <SetRow
        tabIndex={preview ? -1 : undefined}
        aria-hidden={preview || undefined}
        disabled={preview}
        className="uisx-set"
      >
        <span className="idx">{setLabel}</span>
        <span className="val uisx-in">{kgPlaceholder}</span>
        <span className="val uisx-in">{repsPlaceholder}</span>
      </SetRow>
      {caption != null && <p className="uisx-cap">{caption}</p>}
    </div>
  );
}
