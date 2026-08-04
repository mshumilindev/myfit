/**
 * Shared backend helpers for Spotter Cloud Functions.
 *
 * Timestamps are stored as epoch-millisecond numbers everywhere (matching the
 * app's existing data shape and the client's in-memory model) rather than
 * Firestore Timestamps, so client / functions / migration all speak the same
 * units.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

if (getApps().length === 0) {
  initializeApp({
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'spotter-64c3b.firebasestorage.app',
  });
}

export const db = getFirestore();
export const authAdmin = getAuth();
export const bucket = getStorage().bucket(
  process.env.FIREBASE_STORAGE_BUCKET || 'spotter-64c3b.firebasestorage.app',
);
export { FieldValue };

export type Role = 'member' | 'trainer' | 'admin';
export type Status = 'active' | 'invited' | 'suspended';

// --- Ids, tokens, passwords -------------------------------------------------

export function newId(): string {
  return crypto.randomUUID();
}

/** Opaque single-use invite / reset token (the credential in an invite link). */
export function newToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(plain, hash);
  } catch {
    return false;
  }
}

/** Passwords are 6–72 chars (72 = bcrypt's truncation limit). */
export function validPassword(pw: unknown): pw is string {
  return typeof pw === 'string' && pw.length >= 6 && pw.length <= 72;
}

// --- Names (ported from server/src/user-names.ts) ---------------------------

const NAME_MAX = 64;

export function cleanPersonName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX) : '';
}

export function splitDisplayName(value: string): { firstName: string; lastName: string | null } {
  const parts = cleanPersonName(value).split(' ').filter(Boolean);
  const firstName = parts.shift() ?? '';
  const lastName = parts.length > 0 ? parts.join(' ') : null;
  return { firstName, lastName };
}

export function parseNameInput(input: {
  firstName?: unknown;
  lastName?: unknown;
  username?: unknown;
  name?: unknown;
}): { firstName: string; lastName: string | null } {
  const firstName = cleanPersonName(input.firstName);
  const lastName = cleanPersonName(input.lastName);
  if (firstName) return { firstName, lastName: lastName || null };
  const legacyName = cleanPersonName(input.name) || cleanPersonName(input.username);
  return splitDisplayName(legacyName);
}

export interface UserDoc {
  id: string;
  username: string;
  usernameLower: string;
  email: string | null;
  emailLower: string | null;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  status: Status;
  trainerId: string | null;
  avatarExt: string | null;
  createdAt: number;
  updatedAt: number;
}

export function displayName(u: Pick<UserDoc, 'username' | 'firstName' | 'lastName'>): string {
  const fallback = splitDisplayName(u.username);
  const firstName = cleanPersonName(u.firstName) || fallback.firstName || u.username;
  const lastName = cleanPersonName(u.lastName) || fallback.lastName;
  return [firstName, lastName].filter(Boolean).join(' ');
}

// --- Auth context -----------------------------------------------------------

export function requireAuth(req: CallableRequest): string {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return uid;
}

export async function loadUser(uid: string): Promise<UserDoc> {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) throw new HttpsError('not-found', 'User not found.');
  return { id: uid, ...(snap.data() as Omit<UserDoc, 'id'>) };
}

/**
 * Re-read role + status from Firestore on every privileged call (AC-ROLE-07:
 * a demoted or suspended user loses access on their next request, regardless of
 * what their cached token claims).
 */
export async function requireRole(
  req: CallableRequest,
  roles: Role[],
): Promise<{ uid: string; user: UserDoc }> {
  const uid = requireAuth(req);
  const user = await loadUser(uid);
  if (user.status === 'suspended') throw new HttpsError('permission-denied', 'Account suspended.');
  if (!roles.includes(user.role)) throw new HttpsError('permission-denied', 'Not allowed.');
  return { uid, user };
}

/** Mint the Firebase custom token the client exchanges for a session. */
export function mintToken(uid: string, role: Role): Promise<string> {
  return authAdmin.createCustomToken(uid, { role });
}

/** The auth payload shape the client's setAuth() expects. */
export function authPayload(user: UserDoc, token: string) {
  return {
    token,
    userId: user.id,
    username: user.username,
    name: displayName(user),
    role: user.role,
  };
}

// --- Notices & audit --------------------------------------------------------

export type NoticeKind =
  | 'program-assigned'
  | 'program-replaced'
  | 'role-changed'
  | 'trainer-assigned'
  | 'trainer-removed'
  | 'client-assigned'
  | 'client-removed';

export async function createNotice(
  userId: string,
  kind: NoticeKind,
  actor?: string | null,
  detail?: string | null,
): Promise<void> {
  const id = newId();
  await db
    .collection('users')
    .doc(userId)
    .collection('notices')
    .doc(id)
    .set({
      id,
      kind,
      actor: actor ?? null,
      detail: detail ?? null,
      createdAt: Date.now(),
      readAt: null,
    });
}

/**
 * Log that `readerId` read `subjectId`'s data (no-op for self-reads). Reader
 * name + role are denormalized so the subject can read their own audit log
 * directly from Firestore without needing to read other users' documents.
 */
export async function recordAudit(
  readerId: string,
  subjectId: string,
  resource: string,
): Promise<void> {
  if (readerId === subjectId) return;
  let readerName: string | null = null;
  let readerRole: Role = 'admin';
  try {
    const reader = await loadUser(readerId);
    readerName = displayName(reader);
    readerRole = reader.role;
  } catch {
    /* reader gone — keep nulls */
  }
  const id = newId();
  await db.collection('users').doc(subjectId).collection('audit').doc(id).set({
    id,
    readerId,
    readerName,
    readerRole,
    subjectId,
    resource,
    at: Date.now(),
  });
}

// --- Uniqueness (username / email) -----------------------------------------
// Reservation docs in /usernames/{lower} and /emails/{lower} hold { userId }.
// Reserve/replace/release run inside transactions in the auth/admin functions.

export function usernameRef(lower: string) {
  return db.collection('usernames').doc(lower);
}
export function emailRef(lower: string) {
  return db.collection('emails').doc(lower);
}

export { HttpsError };
export type { CallableRequest };
