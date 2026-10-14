import type { ReactNode } from 'react';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { Icon } from '../../ui';
import type { Tone } from './tones';
import { Segmented } from './Segmented';
import './AccountPanel.css';

export interface AccountMode<V extends string> {
  value: V;
  label: string;
}

export interface AccountPanelProps<V extends string = string> {
  /** Display name (one line, ellipsis). */
  name: string;
  /** Second line under the name: "Trainer", "Admin", "Member"… */
  roleLabel?: string;
  /**
   * The avatar node. Each app passes its own (the real photo avatar with its store);
   * the kit default is the initials disc. Rendered at 40px in the panel.
   */
  avatar?: ReactNode;
  /** Mode switch ("Coach | My workouts"). Shown only with two or more modes and `onModeChange`. */
  modes?: AccountMode<V>[];
  /** The current mode; `null` / omitted = neither segment is selected (the app is neither side). */
  mode?: V | null;
  onModeChange?: (mode: V) => void;
  /** Accessible name of the mode group. */
  modeLabel?: string;
  /** Muted explanation under the switch (the privacy sentence). */
  note?: ReactNode;
  /** The Profile action (a glass pill in the People family by default); omitted without a handler. */
  profile?: { label: string; onOpen: () => void; icon?: string; tone?: Tone };
  /** Sign out: a danger pill directly under Profile, same shape. The host owns the confirmation. */
  signOut?: { label: string; onSelect: () => void; icon?: string };
  className?: string;
}

/**
 * Who is signed in, and in which mode (kit, app-agnostic): avatar, name, role, an optional
 * segmented mode switch, a privacy note and a Profile row. It is the account block of
 * `MoreMenu` (popover or sheet) and can stand alone in any app's rail popover or menu.
 */
export function AccountPanel<V extends string = string>({
  name,
  roleLabel,
  avatar,
  modes,
  mode,
  onModeChange,
  modeLabel,
  note,
  profile,
  signOut,
  className,
}: AccountPanelProps<V>) {
  const showModes = !!modes && modes.length > 1 && !!onModeChange;
  return (
    <div className={['uiacct', className].filter(Boolean).join(' ')}>
      <div className="uiacct-id">
        {avatar ?? <Avatar name={name || '?'} size={40} />}
        <div className="uiacct-who">
          <div className="uiacct-name">{name}</div>
          {roleLabel && <div className="uiacct-role">{roleLabel}</div>}
        </div>
      </div>
      {showModes && (
        <Segmented<V>
          fill
          label={modeLabel}
          value={mode ?? null}
          options={modes.map((m) => ({ value: m.value, label: m.label }))}
          onChange={(v) => {
            // Choosing the mode you are already in is a no-op.
            if (v !== mode) onModeChange(v);
          }}
        />
      )}
      {note != null && <p className="uiacct-note">{note}</p>}
      {(profile || signOut) && (
        <div className="uiacct-actions">
          {profile && (
            <AccountAction
              tone={profile.tone ?? 'people'}
              icon={profile.icon ?? 'user'}
              label={profile.label}
              onPress={profile.onOpen}
            />
          )}
          {signOut && (
            <AccountAction
              tone="danger"
              icon={signOut.icon ?? 'sign-out'}
              label={signOut.label}
              onPress={signOut.onSelect}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** One action pill of the account block: Card (glass, tinted gradient, 1px tone border), centred. */
function AccountAction({
  tone,
  icon,
  label,
  onPress,
}: {
  tone: Tone;
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Card as="button" pad="none" tone={tone} className="uiacct-action" onClick={onPress}>
      <Icon name={icon} />
      <span>{label}</span>
    </Card>
  );
}

/** Wraps the panel's actions (mode change, Profile) so each one closes its container first. */
export function withClose<V extends string>(
  account: AccountPanelProps<V>,
  onClose: () => void,
): AccountPanelProps<V> {
  const first =
    <A extends unknown[]>(fn: (...a: A) => void) =>
    (...a: A) => {
      onClose();
      fn(...a);
    };
  return {
    ...account,
    onModeChange: account.onModeChange && first(account.onModeChange),
    profile: account.profile && { ...account.profile, onOpen: first(account.profile.onOpen) },
    signOut: account.signOut && { ...account.signOut, onSelect: first(account.signOut.onSelect) },
  };
}
