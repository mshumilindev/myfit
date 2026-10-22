/**
 * Whether Atlas may send anything to an AI provider (SPO-286). Pure plus one tiny in-memory override: no React,
 * no Firestore. The ONE source of truth is the consent records (`optionalConsentOn`): the old boolean
 * `coach.chatConsent` is no longer read anywhere, so a person who only ever had that flag counts as NOT consenting and is
 * asked again (no silent migration of an old consent).
 *
 * Every call that sends data to a provider (`askAtlas`, `classifyTopic`, `askPuter`, `puterReady`, `puterSignIn`) takes an
 * `AiGrant` and refuses without one, so the network is never reached by mistake.
 */
import { localOffKinds } from '../legal/localOff';
import { optionalConsentOn, type ConsentKind, type ConsentRecord } from '../legal/consents';

export type AiEngine = 'gemini' | 'puter';

/** Proof that the person consented to this engine right now. Only `grantFor` makes one. */
export interface AiGrant {
  readonly engine: AiEngine;
}

export interface AiState {
  /** Atlas AI chat (Google Gemini) is on. */
  gemini: boolean;
  /** The backup engine (Puter) is on: its own consent, and only while the AI chat itself is on. */
  puter: boolean;
}

export const AI_KIND: Record<AiEngine, ConsentKind> = { gemini: 'atlas-ai', puter: 'atlas-puter' };

/** The state the consent records say: granted at the current version and not withdrawn. No record = off. */
function aiStateOf(records: readonly ConsentRecord[]): AiState {
  const gemini = optionalConsentOn(records, 'atlas-ai');
  return { gemini, puter: gemini && optionalConsentOn(records, 'atlas-puter') };
}

export function grantFor(state: AiState, engine: AiEngine): AiGrant | null {
  return state[engine] ? { engine } : null;
}

type Override = Partial<AiState>;
let override: Override = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * What this device just did, before the server-confirmed record arrives: a withdrawal stops sending at once (also
 * offline, or when the write failed), a grant lets the pending question go. Dropped as soon as the records agree.
 */
export function setAiOverride(engine: AiEngine, on: boolean): void {
  override = { ...override, [engine]: on };
  if (!on && engine === 'gemini') override.puter = false;
  emit();
}

export function subscribeAiOverride(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export const getAiOverride = (): Override => override;

/** Records plus the local override; the override is forgotten once the records say the same thing. */
export function effectiveAiState(records: readonly ConsentRecord[], ov: Override): AiState {
  const base = aiStateOf(records);
  const gemini = ov.gemini ?? base.gemini;
  return { gemini, puter: gemini && (ov.puter ?? base.puter) };
}

let overrideUid: string | null = null;
/**
 * Whose choice the override is: a different account never inherits it. Safe to call during render (it never notifies
 * listeners; every reader of an account switch re-renders anyway).
 */
export function bindAiOverrideUid(uid: string | null): void {
  if (overrideUid === uid) return;
  if (overrideUid !== null) override = {};
  overrideUid = uid;
  // A withdrawal made on this device that the server may not have yet (kept across a reload) keeps it off.
  const stopped = localOffKinds(uid);
  if (stopped.includes(AI_KIND.gemini)) override = { ...override, gemini: false, puter: false };
  else if (stopped.includes(AI_KIND.puter)) override = { ...override, puter: false };
}

/** Test and sign-out reset. `notify: false` for a reset made during render (no listener may be updated then). */
export function resetAiOverride(notify = true): void {
  override = {};
  if (notify) emit();
}

/**
 * Drops override entries the records now settle. An entry equal to the records is redundant. A `true` entry is also
 * dropped when `confirmed` (the server answered) and the records say off: the consent was withdrawn on another device
 * or is stale, and an unconfirmed local grant must not outlive that. A `false` entry survives until the records catch
 * up (a withdrawal must never be undone by a stale snapshot). Returns true when something was dropped.
 */
export function settleAiOverride(records: readonly ConsentRecord[], confirmed = false): boolean {
  const base = aiStateOf(records);
  let changed = false;
  const next: Override = { ...override };
  for (const k of ['gemini', 'puter'] as const) {
    const v = next[k];
    if (v === undefined) continue;
    if (v === base[k] || (v && confirmed && !base[k])) {
      delete next[k];
      changed = true;
    }
  }
  if (changed) {
    override = next;
    emit();
  }
  return changed;
}
