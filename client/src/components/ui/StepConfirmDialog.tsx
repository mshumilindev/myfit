import type { ReactNode } from 'react';
import { ConfirmEffectsDialog } from './ConfirmEffectsDialog';
import { Field } from './Field';
import { useStepConfirm, type ConfirmStepDef } from './stepConfirm';

export interface StepConfirmStepText extends ConfirmStepDef {
  title: ReactNode;
  body?: ReactNode;
  /** Who/what goes away, one line each. */
  effects?: readonly { icon: string; text: string }[];
  /** Short button label ("Continue", "Delete"): the buttons share one row. */
  confirmLabel: string;
  /** Label of the typing field when `typeWord` is set ("Type DELETE to confirm"). */
  typeLabel?: string;
  icon?: string;
}

export interface StepConfirmDialogProps {
  /** 1..3 steps; a typed word only on the last. */
  steps: readonly StepConfirmStepText[];
  cancelLabel: string;
  /** "Step 1 of 3" */
  progressLabel?: (index: number, count: number) => string;
  /** The last step was confirmed: run the red action. */
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

/**
 * Red actions always go through prompts: 1..3 steps in the kit's confirm dialog (account deletion 3, health data 2,
 * Atlas chat 1, device wipe 1). Cancel and the confirm sit in one row with short labels; the last step may
 * demand a typed word and its button stays disabled until it matches. State: `useStepConfirm`.
 */
export function StepConfirmDialog({
  steps,
  cancelLabel,
  progressLabel,
  onConfirm,
  onCancel,
  loading,
}: StepConfirmDialogProps) {
  const sc = useStepConfirm(steps);
  const cur = steps[sc.index];
  const advance = () => {
    if (sc.next()) onConfirm();
  };
  return (
    <ConfirmEffectsDialog
      title={cur.title}
      body={cur.body}
      icon={cur.icon}
      effects={cur.effects}
      small={progressLabel && sc.count > 1 ? progressLabel(sc.index + 1, sc.count) : undefined}
      smallIcon={false}
      confirmLabel={cur.confirmLabel}
      cancelLabel={cancelLabel}
      confirmDisabled={!sc.canAdvance}
      loading={loading}
      onConfirm={advance}
      onCancel={onCancel}
    >
      {cur.typeWord != null && (
        <Field
          label={cur.typeLabel}
          value={sc.typed}
          onChange={(e) => sc.setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && sc.canAdvance) advance();
          }}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      )}
    </ConfirmEffectsDialog>
  );
}
