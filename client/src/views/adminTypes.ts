/** Shared shapes of the admin people screens. */

/** What the server reports about the invitation letter (the link and QR are always returned). */
export type MailOutcome = { sent: boolean; reason?: string };

export interface Person {
  id: string;
  name: string;
  username: string;
  firstName: string;
  lastName: string | null;
  role: 'member' | 'trainer' | 'admin';
  status: 'active' | 'invited' | 'suspended';
  trainerId: string | null;
  trainerName: string | null;
  clientCount: number;
  lastSessionAt: number | null;
  live: boolean;
  liveStartedAt: number | null;
  volume30: number;
  avatar: boolean;
  invite: {
    state: 'sent' | 'expired' | 'revoked' | 'claimed';
    expiresAt: number;
    claimedAt: number | null;
    reRequestedAt: number | null;
    token: string;
  } | null;
}

export function inviteLink(token: string): string {
  return `${window.location.origin}/#/join/${token}`;
}
