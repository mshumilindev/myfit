/**
 * The store's on-device copy of the person's own data, sealed (SPO-216; mechanics in `sealedState.ts`).
 *
 * Sealed fields: workouts, gyms, rest periods, injuries, activities, sleeps (+ schedule and settings), body metrics,
 * goals, home sets, mastery and the Atlas settings. Unit/rest preferences and the shared-gym cache hold no personal
 * entries and stay as they were.
 *
 * Generic over the store state `S` and handed its few runtime dependencies (`vault`, the empty documents and the coach
 * normaliser) by `store.ts`, so this module imports nothing that imports the store back.
 */
import type { Vault } from './autoVault';
import { createSealedState, mergeById, mergeSingleton, type SealedField } from './sealedState';

const KEYS = {
  workouts: 'spotter.state',
  gyms: 'spotter.gyms',
  restPeriods: 'spotter.restPeriods',
  injuries: 'spotter.injuries',
  activities: 'spotter.activities',
  sleeps: 'spotter.sleeps',
  sleepSchedule: 'spotter.sleep.schedule',
  sleepSettings: 'spotter.sleep.settings',
  bodyMetrics: 'spotter.body',
  goals: 'spotter.goals',
  home: 'spotter.home',
  mastery: 'spotter.mastery',
  coach: 'spotter.coach',
} as const;
export type SealedName = keyof typeof KEYS;

type Stamped = { updatedAt?: number };
type Shape<S> = { [K in SealedName]: S[K & keyof S] };

export interface StoreSealed<S> {
  fields: { [K in SealedName]: SealedField<Shape<S>[K]> };
  /** Boot: tell every field the value it started from (loaded from the legacy plaintext copy, if any). */
  boot(state: Shape<S>): void;
  /** Persist what changed. `injuries` only while its consent is on (or a delete empties it): the caller says so. */
  persist(state: Shape<S>, injuriesOn: boolean): void;
  /** Sign-out / reset: both the sealed and the legacy copy of every field. */
  clear(): void;
  /** Firestore delivered the truth for `name`: the on-device copy must not override it any more. */
  markRemote(name: SealedName): void;
  /** When the vault key is here: open each sealed copy and merge it into the live state. */
  hydrate(get: () => Shape<S>, apply: (patch: Partial<Shape<S>>) => void): void;
}

export function createStoreSealed<S>(deps: {
  vault: Pick<Vault, 'materialOrNull'>;
  emptyGoals: object;
  emptyHome: object;
  /** Stored coach settings → current shape (lives in the store). */
  coachFrom: (raw: never) => Shape<S>['coach'];
}): StoreSealed<S> {
  type Sh = Shape<S>;
  const sealed = createSealedState({ vault: deps.vault });
  const byId = <K extends SealedName>(name: K) =>
    sealed.field<Sh[K]>({
      key: KEYS[name],
      merge: (cur, stored, ctx) =>
        mergeById(cur as { id: string }[], stored, ctx) as unknown as Sh[K],
    });
  const singleton = <K extends SealedName>(name: K, normalize?: (raw: unknown) => Sh[K]) =>
    sealed.field<Sh[K]>({
      key: KEYS[name],
      merge: (cur, stored, ctx) =>
        mergeSingleton(
          cur as Stamped,
          stored,
          ctx,
          normalize as ((raw: unknown) => Stamped) | undefined,
        ) as Sh[K],
    });

  const fields: StoreSealed<S>['fields'] = {
    workouts: byId('workouts'),
    gyms: byId('gyms'),
    restPeriods: byId('restPeriods'),
    injuries: byId('injuries'),
    activities: byId('activities'),
    sleeps: byId('sleeps'),
    sleepSchedule: singleton('sleepSchedule'),
    sleepSettings: singleton('sleepSettings'),
    bodyMetrics: singleton('bodyMetrics', (raw) => {
      const b = raw as { weights?: unknown[] };
      return { ...b, weights: b.weights ?? [] } as unknown as Sh['bodyMetrics'];
    }),
    goals: singleton('goals', (raw) => ({ ...deps.emptyGoals, ...(raw as object) }) as Sh['goals']),
    home: singleton('home', (raw) => ({ ...deps.emptyHome, ...(raw as object) }) as Sh['home']),
    mastery: singleton('mastery', (raw) => {
      const m = raw as {
        sinceYear?: number | null;
        pattern?: string | null;
        seenRating?: number | null;
        updatedAt?: number;
      };
      return {
        sinceYear: m.sinceYear ?? null,
        pattern: m.pattern ?? null,
        seenRating: m.seenRating ?? null,
        updatedAt: m.updatedAt,
      } as Sh['mastery'];
    }),
    coach: singleton('coach', (raw) => deps.coachFrom(raw as never)),
  };

  const NAMES = Object.keys(KEYS) as SealedName[];
  const each = (f: <K extends SealedName>(name: K, field: SealedField<Sh[K]>) => void) =>
    NAMES.forEach((n) => f(n, fields[n]));

  return {
    fields,
    boot: (state) => each((n, f) => f.boot(state[n])),
    persist(state, injuriesOn) {
      each((n, f) => {
        if (n === 'injuries' && !injuriesOn) return;
        f.persist(state[n]);
      });
    },
    clear: () => each((_n, f) => f.clear()),
    markRemote: (name) => fields[name].markRemote(),
    hydrate(get, apply) {
      each((n, f) => {
        void f
          .hydrate(get()[n])
          .then((next) => {
            if (next) apply({ [n]: next } as Partial<Sh>);
          })
          .catch(() => undefined);
      });
    },
  };
}
