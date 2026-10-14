/**
 * Invite rules (pure). A trainer invites by name and picks how the client logs (R-BE-REL-2). The consent levels
 * on an invite are a REQUEST: the client decides what to share at accept time and can change it any time.
 * Program-only clients do not use the app, so there is nothing to request (every category stays off).
 */
import { ALL_OFF } from './consent';
import { CATEGORIES, type Category, type Consent, type Level, type LogMode } from './types';

export const INVITE_VALID_DAYS = 7;
export const NAME_MIN = 2;
export const NAME_MAX = 80;

/** What a trainer would normally want to see, per mode. A starting point the trainer can change. */
export function defaultRequest(mode: LogMode): Consent {
  if (mode === 'program') return ALL_OFF;
  if (mode === 'hybrid') return { ...ALL_OFF, totals: 'full' };
  return { ...ALL_OFF, totals: 'full', sets: 'full', checkins: 'full' };
}

/** Does this mode carry consent requests at all? */
export const modeAsksConsent = (mode: LogMode): boolean => mode !== 'program';

export type NameProblem = 'empty' | 'short' | 'long';
export function nameProblem(raw: string): NameProblem | null {
  const n = raw.trim();
  if (!n) return 'empty';
  if (n.length < NAME_MIN) return 'short';
  if (n.length > NAME_MAX) return 'long';
  return null;
}

/** The request that is actually sent: program-only forces everything off, whatever the picker held. */
export function effectiveRequest(mode: LogMode, request: Consent): Consent {
  return mode === 'program' ? ALL_OFF : request;
}

export const setLevel = (c: Consent, cat: Category, level: Level): Consent => ({
  ...c,
  [cat]: level,
});

export const requestedCategories = (c: Consent): Category[] =>
  CATEGORIES.filter((k) => c[k] !== 'off');

/** Whole days left, never negative; 0 = expires today or already expired. */
export function daysLeft(expiresAt: number, now: number): number {
  return Math.max(0, Math.ceil((expiresAt - now) / 86_400_000));
}
