import { Button } from './Button';
import { NumberStepper } from './NumberStepper';
import './RepRange.css';

export interface RepRangeLabels {
  reps: string;
  from: string;
  to: string;
  useRange: string;
  useOne: string;
}

export interface RepRangeProps {
  /** The upper end (or the one number). */
  reps: number;
  /** The lower end; undefined = one number. */
  repsMin?: number;
  onChange: (next: { reps: number; repsMin?: number }) => void;
  labels: RepRangeLabels;
}

/**
 * Reps (kit `reprange`): one number by default; "Use a range" swaps it for from / to, "Use one number" swaps back.
 * Controlled; the range is valid while from < to.
 */
export function RepRange({ reps, repsMin, onChange, labels }: RepRangeProps) {
  const range = repsMin !== undefined;
  return (
    <div className="uirr">
      {range ? (
        <div className="uirr-row">
          <NumberStepper
            label={labels.from}
            value={repsMin}
            min={1}
            max={Math.max(1, reps - 1)}
            onChange={(n) => onChange({ reps, repsMin: Math.min(n, Math.max(1, reps - 1)) })}
          />
          <NumberStepper
            label={labels.to}
            value={reps}
            min={Math.min(100, repsMin + 1)}
            max={100}
            onChange={(n) => onChange({ reps: n, repsMin })}
          />
        </div>
      ) : (
        <NumberStepper
          label={labels.reps}
          value={reps}
          min={1}
          max={100}
          onChange={(n) => onChange({ reps: n })}
        />
      )}
      <Button
        variant="link"
        size="sm"
        onClick={() =>
          onChange(
            range
              ? { reps }
              : { reps: Math.max(2, reps), repsMin: Math.max(1, Math.min(reps - 1, reps - 2)) },
          )
        }
      >
        {range ? labels.useOne : labels.useRange}
      </Button>
    </div>
  );
}
