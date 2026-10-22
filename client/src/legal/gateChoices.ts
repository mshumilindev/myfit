/**
 * The optional consents offered in drawer 2 of the legal gate (SPO-295 N12). Pure plus one small localStorage flag:
 * no React, no Firestore. Nothing here is ever on by default.
 */
import type { Tone } from '../components/ui/tones';
import {
  HEALTH_FEATURES,
  currentVersion,
  type ConsentKind,
  type ConsentRecord,
  type HealthFeature,
} from './consents';
import type { QueuedConsent } from './signupConsents';

export type GateGroup = 'atlas' | 'health' | 'outside';

export interface GateChoice {
  kind: ConsentKind;
  group: GateGroup;
  icon: string;
  tone: Tone;
  /** The feature a health consent belongs to (selects its words). */
  feature?: HealthFeature;
}

const HEALTH_LOOK: Record<HealthFeature, { icon: string; tone: Tone }> = {
  injuries: { icon: 'bandaids', tone: 'injury' },
  chronic: { icon: 'heartbeat', tone: 'chronic' },
  cycle: { icon: 'drop', tone: 'apex' },
  nicotine: { icon: 'flame', tone: 'illness' },
  alcohol: { icon: 'wine', tone: 'kcal' },
  supplements: { icon: 'pill', tone: 'accent' },
  nutrition: { icon: 'fork-knife', tone: 'ok' },
};

/** Every optional consent, in the order drawer 2 lists them. */
export const GATE_CHOICES: readonly GateChoice[] = [
  { kind: 'atlas-ai', group: 'atlas', icon: 'sparkle', tone: 'atlas' },
  ...HEALTH_FEATURES.map((f): GateChoice => ({
    kind: `health:${f}`,
    group: 'health',
    feature: f,
    ...HEALTH_LOOK[f],
  })),
  { kind: 'geo-search', group: 'outside', icon: 'map-pin', tone: 'accent' },
];

/**
 * What an Atlas AI grant covers: the groups of facts `atlas/chatFacts.ts` (`buildChatFacts`) puts in the request today,
 * not one more (recent sessions and lifts, plan, the notes and what the athlete told Atlas, non-gym activities, injured
 * muscles, de-identified training limits of long-term conditions, last night's sleep length, body weight). The question
 * itself is not a category. Keep in step with `buildChatFacts` (and the data registry row D13) when that changes: every key of
 * the facts is mapped to one of these in `FACT_CATEGORY` (atlas/chatFacts.ts) and `chatFacts.consent.test.ts` fails on a mismatch.
 */
export const ATLAS_AI_CATEGORIES = [
  'workouts',
  'plan',
  'notes',
  'activities',
  'injured-muscles',
  'training-limits',
  'sleep',
  'bodyweight',
] as const;
export type AtlasAiCategory = (typeof ATLAS_AI_CATEGORIES)[number];
export const ATLAS_AI_ENGINES = ['gemini'] as const;
/** The backup engine has its own consent (`atlas-puter`) and sends the same categories. */
export const ATLAS_PUTER_ENGINES = ['puter'] as const;

/**
 * Consents that are NOT recorded from the short sentence of drawer 2: they open their own full prompt (Atlas AI chat:
 * `atlas/AtlasConsentPrompt`, gym search: the geo prompt of `legal/GeoConsentHost`), which records the grant itself once
 * the person accepts it there. Declining there leaves the feature off.
 */
export const PROMPTED_KINDS: readonly ConsentKind[] = ['atlas-ai', 'geo-search'];

/**
 * The grants recorded straight from drawer 2: the switches that are ON, except the prompted kinds above (and only those
 * on), at the version of the text the person saw. Health keeps the short sentence until SPO-290 defines its prompts.
 */
export function choiceGrants(on: ReadonlySet<ConsentKind>): QueuedConsent[] {
  return GATE_CHOICES.filter((c) => on.has(c.kind) && !PROMPTED_KINDS.includes(c.kind)).map(
    (c) => ({
      kind: c.kind,
      version: currentVersion(c.kind),
    }),
  );
}

/** The person already has an answer (granted or withdrawn) for one of these: drawer 2 has nothing to ask. */
export function hasOptionalRecord(records: readonly ConsentRecord[]): boolean {
  return records.some((r) => GATE_CHOICES.some((c) => c.kind === r.kind));
}

export const CHOICES_SHOWN_KEY = 'spotter.consentChoicesShown';

function shownUids(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CHOICES_SHOWN_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Drawer 2 was already shown to this account on this device. Only account ids are stored, no personal data. */
export function choicesShown(uid: string): boolean {
  return shownUids().includes(uid);
}

export function markChoicesShown(uid: string): void {
  try {
    const all = shownUids();
    if (!all.includes(uid)) localStorage.setItem(CHOICES_SHOWN_KEY, JSON.stringify([...all, uid]));
  } catch {
    /* storage unavailable: drawer 2 may show once more; it never blocks anything */
  }
}
