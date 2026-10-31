import type { EmailState } from './emailApi';

/** What the email gate shows (SPO-423): nothing, the "add your email" form, or "check your inbox". */
export type EmailGateView = 'clear' | 'add' | 'sent';

/**
 * The gate is due only when the server says a confirmed email is required (`config/auth.requireVerifiedEmail`) AND the
 * account has none confirmed. While the server has not answered (offline, first second of a start) the app stays open:
 * offline is a normal state, so the gate appears at the first connection that reaches the server.
 */
export function emailGateView(state: EmailState | null): EmailGateView {
  if (!state || state.required !== true) return 'clear';
  if (state.verified && state.email) return 'clear';
  return state.email ? 'sent' : 'add';
}

/** The seconds a "send again" stays disabled after a letter went out (Firebase also limits repeats on its side). */
export const RESEND_COOLDOWN_S = 60;

export const cooldownLeft = (sentAt: number | null, now: number): number =>
  sentAt === null ? 0 : Math.max(0, Math.ceil(RESEND_COOLDOWN_S - (now - sentAt) / 1000));
