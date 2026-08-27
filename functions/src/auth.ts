/**
 * Auth Cloud Functions — bcrypt credential store ↔ Firebase custom tokens.
 * Public self-serve register is closed; new accounts only via invite → claim.
 * Also: login, status, invite preview, request-new.
 */
import { onCall } from 'firebase-functions/v2/https';
import {
  db,
  authAdmin,
  authPayload,
  bucket,
  displayName,
  hashPassword,
  HttpsError,
  mintToken,
  parseNameInput,
  usernameRef,
  validPassword,
  verifyPassword,
  type Status,
  type UserDoc,
} from './lib';

const USERNAME_MAX = 64;

interface InviteDoc {
  token: string;
  userId: string;
  createdBy: string;
  kind: 'invite' | 'reset';
  createdAt: number;
  expiresAt: number;
  claimedAt: number | null;
  revokedAt: number | null;
  reRequestedAt: number | null;
}

function inviteState(inv: InviteDoc): 'valid' | 'expired' | 'claimed' | 'revoked' {
  if (inv.revokedAt) return 'revoked';
  if (inv.claimedAt) return 'claimed';
  if (Date.now() > inv.expiresAt) return 'expired';
  return 'valid';
}

async function inviterAvatarDataUrl(userId: string, hasAvatar: boolean): Promise<string | null> {
  if (!hasAvatar) return null;
  try {
    const file = bucket.file(`avatars/${userId}/photo`);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size ?? 0);
    if (size <= 0 || size > 512 * 1024) return null;
    const [buffer] = await file.download();
    const contentType = metadata.contentType || 'image/jpeg';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

// --- Brute-force limiter (Firestore-backed) --------------------------------
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

async function isLocked(key: string): Promise<boolean> {
  const snap = await db.collection('loginAttempts').doc(key).get();
  if (!snap.exists) return false;
  const { count, windowStart } = snap.data() as { count: number; windowStart: number };
  if (Date.now() - windowStart > FAIL_WINDOW_MS) return false;
  return count >= MAX_FAILURES;
}
async function recordFailure(key: string): Promise<void> {
  const ref = db.collection('loginAttempts').doc(key);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    if (
      !snap.exists ||
      now - (snap.data() as { windowStart: number }).windowStart > FAIL_WINDOW_MS
    ) {
      tx.set(ref, { count: 1, windowStart: now });
    } else {
      tx.update(ref, { count: (snap.data() as { count: number }).count + 1 });
    }
  });
}
async function clearFailures(key: string): Promise<void> {
  await db
    .collection('loginAttempts')
    .doc(key)
    .delete()
    .catch(() => undefined);
}

function limiterKey(ip: string | undefined, identifier: string): string {
  // Doc ids can't contain '/'; hash-free key is fine for our low volume.
  return `${(ip ?? 'noip').replace(/[^\w.:-]/g, '_')}|${identifier.trim().toLowerCase()}`.slice(
    0,
    200,
  );
}

// --- register ---------------------------------------------------------------
// Public self-serve sign-up is closed. New accounts only via invite → claim
// (OnboardingView). Keep the callable so old clients get a clear error.

export const register = onCall(async () => {
  throw new HttpsError(
    'failed-precondition',
    'Self-serve sign-up is closed. Ask an admin for an invite link.',
  );
});

// --- login ------------------------------------------------------------------

export const login = onCall(async (req) => {
  const body = (req.data ?? {}) as Record<string, unknown>;
  const identifierRaw = (body.identifier ?? body.username) as unknown;
  const { password } = body;
  if (typeof identifierRaw !== 'string' || typeof password !== 'string') {
    throw new HttpsError('invalid-argument', 'Username and password are required.');
  }
  if (password.length > 72 || identifierRaw.length > USERNAME_MAX) {
    throw new HttpsError('unauthenticated', 'Wrong username or password.');
  }
  const ip = req.rawRequest?.ip;
  const key = limiterKey(ip, identifierRaw);
  if (await isLocked(key)) {
    throw new HttpsError(
      'resource-exhausted',
      'Too many failed attempts. Try again in 15 minutes.',
    );
  }
  const idLower = identifierRaw.trim().toLowerCase();
  const uSnap = await usernameRef(idLower).get();
  const userId = (uSnap.exists ? uSnap.data() : null) as {
    userId: string;
  } | null;
  if (!userId) {
    await recordFailure(key);
    throw new HttpsError('unauthenticated', 'Wrong username or password.');
  }
  const [userSnap, credSnap] = await Promise.all([
    db.collection('users').doc(userId.userId).get(),
    db.collection('credentials').doc(userId.userId).get(),
  ]);
  const hash = credSnap.exists ? (credSnap.data() as { passwordHash?: string }).passwordHash : null;
  if (!userSnap.exists || !hash || !verifyPassword(password, hash)) {
    await recordFailure(key);
    throw new HttpsError('unauthenticated', 'Wrong username or password.');
  }
  const user: UserDoc = { id: userId.userId, ...(userSnap.data() as Omit<UserDoc, 'id'>) };
  if (user.status === 'suspended') {
    throw new HttpsError('permission-denied', 'This account is suspended. Ask your admin.');
  }
  await clearFailures(key);
  return authPayload(user, await mintToken(user.id, user.role));
});

// --- status -----------------------------------------------------------------

export const authStatus = onCall(async () => {
  const meta = await db.collection('meta').doc('app').get();
  if (meta.exists && (meta.data() as { hasAdmin?: boolean }).hasAdmin) return { registered: true };
  const any = await db.collection('users').limit(1).get();
  return { registered: !any.empty };
});

// --- invite preview ---------------------------------------------------------

export const invitePreview = onCall(async (req) => {
  const token = (req.data ?? {}).token as unknown;
  if (typeof token !== 'string') throw new HttpsError('invalid-argument', 'token required');
  const invSnap = await db.collection('invites').doc(token).get();
  if (!invSnap.exists) throw new HttpsError('not-found', 'unknown link');
  const inv = invSnap.data() as InviteDoc;
  const [uSnap, iSnap] = await Promise.all([
    db.collection('users').doc(inv.userId).get(),
    db.collection('users').doc(inv.createdBy).get(),
  ]);
  const user = uSnap.exists ? ({ id: inv.userId, ...(uSnap.data() as object) } as UserDoc) : null;
  const inviter = iSnap.exists
    ? ({ id: inv.createdBy, ...(iSnap.data() as object) } as UserDoc)
    : null;
  const inviterAvatar = !!inviter?.avatarExt;
  return {
    state: inviteState(inv),
    kind: inv.kind,
    inviter: inviter ? displayName(inviter) : null,
    inviterId: inviter?.id ?? null,
    inviterAvatar,
    inviterAvatarUrl: inviter ? await inviterAvatarDataUrl(inviter.id, inviterAvatar) : null,
    username: user?.username ?? null,
    name: user ? displayName(user) : null,
    firstName: user?.firstName ?? null,
    lastName: user?.lastName ?? null,
    expiresAt: inv.expiresAt,
    claimedAt: inv.claimedAt,
    revokedAt: inv.revokedAt,
  };
});

// --- claim ------------------------------------------------------------------

export const claim = onCall(async (req) => {
  const body = (req.data ?? {}) as Record<string, unknown>;
  const { token, password, username } = body;
  if (typeof token !== 'string' || typeof password !== 'string') {
    throw new HttpsError('invalid-argument', 'token and password are required');
  }
  if (!validPassword(password))
    throw new HttpsError('invalid-argument', 'Password: 6 to 72 characters.');

  const invRef = db.collection('invites').doc(token);
  const invSnap = await invRef.get();
  if (!invSnap.exists || inviteState(invSnap.data() as InviteDoc) !== 'valid') {
    throw new HttpsError('failed-precondition', 'link no longer valid');
  }
  const inv = invSnap.data() as InviteDoc;
  const userRef = db.collection('users').doc(inv.userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('failed-precondition', 'account gone');
  const current: UserDoc = { id: inv.userId, ...(userSnap.data() as Omit<UserDoc, 'id'>) };

  const names = parseNameInput(body);
  const firstName = names.firstName || current.firstName || '';
  const lastName = names.firstName ? names.lastName : current.lastName;
  const name =
    typeof username === 'string' && username.trim().length >= 2
      ? username.trim().slice(0, USERNAME_MAX)
      : current.username;
  if (!firstName || firstName.length < 2) {
    throw new HttpsError('invalid-argument', 'First name: 2 to 64 characters.');
  }

  const nameLower = name.toLowerCase();
  const updated = await db.runTransaction<UserDoc>(async (tx) => {
    // Re-check uniqueness for any changed username.
    if (nameLower !== current.usernameLower) {
      const u = await tx.get(usernameRef(nameLower));
      if (u.exists) throw new HttpsError('already-exists', 'That username is already taken.');
    }
    const next: UserDoc = {
      ...current,
      username: name,
      usernameLower: nameLower,
      firstName,
      lastName,
      status: 'active' as Status,
      updatedAt: Date.now(),
    };
    const { id: _omit, ...stored } = next;
    void _omit;
    tx.set(userRef, stored);
    tx.set(db.collection('credentials').doc(inv.userId), { passwordHash: hashPassword(password) });
    if (nameLower !== current.usernameLower) {
      if (current.usernameLower) tx.delete(usernameRef(current.usernameLower));
      tx.set(usernameRef(nameLower), { userId: inv.userId });
    }
    tx.update(invRef, { claimedAt: Date.now() });
    return next;
  });

  // Ensure a Firebase Auth user exists for this uid (custom-token sign-in
  // creates one too, but doing it here keeps Auth in sync after invite claim).
  try {
    await authAdmin.getUser(updated.id);
  } catch {
    await authAdmin.createUser({
      uid: updated.id,
      displayName: displayName(updated),
      disabled: false,
    });
  }

  return authPayload(updated, await mintToken(updated.id, updated.role));
});

// --- request a new invite ---------------------------------------------------

export const requestNewInvite = onCall(async (req) => {
  const token = (req.data ?? {}).token as unknown;
  if (typeof token !== 'string') throw new HttpsError('invalid-argument', 'token required');
  const ref = db.collection('invites').doc(token);
  if (!(await ref.get()).exists) throw new HttpsError('not-found', 'unknown link');
  await ref.update({ reRequestedAt: Date.now() });
  return { ok: true };
});
