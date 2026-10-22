import type { ReactNode } from 'react';
import { ListRow } from './GroupedList';
import { IconTile } from './IconTile';
import { Switch } from './Switch';
import type { Tone } from './tones';
import './ConsentRow.css';

export interface ConsentRowProps {
  icon: string;
  tone?: Tone;
  /** Also the switch's accessible name. */
  label: string;
  /** What the consent covers. */
  sub: ReactNode;
  /** The state line, already worded by the caller: "Given · v1.2, 3 Mar" / "Not given". */
  status: string;
  on: boolean;
  disabled?: boolean;
  /** `false` = the person withdraws it. */
  onChange: (on: boolean) => void;
}

/** One consent in a list (Privacy and sharing): name, what it covers, its state line and a switch to give or withdraw it. */
export function ConsentRow({
  icon,
  tone,
  label,
  sub,
  status,
  on,
  disabled,
  onChange,
}: ConsentRowProps) {
  return (
    <ListRow
      as="label"
      icon={<IconTile tone={tone ?? 'neutral'} size={30} icon={icon} />}
      label={label}
      sub={
        <>
          {sub}
          <span className="uicr-ver ut-xs ut-faint">{status}</span>
        </>
      }
      trailing={<Switch checked={on} disabled={disabled} onChange={onChange} aria-label={label} />}
    />
  );
}
