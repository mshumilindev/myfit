/**
 * "Stop sharing" over all ten settings (SPO-107, owner decision Q1). Pure orchestration over injected writers, no React.
 * The four on-device levels go to Off FIRST and on this device (nothing waits for the network, like a health withdrawal in
 * `legal/healthConsentActions.ts`), then the six trainer grants are revoked (the server side drops the trainer's access and
 * evidence). A failing revoke never turns a local level back on: the person sees the failure and the screen stays safe.
 */
import type { Level } from '../domain/types';
import { LOCAL_CATEGORIES, localsToStop, type LocalCategory } from './shareModel';

export type LocalLevels = Record<LocalCategory, Level>;
export type LocalWriter = (id: LocalCategory, level: Level) => void;
/** Sets the RAW stored level of a local setting to Off whatever its consent says (`store.forgetShareLevel`). */
export type LocalForgetter = (id: LocalCategory) => void;

export interface StopResult {
  /** The grants were revoked (false: the failure is already reported by the store). */
  ok: boolean;
  /** The local levels that were above Off, for Undo. */
  previous: Partial<Record<LocalCategory, Level>>;
}

export async function stopAllSharing(p: {
  locals: LocalLevels;
  forget: LocalForgetter;
  revoke: () => Promise<boolean>;
  /** Resolves when the republished coach view (without the four levels) has been handed to the store, newest included. */
  settle?: () => Promise<void>;
}): Promise<StopResult> {
  // `previous` is what the person can see (a feature without consent reads Off there), so Undo never brings back a level
  // of a feature that is off. The raw level of ALL four is zeroed, also the hidden ones: a stored Full must not survive.
  const previous = localsToStop(p.locals);
  for (const id of LOCAL_CATEGORIES) p.forget(id);
  await p.settle?.().catch(() => undefined); // the final publish is out before the grants go
  const ok = await p.revoke();
  return { ok, previous };
}

/**
 * Undo: the local levels that Stop sharing turned off come back as they were, but only for a setting whose feature is
 * still allowed (`allowed`: its consent is on NOW); a feature switched off meanwhile stays off.
 */
export function restoreLocals(
  previous: Partial<Record<LocalCategory, Level>>,
  write: LocalWriter,
  allowed: (id: LocalCategory) => boolean = () => true,
): void {
  for (const id of Object.keys(previous) as LocalCategory[]) {
    const l = previous[id];
    if (l && allowed(id)) write(id, l);
  }
}
