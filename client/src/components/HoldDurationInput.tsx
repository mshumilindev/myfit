import { NumberStepper } from './ui/NumberStepper';
import { useT } from '../i18n';

const MAX_MIN = 180;

/**
 * Hand-entered hold time: minutes and seconds side by side (a hold is often over a
 * minute, so one seconds box meant typing 150). Works in total seconds; ≥ 1 s.
 */
export function HoldDurationInput(props: {
  seconds: number;
  onChange: (seconds: number) => void;
  focused?: boolean;
  onFocus?: () => void;
}) {
  const { t } = useT();
  const total = Math.max(0, Math.round(props.seconds));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  const set = (m: number, s: number) => props.onChange(Math.max(1, m * 60 + s));
  return (
    <div className="hold-input">
      <NumberStepper
        label={t.minShort}
        value={min}
        step={1}
        min={0}
        max={MAX_MIN}
        focused={props.focused}
        onFocus={props.onFocus}
        onChange={(m) => set(m, sec)}
      />
      <NumberStepper
        label={t.wuSecUnit}
        value={sec}
        step={5}
        min={0}
        max={59}
        focused={props.focused}
        onFocus={props.onFocus}
        onChange={(s) => set(min, s)}
      />
    </div>
  );
}
