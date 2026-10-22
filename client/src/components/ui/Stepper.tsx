import { Icon } from '../../ui';
import './Stepper.css';

export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: readonly StepperStep[];
  /** Index of the step being shown. */
  current: number;
  /** Ids of steps that are complete already (their circle shows a check even while they are the current step). */
  done?: readonly string[];
  /** Steps the person may jump to (a finished one, or the next when this one is complete); they become buttons. */
  reachable?: readonly string[];
  onStep?: (id: string) => void;
  /** "Step 1 of 2": the caller words it (language). */
  stepLabel: (n: number, total: number) => string;
}

/**
 * Every step at once: a numbered circle and the name of each (finished = check, current = accent), a bar under them,
 * and "Step 1 of 2" for screen readers and the caption. Story `Kit/Stepper`.
 */
export function Stepper({
  steps,
  current,
  done = [],
  reachable = [],
  onStep,
  stepLabel,
}: StepperProps) {
  const isDone = (id: string, i: number) => i < current || done.includes(id);
  return (
    <div className="uistepr" role="group" aria-label={stepLabel(current + 1, steps.length)}>
      <ol className="uistepr-row">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className={`uistepr-i ut-sm${isDone(s.id, i) ? ' is-done' : i === current ? ' is-on' : ''}`}
            aria-current={i === current ? 'step' : undefined}
          >
            {onStep && i !== current && reachable.includes(s.id) ? (
              <button type="button" className="uistepr-btn" onClick={() => onStep(s.id)}>
                <span className="uistepr-n ut-w7" aria-hidden="true">
                  {isDone(s.id, i) ? <Icon name="check" /> : i + 1}
                </span>
                <span className="uistepr-l ut-w6">{s.label}</span>
              </button>
            ) : (
              <>
                <span className="uistepr-n ut-w7" aria-hidden="true">
                  {isDone(s.id, i) ? <Icon name="check" /> : i + 1}
                </span>
                <span className="uistepr-l ut-w6">{s.label}</span>
              </>
            )}
          </li>
        ))}
      </ol>
      <span className="uistepr-bar" aria-hidden="true">
        {steps.map((s, i) => (
          <i key={s.id} className={isDone(s.id, i) ? 'is-done' : i === current ? 'is-on' : ''} />
        ))}
      </span>
      <span className="uistepr-t ut-xs">{stepLabel(current + 1, steps.length)}</span>
    </div>
  );
}
