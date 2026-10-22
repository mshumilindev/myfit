/**
 * What each data page of "What Spotter knows about you" shows (SPO-295 N5). Pure: no React, no Firestore.
 * Every number comes from `AreaInputs`, which the screen fills from the real stores; a line whose data cannot be read on
 * this device (sealed, not loaded) has no value at all, never a guess. Words live in `i18n/myData*.ts`.
 */
import type { AreaId, DataAreaId, LineId } from '../../i18n/myData';
import type { StoreState } from '../../store';
import type { Tone } from '../../components/ui/tones';

export type { AreaId, DataAreaId, LineId };

export const AREA_ORDER: readonly AreaId[] = [
  'account',
  'training',
  'sleepbody',
  'health',
  'atlas',
  'gyms',
  'sharing',
  'chat',
  'device',
  'notifications',
  'consents',
];

export const AREA_LOOK: Record<AreaId, { icon: string; tone: Tone }> = {
  account: { icon: 'user-circle', tone: 'accent' },
  training: { icon: 'barbell', tone: 'accent' },
  sleepbody: { icon: 'moon', tone: 'sleep' },
  health: { icon: 'heartbeat', tone: 'chronic' },
  atlas: { icon: 'sparkle', tone: 'atlas' },
  gyms: { icon: 'map-pin', tone: 'accent' },
  sharing: { icon: 'users', tone: 'people' },
  chat: { icon: 'chat-circle', tone: 'people' },
  device: { icon: 'device-mobile', tone: 'accent' },
  notifications: { icon: 'bell', tone: 'accent' },
  consents: { icon: 'shield-check', tone: 'accent' },
};

/** What the screen read from the stores. Counts are exact lengths of what is loaded on this device. */
export interface AreaInputs {
  sessions: number;
  sets: number;
  activities: number;
  restPeriods: number;
  gyms: number;
  weighIns: number;
  nights: number;
  injuries: number;
  conditions: number;
  /** Whether anything is stored for the feature (raw store, whatever the consent says). */
  stored: { cycle: boolean; nicotine: boolean; alcohol: boolean; supplements: boolean };
  /** Messages in the Atlas chat on this device. */
  chat: number;
  atlasAllowed: boolean;
  geoAllowed: boolean;
  hasTrainer: boolean;
  /** This device receives reminders (`spotter.pushOn`); null = unknown. */
  pushOn: boolean | null;
}

export type LineValue =
  | { kind: 'count'; n: number }
  | { kind: 'has'; present: boolean }
  | { kind: 'on'; on: boolean }
  | { kind: 'allowed'; allowed: boolean };

export interface Line {
  id: LineId;
  value?: LineValue;
}

const n = (id: LineId, count: number): Line => ({ id, value: { kind: 'count', n: count } });
const has = (id: LineId, present: boolean): Line => ({ id, value: { kind: 'has', present } });
const plain = (id: LineId): Line => ({ id });

export function inputsFromState(
  s: Pick<
    StoreState,
    | 'workouts'
    | 'activities'
    | 'restPeriods'
    | 'gyms'
    | 'bodyMetrics'
    | 'sleeps'
    | 'injuries'
    | 'conditions'
  >,
  rest: Pick<
    AreaInputs,
    'stored' | 'chat' | 'atlasAllowed' | 'geoAllowed' | 'hasTrainer' | 'pushOn'
  >,
): AreaInputs {
  return {
    sessions: s.workouts.length,
    sets: s.workouts.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.length, 0), 0),
    activities: s.activities.length,
    restPeriods: s.restPeriods.length,
    gyms: s.gyms.length,
    weighIns: s.bodyMetrics.weights.length,
    nights: s.sleeps.length,
    injuries: s.injuries.length,
    conditions: s.conditions.length,
    ...rest,
  };
}

export function areaLines(id: DataAreaId, i: AreaInputs): Line[] {
  switch (id) {
    case 'account':
      return [plain('accProfile'), plain('accSignin'), plain('accLogs')];
    case 'training':
      return [
        n('trSessions', i.sessions),
        n('trSets', i.sets),
        n('trActivities', i.activities),
        n('trRest', i.restPeriods),
        plain('trPrograms'),
      ];
    case 'sleepbody':
      return [n('sbWeighIns', i.weighIns), n('sbNights', i.nights), plain('sbNutrition')];
    case 'health':
      return [
        n('hInjuries', i.injuries),
        n('hConditions', i.conditions),
        has('hCycle', i.stored.cycle),
        has('hNicotine', i.stored.nicotine),
        has('hAlcohol', i.stored.alcohol),
        has('hSupplements', i.stored.supplements),
      ];
    case 'atlas':
      return [
        n('atChat', i.chat),
        { id: 'atAi', value: { kind: 'allowed', allowed: i.atlasAllowed } },
      ];
    case 'gyms':
      return [
        n('gyGyms', i.gyms),
        plain('gyVisits'),
        { id: 'gySearch', value: { kind: 'allowed', allowed: i.geoAllowed } },
      ];
    case 'sharing':
      return [has('shTrainer', i.hasTrainer), plain('shSee')];
    case 'chat':
      return [plain('chMessages')];
    case 'notifications':
      return [
        i.pushOn === null
          ? plain('noDevice')
          : { id: 'noDevice', value: { kind: 'on', on: i.pushOn } },
      ];
  }
}

/** The health features that have something stored and can be deleted through the existing two-step prompt. */
const DELETABLE_HEALTH = [
  'injuries',
  'chronic',
  'cycle',
  'nicotine',
  'alcohol',
  'supplements',
] as const;
export type DeletableHealth = (typeof DELETABLE_HEALTH)[number];

export function storedHealth(i: AreaInputs): DeletableHealth[] {
  return DELETABLE_HEALTH.filter((f) => {
    if (f === 'injuries') return i.injuries > 0;
    if (f === 'chronic') return i.conditions > 0;
    return i.stored[f];
  });
}
