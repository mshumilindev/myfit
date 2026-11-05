import { PlusMinus } from '@phosphor-icons/react/PlusMinus';
import { ListRow } from '../components/ui/GroupedList';
import { NumberStepper } from '../components/ui/NumberStepper';
import { Segmented } from '../components/ui/Segmented';
import { WheelPicker } from '../components/ui/WheelPicker';
import { storeInputMode, useInputMode, type InputMode } from '../inputModeStore';
import { useT } from '../i18n';
import { wheelDetent, wheelGrab } from '../wheelFeedback';

/** What a set's number is: the wheel and the stepper use different ranges / steps for each (SPO-318). */
export type SetField = 'reps' | 'weight';

const REPS_MAX = 200;
const WEIGHT_MAX = { kg: 400, lb: 900 } as const;

/**
 * One number of the set editor — reps or weight — as the person chose to enter it (Session sheet › More › Input):
 * the classic − / + stepper (default) or the wheel (SPO-318). Same value contract either way, so the callers don't
 * care. The wheel is the compact A1 variant: three rows, tap to type, the unit inside the selection band.
 */
export function SetNumberInput(props: {
  field: SetField;
  value: number;
  onChange: (n: number) => void;
  /** Display unit of the weight (the value is already in it). */
  unit?: 'kg' | 'lb';
  /** Stepper label ("Weight, kg") — the wheel shows the plain field name and the unit inside the band. */
  label: string;
  className?: string;
  focused?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onFocus?: () => void;
}) {
  const { t } = useT();
  const mode = useInputMode();
  const { field, value, unit = 'kg', label, ...rest } = props;
  const isLb = unit === 'lb';

  if (mode === 'wheel') {
    return (
      <WheelPicker
        onDetent={wheelDetent}
        onGrab={wheelGrab}
        {...rest}
        label={field === 'reps' ? t.reps : t.weightCol}
        value={value}
        input="manual"
        size="compact"
        step={field === 'reps' ? 1 : isLb ? 1 : 0.5}
        min={0}
        // A stored value above the usual range is never cut off by the drum.
        max={Math.max(field === 'reps' ? REPS_MAX : WEIGHT_MAX[unit], Math.ceil(value))}
        decimals={field === 'reps' ? 0 : 1}
        unit={field === 'weight' ? unit : undefined}
      />
    );
  }
  return (
    <NumberStepper
      {...rest}
      label={label}
      value={value}
      step={field === 'reps' ? 1 : isLb ? 5 : 2.5}
      min={0}
      decimals={field === 'reps' ? 0 : isLb ? 1 : 2}
    />
  );
}

/** Session sheet › More › Input: how reps and weight are entered — the wheel or − / + (kept on the account). */
export function InputModeRow() {
  const { t } = useT();
  const mode = useInputMode();
  return (
    <ListRow
      className="input-row"
      icon={
        <i className="ui-icon" aria-hidden="true">
          <PlusMinus weight="bold" />
        </i>
      }
      label={t.inputLabel}
      trailing={
        <Segmented<InputMode>
          size="sm"
          className="input-seg"
          label={t.inputLabel}
          options={[
            { value: 'wheel', label: t.inputWheel },
            { value: 'stepper', label: t.inputSteppers },
          ]}
          value={mode}
          onChange={storeInputMode}
        />
      }
    />
  );
}
