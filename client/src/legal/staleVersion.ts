/**
 * The server refuses a consent grant whose version is not its newest one (`400 stale-version`, SPO-533). The refusal is
 * permanent for that request, and repeating the same request never helps. When THIS build is the old side (a newer
 * policy version was released after it was loaded), the cure is the newest build: ask the service worker for it once per
 * page load; if a newer build is installed the page reloads into it and the gate asks again with the current versions.
 * If this already is the newest build, nothing more can be done on the client (the server is the old side): the person
 * sees the usual "could not save" state with its code, and no request is repeated in a loop.
 * No personal data is read, stored or logged here, and no storage key is used (the once-guard lives in memory).
 */
import { updateNow, type UpdateResult } from '../pwaUpdate';

/** True for the server's "this grant is not for the newest version of the document" refusal. */
export function isStaleVersionRefusal(e: unknown): boolean {
  const x = e as { status?: unknown; message?: unknown } | null;
  return x?.status === 400 && typeof x.message === 'string' && x.message.includes('stale-version');
}

let attempted = false;

/** Test hook: forget that a build check already ran in this page load. */
export function resetStaleVersionGuard(): void {
  attempted = false;
}

/**
 * Looks for a newer build, at most once per page load. Resolves `skipped` when a check already ran. When a newer build is
 * found the page reloads into it (see `updateNow`); this never throws.
 */
export async function refreshBuildOnStale(
  update: () => Promise<UpdateResult> = () => updateNow(),
): Promise<UpdateResult | 'skipped'> {
  if (attempted) return 'skipped';
  attempted = true;
  try {
    return await update();
  } catch {
    return 'failed';
  }
}
