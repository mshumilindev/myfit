/**
 * `requestPasswordReset` (SPO-225): the public "Forgot your password?" callable. The answer is ALWAYS `{ ok: true }` for a
 * well-formed request, whether or not a letter was sent. Logic in `passwordResetCore.ts`; the new password itself is set
 * by `claim` (kind `reset`), the same one-time link as an administrator's reset.
 */
import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { isLocked, limiterKey, recordFailure } from './auth';
import { firestoreKv } from './coach/firestoreKv';
import { normalizeOrigin } from './coach/inviteLink';
import { APP_ORIGIN } from './coach/runtime';
import { authAdmin, db, HttpsError, newToken } from './lib';
import { asMailLocale, inviteMail } from './mailCore';
import { MAIL_API_KEY, sendMail } from './mailer';
import { RESET_HOURS, RESET_TTL_MS, requestReset, type ResetPorts } from './passwordResetCore';

const kv = firestoreKv(db);

const ports = (locale: unknown): ResetPorts => ({
  async authRecord(uid) {
    try {
      const u = await authAdmin.getUser(uid);
      return { email: u.email ?? null, verified: u.emailVerified === true };
    } catch {
      return null;
    }
  },
  async userStatus(uid) {
    const d = (await db.collection('users').doc(uid).get()).data() as
      { status?: 'active' | 'invited' | 'suspended' } | undefined;
    return d?.status ?? null;
  },
  async issue(uid, now) {
    const open = await db
      .collection('invites')
      .where('userId', '==', uid)
      .where('kind', '==', 'reset')
      .get();
    const batch = db.batch();
    for (const d of open.docs) {
      const inv = d.data() as { claimedAt: number | null; revokedAt: number | null };
      if (!inv.claimedAt && !inv.revokedAt) batch.update(d.ref, { revokedAt: now });
    }
    const token = newToken();
    batch.set(db.collection('invites').doc(token), {
      token,
      userId: uid,
      createdBy: uid,
      kind: 'reset',
      createdAt: now,
      expiresAt: now + RESET_TTL_MS,
      claimedAt: null,
      revokedAt: null,
      reRequestedAt: null,
      email: null,
    });
    await batch.commit();
    return token;
  },
  async send(email, token) {
    const r = await sendMail(
      inviteMail(asMailLocale(locale), email, {
        kind: 'selfreset',
        link: `${normalizeOrigin(APP_ORIGIN.value())}/#/join/${token}`,
        name: '',
        days: 0,
        hours: RESET_HOURS,
      }),
    );
    return r.sent;
  },
});

export const requestPasswordReset = onCall({ secrets: [MAIL_API_KEY] }, async (req) => {
  const b = (req.data ?? {}) as Record<string, unknown>;
  if (typeof b.email !== 'string' || b.email.length > 254) {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  }
  // Every request counts, known address or not: per caller (IP) and per address. Only the IP limit is told to the caller.
  const ipKey = limiterKey(req.rawRequest?.ip, 'reset');
  const mailKey = limiterKey(undefined, `reset:${b.email}`);
  if (await isLocked(ipKey)) {
    throw new HttpsError('resource-exhausted', 'Too many attempts. Try again in 15 minutes.');
  }
  const mailLocked = await isLocked(mailKey);
  await Promise.all([recordFailure(ipKey), recordFailure(mailKey)]);
  if (!mailLocked) {
    try {
      const out = await requestReset(kv, ports(b.locale), b.email, Date.now());
      if (out === 'failed') logger.warn('password reset letter not sent');
    } catch {
      logger.warn('password reset failed'); // never the address, never the cause text
    }
  }
  return { ok: true };
});
