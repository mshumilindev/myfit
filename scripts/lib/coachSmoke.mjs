// Pure helpers of the post-deploy Coach smoke check (SPO-364). No network, no Firebase: tested in tests/coach-smoke.test.ts.

/** Callables the trainer dashboard and the client's "My trainer" need on first load (docs/COACH-BACKEND.md, 7.1). */
export const COACH_CALLABLES = [
  'vaultKey',
  'coachPublishSignKey',
  'coachKeySign',
  'coachClients',
  'coachRead',
  'coachMyLink',
  'coachAdoptLegacy',
  'coachInvite',
  'coachInvitePreview',
  'coachAccept',
  'coachDecline',
  'coachEnd',
  'coachLogRead',
  'setConsent',
  'setCoachingMode',
  'rescheduleCreate',
  'rescheduleRespond',
  'publishPlanVersion',
  'programAck',
  'coachChatReset',
];

/** A callable answers within this bound or the app shows "too long" (client READ_TIMEOUT_MS is 15 s). */
export const SLOW_MS = 15_000;

/**
 * One unauthenticated POST to a callable. Deployed callables answer 4xx with an HTTPS-callable error body
 * (UNAUTHENTICATED / INVALID_ARGUMENT / PERMISSION_DENIED); a missing one answers 404 (or the platform's 5xx).
 * @returns {{ok:boolean, state:'deployed'|'missing'|'broken'|'slow', status:number}}
 */
export function classifyCallableProbe({ status, ms }) {
  if (ms > SLOW_MS) return { ok: false, state: 'slow', status };
  if (status === 404) return { ok: false, state: 'missing', status };
  if (status >= 500) return { ok: false, state: 'broken', status };
  return { ok: true, state: 'deployed', status };
}

const norm = (i) =>
  JSON.stringify([
    i.collectionGroup,
    i.queryScope ?? 'COLLECTION',
    (i.fields ?? []).map((f) => [f.fieldPath, f.order ?? f.arrayConfig ?? '']),
  ]);

/** Composite indexes present in the repo file but not (yet) on the project. `live` is `firebase firestore:indexes` JSON. */
export function missingIndexes(wanted, live) {
  const have = new Set((live?.indexes ?? []).map(norm));
  return (wanted?.indexes ?? []).filter((i) => !have.has(norm(i))).map(norm);
}
