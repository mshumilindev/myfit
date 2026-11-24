import { NumberStepper } from '../components/ui/NumberStepper';
import type { RowSlotProps } from '../tools/programEditor/host';
import { useT } from '../i18n';

/** The target-effort stepper of a program row (the editor keeps the on / off wrapper and its words). */
export function RowRpe({ item, patch }: RowSlotProps) {
  const { t } = useT();
  return (
    <NumberStepper
      label={t.rpe}
      value={item.targetRpe ?? 8}
      min={5}
      max={10}
      step={0.5}
      decimals={1}
      onChange={(n) => patch({ targetRpe: n })}
    />
  );
}
