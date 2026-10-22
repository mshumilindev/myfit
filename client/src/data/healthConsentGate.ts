/**
 * The one switch for the seven health features (SPO-290): injuries, chronic conditions, cycle, nicotine, alcohol,
 * supplements, nutrition. Pure: no React, no Firestore. A feature is OFF until the person's `health:<feature>` consent
 * record says on (`optionalConsentOn(records, 'health:<f>')`, set by `legal/HealthConsentHost`); until the records are
 * known everything is off (fail closed). Off means: nothing is written for the feature, and what is already stored is not
 * shown or processed (the store hands out an empty view, `healthMask.ts`). The data itself is NOT deleted by this module.
 */
import type { HealthFeature } from '../legal/consents';

export type HealthOnMap = Readonly<Record<HealthFeature, boolean>>;
export type HealthAnswered = Readonly<Record<HealthFeature, boolean>>;

export interface HealthGateState {
  /** Consent granted at the current version and not withdrawn. */
  on: HealthOnMap;
  /** The server (or a cache with data) has answered, so "no record" really means never asked. */
  ready: boolean;
  /** A `health:<f>` record of either kind exists: do not pop the prompt again by itself. */
  answered: HealthAnswered;
}

/**
 * The explicit answer of a health write that was refused because the feature has no consent. Writers that used to
 * return nothing (or a fake object) return this instead, so a caller never shows "saved" for something that was not
 * stored. The caller opens the feature's prompt (`openHealthPrompt(r.feature)`) or shows the off notice.
 */
export interface HealthWriteDenied {
  ok: false;
  reason: 'consent';
  feature: HealthFeature;
}
export type HealthWriteResult = { ok: true } | HealthWriteDenied;
export const healthWriteDenied = (feature: HealthFeature): HealthWriteDenied => ({
  ok: false,
  reason: 'consent',
  feature,
});
export function isHealthWriteDenied(x: unknown): x is HealthWriteDenied {
  return (
    typeof x === 'object' &&
    x !== null &&
    (x as { ok?: unknown }).ok === false &&
    (x as { reason?: unknown }).reason === 'consent'
  );
}
/** Refused write -> the feature's consent prompt opens (the one place that pairs the two). */
export function askForDeniedWrite(x: unknown): boolean {
  if (!isHealthWriteDenied(x)) return false;
  openHealthPrompt(x.feature);
  return true;
}

const NONE: HealthOnMap = {
  injuries: false,
  chronic: false,
  cycle: false,
  nicotine: false,
  alcohol: false,
  supplements: false,
  nutrition: false,
};

const ALL: HealthOnMap = {
  injuries: true,
  chronic: true,
  cycle: true,
  nicotine: true,
  alcohol: true,
  supplements: true,
  nutrition: true,
};

let state: HealthGateState = { on: NONE, ready: false, answered: NONE };
let version = 0;
let promptFor: HealthFeature | null = null;
const declined = new Set<HealthFeature>();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const same = (a: HealthOnMap, b: HealthOnMap) =>
  (Object.keys(a) as HealthFeature[]).every((k) => a[k] === b[k]);

export function subscribeHealth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const healthSnapshot = (): HealthGateState => state;
/** Bumps whenever any switch changes: the store keys its masked view on it. */
export const healthVersion = (): number => version;
export const isHealthOn = (f: HealthFeature): boolean => state.on[f];
export const healthPromptFeature = (): HealthFeature | null => promptFor;

/** Features the person just turned off on this device, before the withdrawal record has come back (see below). */
const localOff = new Set<HealthFeature>();
let reported: HealthGateState = state;

function derive(): void {
  const on = { ...reported.on };
  for (const f of localOff) on[f] = false;
  const next: HealthGateState = { on, ready: reported.ready, answered: reported.answered };
  if (next.ready === state.ready && same(next.on, state.on) && same(next.answered, state.answered))
    return;
  state = next;
  version += 1;
  emit();
}

/** What the consent records say (`HealthConsentHost` reports it whenever they change). */
export function setHealthConsentState(next: HealthGateState): void {
  reported = next;
  derive();
}

/**
 * Withdrawing: the feature stops on THIS device at once, whatever the network does; the record follows. Like Atlas
 * (`atlas/aiConsent.ts`) so withdrawing is never harder than giving. Cleared once the records say it is not granted, or
 * when the person grants again.
 */
export function withdrawHealthLocally(f: HealthFeature): void {
  localOff.add(f);
  derive();
}
export function settleHealthLocally(f: HealthFeature): void {
  if (localOff.delete(f)) derive();
}

export function openHealthPrompt(f: HealthFeature): void {
  if (promptFor === f) return;
  promptFor = f;
  emit();
}

/** `notNow`: the person chose "Not now" (the prompt then does not come back by itself until the next visit). */
export function closeHealthPrompt(notNow = false): void {
  if (notNow && promptFor) declined.add(promptFor);
  if (promptFor === null) return;
  promptFor = null;
  emit();
}

/** The first entry into a feature may ask once per visit: never asked, not "Not now", records known, nothing else open. */
export function shouldAutoAskHealth(f: HealthFeature): boolean {
  return (
    state.ready && !state.on[f] && !state.answered[f] && !declined.has(f) && promptFor === null
  );
}

/** Tests only: every feature on and known (what the existing suites assume), or the real fail-closed start. */
export function resetHealthGateForTests(allOn = false): void {
  const on = allOn ? ALL : NONE;
  localOff.clear();
  reported = { on, ready: allOn, answered: on };
  state = reported;
  version += 1;
  promptFor = null;
  declined.clear();
  emit();
}
