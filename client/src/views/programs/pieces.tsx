/** Small shared pieces of the Programs builder (design V06 "Big tiles"). */
import { useEffect, type ReactNode } from 'react';
import { Avatar } from '../../components/Avatar';
import { useT } from '../../i18n';
import { Icon, Switch } from '../../ui';
import type { DayMode, Person } from './model';

/** Muscles | Exercises — two identical tiles, one selected. */
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
  const tab = (m: DayMode, icon: string, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === m}
      className={`pg-mode${mode === m ? ' on' : ''}`}
      disabled={disabled && mode !== m}
      onClick={() => mode !== m && onChange(m)}
    >
      <Icon name={icon} />
      {label}
    </button>
  );
  return (
    <div className="pg-modes" role="radiogroup" aria-label={t.pgDefineBy}>
      {tab('muscles', 'person-simple', t.pgMuscles)}
      {tab('exercises', 'barbell', t.pgExercises)}
    </div>
  );
}

export function Stepper({
  value,
  label,
  onDec,
  onInc,
  decLabel,
  incLabel,
  big,
  disabled,
}: {
  value: ReactNode;
  label?: ReactNode;
  onDec: () => void;
  onInc: () => void;
  decLabel: string;
  incLabel: string;
  big?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`pg-stepper${big ? ' big' : ''}`}>
      <button type="button" aria-label={decLabel} onClick={onDec} disabled={disabled}>
        <Icon name="minus" />
      </button>
      <span className="pg-stepper-v">
        <b>{value}</b>
        {label && <small>{label}</small>}
      </span>
      <button type="button" aria-label={incLabel} onClick={onInc} disabled={disabled}>
        <Icon name="plus" />
      </button>
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
    <button
      type="button"
      className="pg-toggle"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      disabled={disabled}
    >
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <Switch on={on} />
    </button>
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
          <button
            key={it.label}
            type="button"
            role="menuitem"
            className={`pg-menu-item${it.danger ? ' danger' : ''}`}
            disabled={it.disabled}
            onClick={() => {
              onClose();
              it.onClick();
            }}
          >
            <Icon name={it.icon} />
            <span>
              {it.label}
              {it.hint && <small>{it.hint}</small>}
            </span>
          </button>
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
    <button
      type="button"
      className={['pg-ib', className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}
