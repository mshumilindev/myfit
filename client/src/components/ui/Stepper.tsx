import './Stepper.css';

export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: readonly StepperStep[];
  /** Index of the step being shown. */
  current: number;
  /** "Step 1 of 2": the caller words it (language). */
  stepLabel: (n: number, total: number) => string;
}

/** "Step 1 of 2 · Terms" over a segmented bar: finished and current segments are filled. Story `Kit/Stepper`. */
export function Stepper({ steps, current, stepLabel }: StepperProps) {
  const label = steps[current]?.label ?? '';
  return (
    <div className="uistep" role="group" aria-label={stepLabel(current + 1, steps.length)}>
      <span className="uistep-t ut-sm ut-w6">
        {stepLabel(current + 1, steps.length)} · {label}
      </span>
      <span className="uistep-bar" aria-hidden="true">
        {steps.map((s, i) => (
          <i key={s.id} className={i < current ? 'is-done' : i === current ? 'is-on' : ''} />
        ))}
      </span>
    </div>
  );
}
