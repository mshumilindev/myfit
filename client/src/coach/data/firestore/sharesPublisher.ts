/**
 * The client device publishes the derived "effects" view of the sets (plan 6.3): when `sets` is shared at the
 * `effects` level the trainer must see weekly aggregates only, never sessions. Only THIS device can produce them (the
 * server never reads the plaintext sets), so it writes `users/{me}/shares/sets` = sealed `{ category, level, asOf, v,
 * view: { lifts: [{ liftId, name, weeks }] } }`, sealed with the member's own vault key (`sealOrThrow('shares')`). The
 * trainer's device opens it with the grant and `liftsFromView` reads `view.lifts`.
 *
 * It writes nothing at `off` (the server already deleted the doc) and nothing at `full` (the trainer reads the sessions);
 * a leftover doc from an earlier `effects` level is removed. The view is rewritten only when it changed.
 */
import type { Vault } from '../../../autoVault';
import { sealOrThrow } from '../../../coachCrypto/sealOrThrow';
import type { Activity, Workout } from '../../../types';
import { DAY } from '../../domain/time';
import { HISTORY_DAYS } from '../../domain/signalConfig';
import { weeksFromSessions } from '../../domain/signalInputs';
import type { Consent } from '../../domain/types';
import type { ActivitySource } from '../../share/types';
import type { FsApi } from './fsApi';
import { activitiesForShare, plainCatalog, weeklySetsOf, type ExtrasCatalog } from './shareExtras';
import { workoutsToLifts } from './worldMap';

export interface SetsView {
  lifts: { liftId: string; name: string; weeks: ReturnType<typeof weeksFromSessions> }[];
  /** Working sets of the current week per primary muscle (a weekly aggregate, allowed at `effects`). */
  weeklySets: Record<string, number>;
}

/** What the trainer sees of the member's logged activities, only at totals `full`. */
export interface TotalsView {
  activities: ActivitySource[];
}

export function buildTotalsView(
  activities: readonly Activity[],
  now: number,
  cat: ExtrasCatalog = plainCatalog,
): TotalsView {
  return { activities: activitiesForShare(activities, now, cat) };
}

/** Pure: workouts -> the weekly view the trainer may see at `effects`. */
export function buildSetsView(
  workouts: readonly Workout[],
  now: number,
  cat: ExtrasCatalog = plainCatalog,
): SetsView {
  const cutoff = now - HISTORY_DAYS * DAY;
  const lifts = workoutsToLifts(workouts.filter((w) => w.finishedAt != null))
    .map((l) => ({
      liftId: l.liftId,
      name: l.name,
      weeks: weeksFromSessions((l.sessions ?? []).filter((s) => s.at >= cutoff)),
    }))
    .filter((l) => l.weeks.length > 0)
    .sort((a, b) => a.liftId.localeCompare(b.liftId));
  return { lifts, weeklySets: weeklySetsOf(workouts, now, cat) };
}

export interface SharesInput {
  consent: Consent;
  workouts: readonly Workout[];
  /** logged cardio / recovery activities (absent = none) */
  activities?: readonly Activity[];
}

export interface SharesPublisher {
  /** Idempotent: call on every change of the consent, the workouts or the activities. */
  sync(a: SharesInput): Promise<void>;
}

export function createSharesPublisher(d: {
  fs: FsApi;
  vault: Vault;
  uid: string;
  /** the app's catalogues (primary muscle of an exercise, icon of an activity type) */
  catalog?: ExtrasCatalog;
}): SharesPublisher {
  const cat = d.catalog ?? plainCatalog;
  /** one derived doc per category; written only at the level that earns it, only when changed, removed otherwise */
  function derived(category: 'sets' | 'totals', level: 'effects' | 'full') {
    const path = `users/${d.uid}/shares/${category}`;
    let lastJson: string | null = null; // the view last written by this device ('' = nothing there)
    return async (on: boolean, build: (now: number) => unknown): Promise<void> => {
      if (!on) {
        if (lastJson !== '') {
          const had = lastJson !== null || (await d.fs.get(path)) !== null;
          if (had) await d.fs.del(path);
          lastJson = '';
        }
        return;
      }
      if (!d.vault.materialOrNull()) return; // locked: nothing is written, the next sync retries
      const now = d.fs.now();
      const view = build(now);
      const json = JSON.stringify(view);
      if (json === lastJson) return;
      const doc = await sealOrThrow(
        'shares',
        { category, level, asOf: now, v: 1, view },
        { vault: d.vault },
      );
      await d.fs.set(path, doc);
      lastJson = json;
    };
  }
  const setsDoc = derived('sets', 'effects');
  const totalsDoc = derived('totals', 'full');
  let busy: Promise<void> = Promise.resolve();

  async function run(a: SharesInput): Promise<void> {
    await setsDoc(a.consent.sets === 'effects', (now) => buildSetsView(a.workouts, now, cat));
    // activity sessions are session-level detail: totals `full` only
    await totalsDoc(a.consent.totals === 'full', (now) =>
      buildTotalsView(a.activities ?? [], now, cat),
    );
  }

  return {
    sync(a) {
      busy = busy.then(
        () => run(a),
        () => run(a),
      );
      return busy;
    },
  };
}
