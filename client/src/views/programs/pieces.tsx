/** Small shared pieces of the Programs builder (design V06 "Big tiles"). */
import { useEffect, type ReactNode } from 'react';
import { Avatar } from '../../components/Avatar';
import { useT } from '../../i18n';
import { Button, IconButton as KitIconButton } from '../../components/ui/Button';
import { ListRow } from '../../components/ui/GroupedList';
import { Card } from '../../components/ui/Card';
import { Icon } from '../../ui';
import { Switch as KitSwitch } from '../../components/ui/Switch';
import type { DayMode, Person } from './model';

/** Muscles | Exercises — two big tiles; the active one is glass (design Builder-Day). */
export function ModeTabs({
  mode,
  onChange,
  disabled,
}: {
  mode: DayMode;
  onChange: (m: DayMode) => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  const opts: { value: DayMode; label: string; icon: string }[] = [
    { value: 'muscles', label: t.pgMuscles, icon: 'person-simple' },
    { value: 'exercises', label: t.pgExercises, icon: 'barbell' },
  ];
  return (
    <div className="pg-modes" role="group" aria-label={t.pgDefineBy}>
      {opts.map((o) => {
        const on = o.value === mode;
        return (
          <Card
            key={o.value}
            as="button"
            pad="none"
            tone={on ? 'accent' : 'neutral'}
            emphasis={on ? 'glass' : 'card'}
            className="pg-mode"
            aria-pressed={on}
            disabled={disabled && !on}
            onClick={() => !on && onChange(o.value)}
          >
            <Icon name={o.icon} />
            <span>{o.label}</span>
          </Card>
        );
      })}
    </div>
  );
}

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

export interface MenuItem {
  label: string;
  icon: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
}

/** A small action menu anchored under the "⋯" button that opened it. */
export function ActionMenu({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <div className="pg-menu-scrim" onClick={onClose} />
      <div className="pg-menu" role="menu">
        {items.map((it) => (
          <Button
            key={it.label}
            role="menuitem"
            variant={it.danger ? 'danger' : 'ghost'}
            fullWidth
            className="pg-menu-item"
            icon={it.icon}
            disabled={it.disabled}
            onClick={() => {
              onClose();
              it.onClick();
            }}
          >
            {it.label}
            {it.hint && <small>{it.hint}</small>}
          </Button>
        ))}
      </div>
    </>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  className,
  expanded,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  className?: string;
  expanded?: boolean;
}) {
  return (
    <KitIconButton
      variant="ghost"
      size="sm"
      className={['pg-ib', className].filter(Boolean).join(' ')}
      label={label}
      title={label}
      icon={icon}
      aria-expanded={expanded}
      onClick={onClick}
    />
  );
}
