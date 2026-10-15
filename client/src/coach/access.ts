/**
 * Who may open the Coach dashboard.
 *
 * Rule (user requirement): role `trainer` OR `admin` (an admin has a coach's
 * rights). Everything else — a member — never sees an entry point and cannot
 * reach the routes. Pure, so App.tsx, the shell launcher and the tests share it.
 */
import { isCoachDashHash } from './routes';

export type CoachRoleInput = 'member' | 'trainer' | 'admin' | string | null | undefined;

export function isCoachRole(role: CoachRoleInput): boolean {
  return role === 'trainer' || role === 'admin';
}

export function canUseCoach(role: CoachRoleInput): boolean {
  return isCoachRole(role);
}

/** Is the Coach dashboard the screen to render for this hash? */
export function coachScreenOpen(hash: string, role: CoachRoleInput): boolean {
  return canUseCoach(role) && isCoachDashHash(hash);
}
