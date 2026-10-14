/** Small shared pieces of the Programs page. */
import type { ReactNode } from 'react';
import { Avatar } from '../../components/Avatar';
import { ListRow } from '../../components/ui/GroupedList';
import { Switch as KitSwitch } from '../../components/ui/Switch';
import type { Person } from './model';

export function ToggleRow({
  label,
  hint,
  on,
  onToggle,
  disabled,
}: {
  label: ReactNode;
  hint?: ReactNode;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <ListRow
      className="pg-toggle"
      label={label}
      sub={hint}
      dim={disabled}
      trailing={
        <KitSwitch
          checked={on}
          disabled={disabled}
          aria-label={typeof label === 'string' ? label : undefined}
          onChange={() => onToggle()}
        />
      }
    />
  );
}

export function AvatarStack({ people, max = 3 }: { people: Person[]; max?: number }) {
  const shown = people.slice(0, max);
  const more = people.length - shown.length;
  return (
    <span className="pg-avs" aria-hidden>
      {shown.map((p) => (
        <span key={p.id} className="pg-av">
          <Avatar
            userId={p.id}
            name={p.name}
            hasPhoto={!!p.avatar}
            rev={p.avatarRev ?? 0}
            size={30}
          />
        </span>
      ))}
      {more > 0 && <span className="pg-av pg-av-more">+{more}</span>}
    </span>
  );
}
