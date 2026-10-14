/**
 * What went wrong when the REAL Coach backend could not serve a screen, in the five words the person (and the developer)
 * can act on. Plain data and no Firebase import, so every screen and both ports share it.
 *   loading      (not a problem: the short skeleton)
 *   offline      no connection
 *   not-deployed the project has no Coach backend yet (callable / collection / rules missing: 404, unimplemented)
 *   denied       permission-denied (rules or App Check refuse this account)
 *   timeout      nothing answered within the bound (8 s for the first load)
 *   unknown      anything else
 */
export type CoachProblem = 'offline' | 'not-deployed' | 'denied' | 'timeout' | 'unknown';

interface Shape {
  code?: unknown;
  status?: unknown;
  name?: unknown;
  message?: unknown;
  details?: unknown;
}

/** The Firebase code ("permission-denied", "not-found" ...) of a thrown thing, looking through our HttpError wrapper. */
export function firebaseCode(e: unknown): string {
  const x = e as Shape | null;
  const pick = (v: unknown): string =>
    typeof (v as Shape | null)?.code === 'string'
      ? String((v as Shape).code).replace(/^functions\/|^firestore\//, '')
      : '';
  return pick(x) || pick(x?.details);
}

export function classifyProblem(e: unknown): CoachProblem {
  const x = e as Shape | null;
  // our own port errors first (they carry the code already)
  const own = x?.name === 'PortError' || x?.name === 'ClientPortError' ? String(x.code ?? '') : '';
  if (own === 'offline') return 'offline';
  if (own === 'timeout') return 'timeout';
  if (own === 'forbidden') return 'denied';
  if (own === 'not-deployed') return 'not-deployed';
  const code = firebaseCode(e);
  const status = typeof x?.status === 'number' ? x.status : 0;
  if (
    code === 'permission-denied' ||
    code === 'unauthenticated' ||
    status === 403 ||
    status === 401
  )
    return 'denied';
  if (code === 'deadline-exceeded' || status === 408 || status === 504) return 'timeout';
  if (code === 'not-found' || code === 'unimplemented' || status === 404 || status === 501)
    return 'not-deployed';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  if (code === 'unavailable' || status === 503) return 'offline';
  return 'unknown';
}

/** The same words for a port error CODE (`PortError.code` / `ClientPortError.code` / the world store's `error`). */
export function problemOfCode(code: string | null | undefined): CoachProblem {
  switch (code) {
    case 'offline':
      return 'offline';
    case 'timeout':
      return 'timeout';
    case 'forbidden':
      return 'denied';
    case 'not-deployed':
      return 'not-deployed';
    default:
      return 'unknown';
  }
}

/** For screens whose store keeps no error code: no connection, or "something went wrong". */
export function offlineOrUnknown(): CoachProblem {
  return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'unknown';
}
