/**
 * Runtime bindings shared by every function that needs the coaching services: secrets, deploy-time parameters, the
 * Firestore Kv and the `Ctx` (server clock, pepper, content-free push). Kept out of `handlers.ts` so the legacy
 * callables (`trainer.ts`, `admin.ts`, `profile.ts`) can use the same consent logic without importing the handlers.
 *
 * Deploy-time switches (no code change; set in `functions/.env.<project>` or answer the prompt at deploy):
 *   APP_ORIGIN               origin of the web app used in invite links (default: the Firebase Hosting origin)
 *   COACH_ENFORCE_APPCHECK   "true" rejects callables without a valid App Check token (default false until the client
 *                            ships VITE_RECAPTCHA_ENTERPRISE_KEY and the console shows verified traffic; see
 *                            docs/COACH-SERVER-SECURITY.md)
 */
import { randomBytes } from 'node:crypto';
import {
  defineBoolean,
  defineSecret,
  defineString,
  type BooleanParam,
  type SecretParam,
} from 'firebase-functions/params';
import { db, HttpsError } from '../lib';
import { sendToUser } from '../push';
import { firestoreKv } from './firestoreKv';
import { DEFAULT_APP_ORIGIN } from './inviteLink';
import { pushTag } from './pushPolicy';
import type { Ctx } from './service';

export const COACH_PEPPER = defineSecret('COACH_PEPPER');
export const COACH_SIGNING_KEY = defineSecret('COACH_SIGNING_KEY');
export const APP_ORIGIN = defineString('APP_ORIGIN', { default: DEFAULT_APP_ORIGIN });
export const ENFORCE_APPCHECK = defineBoolean('COACH_ENFORCE_APPCHECK', { default: false });

export const coachKv = firestoreKv(db);

/** Options every coach callable shares: the pepper secret and the App Check switch (`enforceAppCheck`). */
export const coachCallOptions: { secrets: SecretParam[]; enforceAppCheck: BooleanParam } = {
  secrets: [COACH_PEPPER],
  enforceAppCheck: ENFORCE_APPCHECK,
};

export function pepper(): Uint8Array {
  const b = Buffer.from(COACH_PEPPER.value(), 'base64');
  if (b.length < 32) throw new HttpsError('failed-precondition', 'Coaching is not configured.');
  return b;
}

export function coachCtx(): Ctx {
  return {
    kv: coachKv,
    now: () => Date.now(),
    pepper: pepper(),
    newToken: () => randomBytes(16).toString('hex'),
    baseUrl: APP_ORIGIN.value(),
    // Content-free (C.3): no text, no sender name, no deep link with data.
    notify: async (uid, kind) => {
      try {
        // A coach / manager lands on Spotter (the service messages); anyone else on the home page. No data in the link.
        const u = (await coachKv.get(`users/${uid}`)) as { role?: string } | null;
        const staff = u?.role === 'trainer' || u?.role === 'manager' || u?.role === 'admin';
        await sendToUser(uid, {
          title: 'Spotter',
          body:
            kind === 'message'
              ? 'New message'
              : kind === 'invite'
                ? 'New invitation'
                : kind === 'program'
                  ? 'Program updated'
                  : kind === 'team'
                    ? 'Team update'
                    : kind === 'reminder'
                      ? 'Reminder'
                      : 'New request',
          tag: pushTag(kind),
          url: staff && kind !== 'message' && kind !== 'sync' ? '/#/c/spotter' : '/#/',
          kind,
        });
      } catch {
        /* a failed push never fails the write */
      }
    },
  };
}
