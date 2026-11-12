import { Hint } from '../components/ui/Hint';
import { OptionTile } from '../components/ui/OptionTile';
import { SearchField } from '../components/ui/SearchField';
import { WheelPicker } from '../components/ui/WheelPicker';
import { Icon } from '../ui';
import { PTONES, type Draft, type PTone } from './draft';
import { fill, type PlannerStrings } from './strings';
import './planner.css';

/** The pickers of the plan form's drawers (hours + minutes wheels, icon grid, colour row): pure, the form owns the state. */
export const HM = (p: {
  h: number;
  m: number;
  hl: string;
  ml: string;
  hMax: number;
  onChange: (h: number, m: number) => void;
  hUnit?: string;
  mUnit?: string;
}) => (
  <div className="pl-hm">
    <WheelPicker
      label={p.hl}
      value={p.h}
      onChange={(h) => p.onChange(h, p.m)}
      min={0}
      max={p.hMax}
      unit={p.hUnit}
      input="manual"
      size="compact"
    />
    <WheelPicker
      label={p.ml}
      value={p.m}
      onChange={(m) => p.onChange(p.h, m)}
      min={0}
      max={55}
      step={5}
      unit={p.mUnit}
      input="manual"
      size="compact"
    />
  </div>
);

type Put = (patch: Partial<Draft>) => void;
interface WheelProps {
  s: PlannerStrings;
  st: Draft;
  setS: Put;
}

export const StartWheel = ({ s, st, setS }: WheelProps) => (
  <HM
    h={st.hour}
    m={st.minute}
    hl={s.hour}
    ml={s.minutes}
    hMax={23}
    onChange={(hour, minute) => setS({ hour, minute })}
  />
);

export const DurationWheel = ({ s, st, setS }: WheelProps) => (
  <HM
    h={Math.floor(st.durationMin / 60)}
    m={st.durationMin % 60}
    hl={s.hours}
    ml={s.minutes}
    hMax={12}
    hUnit={s.h}
    mUnit={s.min}
    onChange={(h, m) => setS({ durationMin: Math.max(5, h * 60 + m) })}
  />
);

export const LeadWheel = ({ s, st, setS }: WheelProps) => (
  <HM
    h={Math.floor(st.lead / 60)}
    m={st.lead % 60}
    hl={s.hours}
    ml={s.minutes}
    hMax={48}
    hUnit={s.h}
    mUnit={s.min}
    onChange={(h, m) => setS({ lead: Math.min(2880, h * 60 + m) })}
  />
);

export const IconSearch = ({
  q,
  onChange,
  s,
}: {
  q: string;
  onChange: (q: string) => void;
  s: PlannerStrings;
}) => (
  <SearchField
    value={q}
    onChange={onChange}
    placeholder={s.searchIcons}
    clearLabel={s.clearSearch}
  />
);

export const IconGrid = ({
  icons,
  q,
  s,
  value,
  onPick,
}: {
  icons: string[];
  q: string;
  s: PlannerStrings;
  value: string;
  onPick: (icon: string) => void;
}) =>
  icons.length ? (
    <div className="pl-ip" role="radiogroup" aria-label={s.icon}>
      {icons.map((n) => (
        <OptionTile
          key={n}
          selected={n === value}
          aria-label={n.replace(/-/g, ' ')}
          title={n.replace(/-/g, ' ')}
          className="pl-ip-b"
          onClick={() => onPick(n)}
        >
          <Icon name={n} />
        </OptionTile>
      ))}
    </div>
  ) : (
    <Hint>{fill(s.noIcon, { q })}</Hint>
  );

export const ColorRow = ({
  s,
  value,
  onPick,
}: {
  s: PlannerStrings;
  value: PTone;
  onPick: (c: PTone) => void;
}) => (
  <div className="pl-sw" role="radiogroup" aria-label={s.color}>
    {PTONES.map((c: PTone, i) => (
      <OptionTile
        key={c}
        selected={c === value}
        aria-label={s.cols[i]}
        className={`pl-sw-b uit--${c}`}
        onClick={() => onPick(c)}
      >
        <span />
      </OptionTile>
    ))}
  </div>
);
