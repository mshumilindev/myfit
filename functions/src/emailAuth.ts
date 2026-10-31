/**
 * Callables for linking an email to an existing account (SPO-283). Logic and rules in `emailAuthCore.ts`.
 * `attachEmail` needs a signed-in caller AND the current password (a fresh proof before the sign-in method changes);
 * the confirmation letter is sent by `sendConfirmationMail` through the same server mailer as every other letter
 * (invitations, resets), so all mail leaves from one place.
 */
import { onCall } from 'firebase-functions/v2/https';
import { isLocked, limiterKey, recordFailure } from './auth';
import { firestoreKv } from './coach/firestoreKv';
import { normalizeOrigin } from './coach/inviteLink';
import { APP_ORIGIN } from './coach/runtime';
import { authAdmin, db, HttpsError, verifyPassword } from './lib';
import { asMailLocale, inviteMail } from './mailCore';
import { MAIL_API_KEY, sendMail } from './mailer';
import {
  attachEmail as attach,
  emailStatus as status,
  isEmailRequired,
  type AttachPorts,
} from './emailAuthCore';

const kv = firestoreKv(db);

const ports: AttachPorts = {
  async current(uid) {
    try {
      const u = await authAdmin.getUser(uid);
      return { email: u.email ? u.email.toLowerCase() : null, verified: u.emailVerified === true };
    } catch (e) {
      if ((e as { code?: string }).code === 'auth/user-not-found')
        return { email: null, verified: false };
      throw e;
    }
  },
  async setEmail(uid, email) {
    try {
      await authAdmin.updateUser(uid, { email, emailVerified: false });
    } catch (e) {
      if ((e as { code?: string }).code === 'auth/email-already-exists')
        throw new Error('email-taken', { cause: e });
      throw e;
    }
  },
};

const uidOf = (req: { auth?: { uid: string } | null }): string => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return req.auth.uid;
};

export const attachEmail = onCall(async (req) => {
  const uid = uidOf(req);
  const b = (req.data ?? {}) as Record<string, unknown>;
  const password = b.password;
  if (typeof password !== 'string' || password.length > 72) {
    throw new HttpsError('invalid-argument', 'Password is required.');
  }
  const key = limiterKey(req.rawRequest?.ip, `attach:${uid}`);
  // A second counter per account alone: rotating IPs must not multiply the attempts.
  const accountKey = limiterKey(undefined, `attach:${uid}`);
  if ((await isLocked(key)) || (await isLocked(accountKey))) {
    throw new HttpsError('resource-exhausted', 'Too many attempts. Try again in 15 minutes.');
  }
  // Every attempt counts, right or wrong: a "taken" answer must not become a way to test addresses.
  await Promise.all([recordFailure(key), recordFailure(accountKey)]);
  const me = (await db.collection('users').doc(uid).get()).data() as
    { status?: string } | undefined;
  if (me?.status === 'suspended') throw new HttpsError('permission-denied', 'forbidden');
  const cred = (await db.collection('credentials').doc(uid).get()).data() as
    { passwordHash?: string } | undefined;
  if (!cred?.passwordHash || !verifyPassword(password, cred.passwordHash)) {
    throw new HttpsError('permission-denied', 'Wrong password.');
  }
  const r = await attach(kv, ports, uid, b.email, Date.now());
  if (!r.ok) {
    throw new HttpsError(
      r.reason === 'taken' ? 'already-exists' : 'invalid-argument',
      r.reason === 'taken' ? 'This email cannot be used.' : 'Enter a valid email address.',
      { reason: r.reason },
    );
  }
  return { email: r.email, verified: r.verified };
});

export const emailStatus = onCall(async (req) => {
  const uid = uidOf(req);
  const [state, cfg] = await Promise.all([
    status(kv, ports, uid, Date.now()),
    db.collection('config').doc('auth').get(),
  ]);
  return { ...state, required: isEmailRequired(cfg.data()) };
});

/** Sends the address-confirmation letter from the server mailer. Counts every call; nothing about the result leaks the address. */
export const sendConfirmationMail = onCall({ secrets: [MAIL_API_KEY] }, async (req) => {
  const uid = uidOf(req);
  const b = (req.data ?? {}) as Record<string, unknown>;
  const key = limiterKey(undefined, `confirm:${uid}`);
  if (await isLocked(key)) {
    throw new HttpsError('resource-exhausted', 'Too many attempts. Try again in 15 minutes.');
  }
  await recordFailure(key);
  const { email, verified } = await ports.current(uid);
  if (!email) throw new HttpsError('invalid-argument', 'No email on this account.');
  if (verified) return { sent: false, verified: true };
  const link = await authAdmin.generateEmailVerificationLink(email, {
    url: normalizeOrigin(APP_ORIGIN.value()),
  });
  const locale = typeof b.locale === 'string' ? b.locale : 'en';
  const r = await sendMail(
    inviteMail(asMailLocale(locale), email, { kind: 'verify', link, name: '', days: 0 }),
  );
  if (!r.sent) throw new HttpsError('internal', 'Could not send the letter.');
  return { sent: true, verified: false };
});
