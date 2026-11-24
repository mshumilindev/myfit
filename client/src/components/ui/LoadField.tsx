import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { Button } from './Button';
import { NumberStepper } from './NumberStepper';
import { Segmented } from './Segmented';
import './LoadField.css';

export interface LoadFieldLabels {
  /** Accessible name of the kg / % switch. */
  type: string;
  kg: string;
  pct: string;
  /** Label of the kilograms stepper. */
  weight: string;
  /** Label of the percent stepper. */
  percent: string;
  unitKg: string;
  unitPct: string;
}

export interface LoadFieldProps {
  mode: 'kg' | 'pct';
  onMode: (m: 'kg' | 'pct') => void;
  kg: number;
  onKg: (n: number) => void;
  pct: number;
  onPct: (n: number) => void;
  labels: LoadFieldLabels;
  /** The line under the percent stepper: what it comes to now ("Max 140 kg → 120 kg ..."), or the no-max hint. */
  hint?: ReactNode;
  /** The hint is a warning (no max yet). */
  hintWarn?: boolean;
  /** An action beside the hint ("Set a max"). */
  hintAction?: { label: string; onClick: () => void };
  disabled?: boolean;
}

/**
 * How heavy a row is (kit `loadfield`): kilograms or a percent of the person's max, with what the percent comes to under it.
 * Controlled; the caller computes the hint (the kit does no training maths).
 */
export function LoadField({
  mode,
  onMode,
  kg,
  onKg,
  pct,
  onPct,
  labels,
  hint,
  hintWarn,
  hintAction,
  disabled,
}: LoadFieldProps) {
  return (
    <div className="ui-loadfield">
      <Segmented
        label={labels.type}
        value={mode}
        onChange={onMode}
        options={[
          { value: 'kg', label: labels.kg },
          { value: 'pct', label: labels.pct },
        ]}
      />
      {mode === 'kg' ? (
        <NumberStepper
          label={labels.weight}
          value={kg}
          onChange={onKg}
          step={2.5}
          min={0}
          max={500}
          decimals={1}
          unit={labels.unitKg}
          disabled={disabled}
        />
      ) : (
        <>
          <NumberStepper
            label={labels.percent}
            value={pct}
            onChange={onPct}
            step={2.5}
            min={1}
            max={110}
            decimals={1}
            unit={labels.unitPct}
            disabled={disabled}
          />
          {hint != null && (
            <p className="ui-loadfield-hint">
              <Icon name={hintWarn ? 'warning-circle' : 'barbell'} />
              <span>{hint}</span>
              {hintAction && (
                <Button variant="link" size="sm" onClick={hintAction.onClick}>
                  {hintAction.label}
                </Button>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
