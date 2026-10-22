import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import './LoadingSteps.css';

export type LoadingStepState = 'done' | 'active' | 'todo';

export interface LoadingStep {
  id: string;
  label: string;
  state: LoadingStepState;
}

export interface LoadingStepsProps {
  /** The brand lockup (mark + wordmark) above the card. */
  brand: ReactNode;
  steps: readonly LoadingStep[];
  /** One muted line under the card. */
  hint?: string;
}

/**
 * What is happening before the app opens, as a short ladder: finished steps are green with a check, the current one
 * spins, the rest wait. Used for the first-run consent check and for the moment after the agreement is recorded.
 * Story `Kit/LoadingSteps`.
 */
export function LoadingSteps({ brand, steps, hint }: LoadingStepsProps) {
  return (
    <div className="uils">
      <div className="uils-brand">{brand}</div>
      <ul className="uils-card" role="status" aria-live="polite">
        {steps.map((s) => (
          <li key={s.id} className={`uils-i ut-sm is-${s.state}`}>
            <span className="uils-mark" aria-hidden="true">
              {s.state === 'done' ? (
                <Icon name="check-circle" weight="fill" />
              ) : s.state === 'active' ? (
                <span className="uils-spin" />
              ) : (
                <Icon name="circle" />
              )}
            </span>
            <span>{s.label}</span>
          </li>
        ))}
      </ul>
      {hint && <p className="uils-hint ut-sm">{hint}</p>}
    </div>
  );
}
