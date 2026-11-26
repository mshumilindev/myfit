/** The pieces of the effort entry (RPE / RIR chunk). Plain, small components the set editor and the set row slot in. */
import { Chip } from '../components/ui/Chip';
import { NumberStepper } from '../components/ui/NumberStepper';
import { Tag } from '../components/ui/Tag';
import { useT } from '../i18n';
import { STRINGS } from './strings';

// No "Skip" cell: nothing chosen is the empty state, and tapping the chosen value again clears it
// (SPO-608). Five values + F fit the editor row at any locale length.
const VALUES = [6, 7, 8, 9, 10];

export function Chips(props: { rpe: number; failOn: boolean; onPick: (v: number) => void }) {
  return (
    <>
      {VALUES.map((v) => {
        const selected = props.rpe === v && !props.failOn;
        return (
          <Chip
            key={v}
            size="md"
            selected={selected}
            onClick={() => props.onPick(selected ? 0 : v)}
          >
            {v}
          </Chip>
        );
      })}
    </>
  );
}

export function Label() {
  const { locale } = useT();
  return <div className="se-label">{STRINGS[locale].label}</div>;
}

export function EffortHint(props: { rpe: number; est: number | null }) {
  const { locale } = useT();
  const s = STRINGS[locale];
  return (
    <>{props.rpe === 0 && props.est !== null ? s.estHint(String(props.est)) : s.hint(props.rpe)}</>
  );
}

export function EffortTag(props: { rpe: number | null; est: number | null }) {
  const { locale } = useT();
  const s = STRINGS[locale];
  if (props.rpe !== null)
    return (
      <Tag tone="neutral" className="tag-rpe">
        @{props.rpe}
      </Tag>
    );
  if (props.est !== null)
    return (
      <Tag tone="neutral" className="tag-rpe est" title={s.estHint(String(props.est))}>
        ~{props.est}
      </Tag>
    );
  return null;
}

export function CardioStepper(props: { value: number; onChange: (n: number) => void }) {
  const { t } = useT();
  return (
    <NumberStepper
      label={t.rpe}
      value={props.value}
      step={0.5}
      min={0}
      max={10}
      decimals={1}
      onChange={props.onChange}
    />
  );
}
