/**
 * The real `ShareSourcePort` (plan 10.1 / 10.3): what a chat share card is resolved from. A message carries only a typed
 * `ShareRef`; the card is built at render time from THIS source, which is cut by the READER's access, so a card can never
 * widen it.
 *
 *   library   the bundled exercise and equipment catalogues (no network) + the gyms the app passes in (`gyms`: a gym's
 *             name and city live in the member's own gyms; `sharedGyms/*` only holds the crowdsourced equipment list).
 *   programs  trainer: `programs where authorId == me` (+ `plans/{client}.programId` for who it is assigned to);
 *             client: the one assigned program (`plans/{me}` -> `programs/{id}`, readable through `assignments`).
 *   clients   trainer: ONLY the thread's client, read through `coachRead(totals, sets, via 'chat-share')` which the
 *             server cuts by consent and audits; sealed parts are opened with the client's grant on this device.
 *             client: the member's own workouts from the app store (`own`), never anything about anybody else.
 *   extras    activities (sessions of cardio / recovery): totals `full` only, a sealed view the member's device publishes
 *             (`shares/totals`) and the server hands over inside the `totals` category with the grant. Sets per muscle
 *             this week: derived from the opened workouts at `full`, read from the sealed weekly view at `effects`.
 *             Trainer days: the live version of the shared plan (opened with the conversation key ring), for a member
 *             without an in-app trainer their own marker (`selfCoach`). Consent never gates trainer days: they are the
 *             trainer's own plan.
 * Offline: `load` rejects, `peek` keeps the last good snapshot in memory (the sealed cache is the caller's `cache`).
 */
import type { Vault } from '../../../autoVault';
import { unsealDoc } from '../../../encryptedDoc';
import type { Activity, Workout } from '../../../types';
import type { ChatKeyRing } from '../../../coachCrypto/conversationKey';
import { openSealed } from '../../../coachCrypto/sealOrThrow';
import { openPlan, openVersion } from '../../program/planCodec';
import { openAthleteKey } from '../../../vaultGrants';
import type { CoachKeyRecord } from '../../../vaultShare';
import { dayItems, dayName, trainingDays, type Program } from '../../../views/programs/model';
import { DOWS, type Category, type Consent, type Dow } from '../../domain/types';
import { ALL_OFF } from '../../domain/consent';
import type { LiftSeries } from '../../domain/signalInputs';
import { catalogEquipment, catalogExercises } from '../../share/library';
import type { ShareSourcePort } from '../../share/port';
import type {
  ActivitySource,
  ClientShareData,
  LibGym,
  ProgDay,
  ProgramSource,
  ResultSource,
  ShareSource,
  WorkoutSource,
} from '../../share/types';
import { toPortError } from './errors';
import {
  activitiesForShare,
  activitiesFromView,
  cleanDows,
  onTrainerDay,
  weeklySetsFromView,
  plainCatalog,
  weeklySetsOf,
  type ExtrasCatalog,
} from './shareExtras';
import type { FsApi, Raw } from './fsApi';
import {
  liftsFromView,
  workoutsToLifts,
  type ReadCategory,
  type Roster,
  type RosterClient,
} from './worldMap';

export interface ShareSourceDeps {
  fs: FsApi;
  vault: Vault;
  side: 'trainer' | 'client';
  /** the signed-in user */
  uid: string;
  loadOwnCoachKey?: () => Promise<CoachKeyRecord | null>;
  /** the app's own gyms as library entries (name, city, equipment) */
  gyms?: () => readonly LibGym[];
  /** client side: the member's own finished workouts */
  own?: () => readonly Workout[];
  /** client side: first name shown on the member's own cards */
  ownName?: () => string;
  /** client side: the member's own finished activities */
  ownActivities?: () => readonly Activity[];
  /** the app's catalogues (primary muscle, activity icon); absent = the exercise's own `primaryMuscle` only */
  catalog?: ExtrasCatalog;
  /** the conversation key rings (ring book): needed to open the plan's trainer days */
  plan?: {
    ringFor(clientId: string): ChatKeyRing | null;
    ringForEpoch?(clientId: string, epoch: number): ChatKeyRing | null;
    ready(): Promise<void>;
  };
}

interface ReadResponse {
  results: Partial<Record<Category, ReadCategory>>;
  grant: unknown;
}

const ROSTER_TTL = 60_000;
const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? '';
const dowOf = (day: number): Dow | undefined => DOWS[day - 1];

/** Pure: a stored program -> what the share cards show. */
export function programToSource(p: Program, assignedTo: readonly string[]): ProgramSource {
  const days: ProgDay[] = trainingDays(p).map((day) => {
    const items = dayItems(p, day).filter((i) => i.kind === 'strength');
    const muscles = p.targetMuscles?.[String(day)] ?? [];
    return {
      name: dayName(p, day) || `Day ${day}`,
      wd: dowOf(day),
      ...(items.length
        ? {
            rows: items.map((i) => ({
              name: i.name,
              sets: i.bare ? 0 : i.sets,
              ...(i.reps > 0 && !i.bare ? { reps: String(i.reps) } : {}),
              ...(i.targetWeight ? { kg: String(i.targetWeight) } : {}),
            })),
          }
        : muscles.length
          ? { muscles: [...muscles] }
          : {}),
    };
  });
  return {
    id: p.id,
    name: p.name,
    weeks: p.weeks,
    days,
    assignedTo: [...assignedTo],
  };
}

const bestSet = (w: Workout, name: string): string | undefined => {
  const ex = w.exercises.find((e) => e.name === name);
  const work = (ex?.sets ?? []).filter((s) => !s.isWarmup && (s.weight ?? 0) > 0);
  const top = work.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0];
  return top ? `${top.weight}x${top.reps}` : undefined;
};

/** Pure: opened workouts -> the share model of one person. */
export function clientShareData(i: {
  clientId: string;
  firstName: string;
  mode: ClientShareData['mode'];
  consent: Consent;
  workouts?: readonly Workout[];
  lifts?: readonly LiftSeries[];
  /** opened activity view (totals `full`) or the member's own list */
  activities?: readonly ActivitySource[];
  /** sets per muscle this week from the sealed weekly view (sets `effects`); `full` derives it from the workouts */
  weeklySets?: Readonly<Record<string, number>>;
  trainerDays?: readonly Dow[];
  catalog?: ExtrasCatalog;
  now: number;
}): ClientShareData {
  const trainerDays = i.trainerDays ?? [];
  const done = (i.workouts ?? []).filter((w) => w.finishedAt != null);
  const workouts: WorkoutSource[] = done
    .map((w) => {
      const sets = w.exercises.flatMap((e) =>
        (e.sets ?? []).filter((s) => !s.isWarmup && s.type !== 'warmup'),
      );
      return {
        id: w.id,
        at: w.startedAt,
        title: w.dayName ?? '',
        minutes: Math.max(1, Math.round(((w.finishedAt as number) - w.startedAt) / 60_000)),
        sets: sets.length,
        tonnageKg: Math.round(sets.reduce((a, s) => a + (s.weight ?? 0) * s.reps, 0)),
        withTrainer: onTrainerDay(w.startedAt, trainerDays),
        rows: w.exercises
          .map((e) => ({ name: e.name, top: bestSet(w, e.name) ?? '' }))
          .filter((r) => r.top),
      };
    })
    .sort((a, b) => b.at - a.at);

  const lifts: readonly LiftSeries[] = i.lifts ?? (done.length ? workoutsToLifts(done) : []);
  const results: ResultSource[] = lifts
    .map((l) => {
      const weeks = l.weeks ?? [];
      const series = weeks.map((w) => w.bestE1rm).slice(-12);
      if (!series.length) return null;
      const last = series[series.length - 1];
      const prior = weeks.filter(
        (w) => w.weekStart <= (weeks[weeks.length - 1]?.weekStart ?? 0) - 28 * 86_400_000,
      );
      const base = prior.length ? prior[prior.length - 1].bestE1rm : series[0];
      const top = [...(l.sessions ?? [])].sort((a, b) => b.e1rm - a.e1rm)[0];
      return {
        id: l.liftId,
        name: l.name,
        series,
        best: top?.setsText?.split(',')[0]?.trim() ?? '',
        e1rm: last,
        change: Math.round((last - base) * 10) / 10,
        sessions: l.sessions?.length ?? weeks.length,
      } satisfies ResultSource;
    })
    .filter((r): r is ResultSource => r !== null);
  return {
    clientId: i.clientId,
    firstName: i.firstName,
    mode: i.mode,
    consent: i.consent,
    workouts: i.consent.sets === 'full' || i.consent.totals === 'full' ? workouts : [],
    // session-level detail: totals `full` only (the adapter already cut by level; this gates again)
    activities: i.consent.totals === 'full' ? [...(i.activities ?? [])] : [],
    results,
    // a weekly aggregate: any sets level; at `full` the workouts give it, at `effects` the sealed weekly view
    weeklySets:
      i.consent.sets === 'off'
        ? {}
        : i.consent.sets === 'full' && done.length
          ? weeklySetsOf(done, i.now, i.catalog ?? plainCatalog)
          : { ...(i.weeklySets ?? {}) },
    trainerDays: [...trainerDays],
  };
}

export function createFirestoreShareSource(d: ShareSourceDeps): ShareSourcePort {
  const { fs } = d;
  const cache = new Map<string, ShareSource>();
  let roster: { at: number; r: Roster } | null = null;

  const getRoster = async (): Promise<Roster> => {
    if (roster && fs.now() - roster.at < ROSTER_TTL) return roster.r;
    const r = await fs.call<Roster>('coachClients', {});
    roster = { at: fs.now(), r };
    return r;
  };

  /** Trainer days of a member from the LIVE version of their plan (sealed with the conversation key ring). */
  async function planTrainerDays(clientId: string): Promise<Dow[]> {
    if (!d.plan) return [];
    try {
      await d.plan.ready();
      const cur = d.plan.ringFor(clientId);
      if (!cur) return [];
      const ringAt = (epoch: unknown): ChatKeyRing | null =>
        !Number.isInteger(epoch) || epoch === cur.epoch
          ? cur
          : (d.plan?.ringForEpoch?.(clientId, epoch as number) ?? null);
      const raw = await fs.get(`plans/${clientId}`);
      const pr = raw ? ringAt(raw.keyEpoch) : null;
      if (!raw || !pr || typeof raw.trainerId !== 'string') return [];
      const plan = await openPlan({ vault: d.vault, ring: pr }, clientId, raw);
      if (plan.liveVersion < 1) return [];
      const vraw = await fs.get(`plans/${clientId}/versions/${plan.liveVersion}`);
      const vr = vraw ? ringAt(vraw.keyEpoch) : null;
      if (!vraw || !vr || vraw.state !== 'live') return cleanDows(plan.trainerDays);
      return cleanDows(
        (await openVersion({ vault: d.vault, ring: vr }, clientId, raw.trainerId, vraw))
          .trainerDays,
      );
    } catch {
      return [];
    }
  }

  /** A member without an in-app trainer marks their own coach days (sealed with their vault key). */
  async function selfCoachDays(): Promise<Dow[]> {
    try {
      const raw = await fs.get(`users/${d.uid}/meta/selfCoach`);
      if (!raw) return [];
      const doc = await openSealed<Record<string, unknown>>('selfCoach', raw, { vault: d.vault });
      return cleanDows(doc.days);
    } catch {
      return [];
    }
  }

  const library = () => ({
    exercises: catalogExercises(),
    equipment: catalogEquipment(),
    gyms: d.gyms?.() ?? [],
  });

  async function trainerPrograms(active: RosterClient[]): Promise<ProgramSource[]> {
    const rows = await fs.getDocs('programs', { where: [['authorId', '==', d.uid]] });
    const assigned = new Map<string, string[]>();
    await Promise.all(
      active.map(async (c) => {
        const plan = await fs.get(`plans/${c.clientId}`).catch(() => null);
        const pid = typeof plan?.programId === 'string' ? plan.programId : null;
        if (pid) assigned.set(pid, [...(assigned.get(pid) ?? []), c.clientId]);
      }),
    );
    // `prg-{client}-{n}` documents are the runnable copies of coached plans (one per version): only the one a plan
    // points at is a program the trainer can share; the older ones are not templates
    return rows
      .filter((r) => !r.id.startsWith('prg-') || assigned.has(r.id))
      .map((r) =>
        programToSource({ ...(r.data as unknown as Program), id: r.id }, assigned.get(r.id) ?? []),
      );
  }

  async function clientProgram(): Promise<ProgramSource[]> {
    const plan = await fs.get(`plans/${d.uid}`).catch(() => null);
    const pid = typeof plan?.programId === 'string' ? plan.programId : null;
    if (!pid) return [];
    const doc = await fs.get(`programs/${pid}`).catch(() => null);
    return doc ? [programToSource({ ...(doc as unknown as Program), id: pid }, [d.uid])] : [];
  }

  async function trainerClient(c: RosterClient, now: number): Promise<ClientShareData> {
    const trainerDays = await planTrainerDays(c.clientId);
    const cats = (['totals', 'sets'] as const).filter((k) => c.consent[k] !== 'off');
    if (c.mode === 'program' || !cats.length)
      return clientShareData({
        clientId: c.clientId,
        firstName: firstName(c.name),
        mode: c.mode,
        consent: c.consent,
        trainerDays,
        catalog: d.catalog,
        now,
      });
    const res = await fs.call<ReadResponse>('coachRead', {
      clientId: c.clientId,
      categories: cats,
      via: 'chat-share',
    });
    const sets = res.results.sets;
    const totals = res.results.totals;
    const sealed: Raw[] = [
      ...(sets?.state === 'ok' ? (sets.docs ?? []) : []),
      ...(totals?.state === 'ok' && totals.level === 'full' ? (totals.extras ?? []) : []),
    ];
    let workouts: Workout[] | undefined;
    let lifts: LiftSeries[] | undefined;
    let weeklySets: Record<string, number> | undefined;
    let activities: ActivitySource[] | undefined;
    if (sealed.length && d.loadOwnCoachKey) {
      const key = await openAthleteKey(d.vault, res.grant, { loadOwnCoachKey: d.loadOwnCoachKey });
      if (key) {
        const open = async (raws: readonly Raw[] | undefined) => {
          const out: Raw[] = [];
          for (const raw of raws ?? []) {
            try {
              out.push(await unsealDoc<Raw>(raw, key.key));
            } catch {
              /* does not open */
            }
          }
          return out;
        };
        if (sets?.state === 'ok' && sets.docs?.length) {
          const out = await open(sets.docs);
          if (sets.level === 'full') workouts = out as unknown as Workout[];
          else {
            const view = (out[0] as { view?: unknown } | undefined)?.view;
            lifts = liftsFromView(view);
            weeklySets = weeklySetsFromView(view);
          }
        }
        if (totals?.state === 'ok' && totals.level === 'full' && totals.extras?.length) {
          const out = await open(totals.extras);
          activities = activitiesFromView((out[0] as { view?: unknown } | undefined)?.view);
        }
      }
    }
    return clientShareData({
      clientId: c.clientId,
      firstName: firstName(c.name),
      mode: c.mode,
      consent: c.consent,
      workouts,
      lifts,
      activities,
      weeklySets,
      trainerDays,
      catalog: d.catalog,
      now,
    });
  }

  async function build(clientId: string): Promise<ShareSource> {
    const now = fs.now();
    if (d.side === 'client') {
      const ownTrainerDays = await planTrainerDays(d.uid);
      const me = clientShareData({
        clientId: d.uid,
        firstName: firstName(d.ownName?.() ?? ''),
        mode: 'app',
        consent: Object.fromEntries(
          Object.keys(ALL_OFF).map((k) => [k, 'full']),
        ) as unknown as Consent,
        workouts: d.own?.() ?? [],
        activities: activitiesForShare(d.ownActivities?.() ?? [], now, d.catalog ?? plainCatalog),
        trainerDays: ownTrainerDays.length ? ownTrainerDays : await selfCoachDays(),
        catalog: d.catalog,
        now,
      });
      return {
        now,
        library: library(),
        programs: await clientProgram(),
        clients: { [d.uid]: me },
      };
    }
    const r = await getRoster();
    const active = r.clients.filter((c) => c.status === 'active');
    const programs = await trainerPrograms(active);
    const c = active.find((x) => x.clientId === clientId);
    const clients: Record<string, ClientShareData> = {};
    if (c) clients[c.clientId] = await trainerClient(c, r.serverTime);
    return { now: r.serverTime, library: library(), programs, clients };
  }

  return {
    peek: (clientId) => cache.get(clientId) ?? null,
    async load(clientId, { signal }) {
      try {
        const s = await build(clientId);
        if (signal.aborted) throw new Error('aborted');
        cache.set(clientId, s);
        return s;
      } catch (e) {
        throw toPortError(e);
      }
    },
  };
}
