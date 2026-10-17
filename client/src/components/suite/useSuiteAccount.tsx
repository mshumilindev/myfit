/**
 * The account block every app of the suite shows (rail avatar popover, phone More sheet):
 * real avatar, name, role, the "Coach | My workouts" mode switch where it applies, the privacy
 * note that belongs to that switch, and the Profile row. One definition, so Gym, Apex, People,
 * Nutrition, Learn and Coach cannot drift apart.
 *
 * Mode switch rule (same as Coach): only a trainer or an admin with the `coach` flag on gets it
 * (`useCoachAccess`); everyone else gets the avatar, name, role and Profile only. Outside the
 * Coach dashboard the switch only marks a side in Gym ("My workouts"); in Apex, People, Nutrition
 * and Learn NEITHER segment is selected (those apps are neither side). Choosing "Coach" opens the
 * dashboard through its entry hash (as the launcher's Coach tile does), choosing "My workouts"
 * goes to the Gym home.
 */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { currentUid, getRole, getUsername } from '../../api';
import { useT } from '../../i18n';
import { useCoachT } from '../../i18n/coach';
import { coachEntryHash } from '../../coach/routes';
import { useCoachAccess } from '../../coach/useCoachAccess';
import { UserAvatar } from '../Avatar';
import type { AccountPanelProps } from '../ui/AccountPanel';
import { ConfirmDialog } from '../../ui';
import { useSuiteSession } from './suiteSession';

export type SuiteMode = 'coach' | 'workouts';
/** The app the account block is shown in. Only Gym is the "My workouts" side. */
export type SuiteApp = 'gym' | 'apex' | 'roster' | 'nutrition' | 'learn' | 'coach';

export interface SuiteAccount {
  /** Props for `AccountPopover` / `MoreMenu`'s account block. */
  account: AccountPanelProps<SuiteMode>;
  /** Accessible name of the avatar button and of the popover ("Profile and mode"). */
  title: string;
  /** The sign-out confirmation: the host renders it OUTSIDE the popover / sheet (they close first). */
  dialog: ReactNode;
  /** The real avatar (photo from storage, initials fallback) at a given size. */
  avatar: (size: number) => ReactNode;
}

export interface SuiteIdentity {
  name?: string;
  userId?: string;
  role?: 'member' | 'trainer' | 'admin';
}

export function useSuiteAccount({
  app,
  onOpenProfile,
  onOpenGym,
  identity,
}: {
  app: SuiteApp;
  onOpenProfile?: () => void;
  /** "My workouts" from Coach (default: the Gym home hash). */
  onOpenGym?: () => void;
  /** Overrides the signed-in identity (Coach receives it as props; stories and tests). */
  identity?: SuiteIdentity;
}): SuiteAccount {
  const { t } = useT();
  const { c } = useCoachT();
  const flag = useCoachAccess();
  // Coach is only reachable with access, so its switch is always there.
  const canCoach = flag || app === 'coach';
  const role = identity?.role ?? getRole();
  const name = identity?.name ?? getUsername() ?? '';
  const uid = identity?.userId ?? currentUid() ?? undefined;
  const session = useSuiteSession();
  const [asking, setAsking] = useState(false);
  return useMemo(() => {
    const avatar = (size: number) => (
      <UserAvatar userId={uid} name={name || '?'} hasPhoto size={size} />
    );
    const account: AccountPanelProps<SuiteMode> = {
      name,
      roleLabel: role === 'admin' ? t.roleAdmin : role === 'trainer' ? t.roleTrainer : t.roleMember,
      avatar: avatar(40),
      ...(canCoach
        ? {
            modes: [
              { value: 'coach' as const, label: c.modeCoach },
              { value: 'workouts' as const, label: c.modeMyWorkouts },
            ],
            // Coach is the "Coach" side, Gym the "My workouts" side, every other app neither.
            mode:
              app === 'coach' ? ('coach' as const) : app === 'gym' ? ('workouts' as const) : null,
            modeLabel: c.modeLabel,
            onModeChange: (m: SuiteMode) => {
              if (m === 'coach') window.location.hash = coachEntryHash();
              // Gym home: a bare Gym hash closes whatever sub-app is open (App.tsx hashchange).
              else if (onOpenGym) onOpenGym();
              else window.location.hash = '#/today';
            },
            note: c.modeNote,
          }
        : {}),
      profile: onOpenProfile && { label: c.moreProfile, onOpen: onOpenProfile },
      // Sign out sits directly under Profile (it left the launcher); the confirmation is below.
      signOut: session ? { label: t.signOut, onSelect: () => setAsking(true) } : undefined,
    };
    const dialog =
      asking && session ? (
        <ConfirmDialog
          title={t.signOutTitle}
          body={
            session.queueLength > 0 ? t.signOutQueueBody(session.queueLength) : t.signOutCleanBody
          }
          confirmLabel={t.signOut}
          cancelLabel={t.cancel}
          danger
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            session.signOut();
          }}
        />
      ) : null;
    return { account, title: c.railProfile, avatar, dialog };
  }, [t, c, canCoach, role, name, uid, app, onOpenProfile, onOpenGym, session, asking]);
}
