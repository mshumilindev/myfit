/**
 * The registry of features that process health data (SPO-290): feature -> consent kind, the data categories its consent
 * covers (recorded with the grant), and how its data is stored. Pure. The words live in `i18n/healthConsent.ts`; the
 * look (icon, tone) in `gateChoices.ts`. A feature is added here first, then gated: `data/healthConsentGate.ts` is the
 * one switch, `healthMask.ts` and the write paths in `store.ts` / `nutrition/store.ts` are what it controls.
 */
import { GATE_CHOICES, type GateChoice } from './gateChoices';
import {
  HEALTH_FEATURES,
  type ConsentKind,
  type HealthConsentKind,
  type HealthFeature,
} from './consents';

export interface HealthFeatureInfo {
  feature: HealthFeature;
  kind: HealthConsentKind;
  /** The data categories the consent covers (`[a-z0-9:_-]`, at most 20; the server checks the shape). */
  categories: readonly string[];
  /** Spotter seals it with the account key (`prepareWrite`); the food log is stored without Spotter's own encryption. */
  sealedBySpotter: boolean;
}

export const HEALTH_FEATURE_INFO: Readonly<Record<HealthFeature, HealthFeatureInfo>> = {
  injuries: {
    feature: 'injuries',
    kind: 'health:injuries',
    categories: ['injuries', 'rehab-checkins', 'injury-notes'],
    sealedBySpotter: true,
  },
  chronic: {
    feature: 'chronic',
    kind: 'health:chronic',
    categories: ['conditions', 'condition-severity', 'condition-dates'],
    sealedBySpotter: true,
  },
  cycle: {
    feature: 'cycle',
    kind: 'health:cycle',
    categories: ['cycle-settings', 'period-start-dates'],
    sealedBySpotter: true,
  },
  nicotine: {
    feature: 'nicotine',
    kind: 'health:nicotine',
    categories: ['nicotine-products', 'nicotine-amounts'],
    sealedBySpotter: true,
  },
  alcohol: {
    feature: 'alcohol',
    kind: 'health:alcohol',
    categories: ['alcohol-drinks', 'alcohol-servings', 'alcohol-checkins'],
    sealedBySpotter: true,
  },
  supplements: {
    feature: 'supplements',
    kind: 'health:supplements',
    categories: ['supplements', 'supplement-doses', 'supplement-checkins'],
    sealedBySpotter: true,
  },
  nutrition: {
    feature: 'nutrition',
    kind: 'health:nutrition',
    categories: ['food-log', 'custom-foods', 'nutrition-goal', 'nutrition-profile'],
    sealedBySpotter: false,
  },
};

export function healthFeatureOf(kind: ConsentKind): HealthFeature | null {
  const f = kind.startsWith('health:') ? kind.slice('health:'.length) : '';
  return (HEALTH_FEATURES as readonly string[]).includes(f) ? (f as HealthFeature) : null;
}

/** Icon and tone of a feature (one place: the legal gate's list). */
export function healthLook(f: HealthFeature): Pick<GateChoice, 'icon' | 'tone'> {
  const c = GATE_CHOICES.find((x) => x.feature === f);
  return { icon: c?.icon ?? 'heartbeat', tone: c?.tone ?? 'accent' };
}
