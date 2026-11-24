/** "Start in cycle week N" for the assign sheet (Periodization chunk): which week of the cycle a new client begins on. */
import { NumberStepper } from '../../components/ui/NumberStepper';
import { useT } from '../../i18n';
import { EDITOR_STRINGS } from './editorStrings';

export function StartWeekField({
  length,
  value,
  onChange,
}: {
  length: number;
  value: number;
  onChange: (n: number) => void;
}) {
  const { locale } = useT();
  const s = EDITOR_STRINGS[locale];
  return (
    <div className="pd-start">
      <NumberStepper label={s.startAt} value={value} min={1} max={length} onChange={onChange} />
      <p className="ut-xs ut-faint">{s.startHint}</p>
    </div>
  );
}
