/**
 * Who may open what in the People app (SPO-141).
 *
 * People is the admin-only user-management app ("Users"). A member or a trainer never sees its launcher tile
 * and never reaches its routes; "Me" (own profile & account) is a separate screen open to every role, reached
 * from the avatar → Profile. The same rule feeds the launcher, the router and the screen, so a hidden tile is
 * never the only protection. Server side the `admin*` functions and the rules already refuse non-admins.
 */
export type RosterRole = 'member' | 'trainer' | 'admin';
export type RosterTab = 'users' | 'me' | 'feed';

export const ROSTER_TAB_IDS: readonly string[] = ['users', 'me', 'feed'];

/** Only an admin gets the Users app (launcher tile, `/people/users`). */
export function canUsePeople(role: string | null | undefined): boolean {
  return role === 'admin';
}

/** A tab this role may see: `users` is admin-only, everyone else lands on Me. */
export function guardRosterTab(tab: RosterTab, role: string | null | undefined): RosterTab {
  return tab === 'users' && !canUsePeople(role) ? 'me' : tab;
}

/** The tab a role lands on when it opens the app: Users for an admin, Me for everyone else. */
export function rosterHomeTab(role: string | null | undefined): RosterTab {
  return canUsePeople(role) ? 'users' : 'me';
}

/** Which of the two separate things the screen is: user management (`users`) or the own account (`me`). The
 *  notifications feed belongs to whichever home the role has. */
export function rosterMode(tab: RosterTab, role: string | null | undefined): 'users' | 'me' {
  const eff = guardRosterTab(tab, role);
  if (eff === 'feed') return canUsePeople(role) ? 'users' : 'me';
  return eff;
}

/** The retired People "Clients" address (`/people/clients`): trainers and admins now find their clients in Coach. */
export function isLegacyPeopleClients(hash: string): boolean {
  return /^#?\/?people\/clients(?:[/?]|$)/.test(hash);
}
