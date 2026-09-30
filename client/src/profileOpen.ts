/**
 * Coach-side: open a `profileUser` payload whose documents are vault-sealed.
 *
 * The server can only compute what is readable in the open (counts, totals from `stats`).
 * With the athlete's grant this device decrypts the history and rebuilds the detail the
 * server could not: recent sessions with names, per-gym stats, top exercises.
 * A payload without a grant (or one the coach cannot open) passes through unchanged.
 */
import { unsealDoc } from './encryptedDoc';
import type { Vault } from './vault';
import { openAthleteKey } from './vaultGrants';
import type { CoachKeyRecord } from './vaultShare';
import type { Exercise, Gym, Workout } from './types';

type Raw = Record<string, unknown>;

interface Payload {
  viewer?: { relation?: string };
  grant?: unknown;
  history?: {
    workouts?: Raw[];
    activities?: Raw[];
    sleeps?: Raw[];
    restPeriods?: Raw[];
  };
  sealedGyms?: Raw[];
  bodyMetrics?: Raw | null;
  sessions?: unknown;
  topExercises?: unknown;
  gyms?: unknown;
  summary?: Record<string, unknown>;
}

const isStrength = (e: Exercise) => (e.kind ?? 'strength') === 'strength';
const DAY = 86_400_000;

export interface DeriveDeps {
  exerciseVolumeKg(e: Exercise): number;
  workoutVolumeKg(w: Workout): number;
}

export function deriveSessions(workouts: Workout[], gyms: Gym[], d: DeriveDeps) {
  const gymById = new Map(gyms.map((g) => [g.id, g]));
  return workouts.slice(0, 30).map((w) => {
    const strength = w.exercises.filter(isStrength);
    const gym = w.gymId ? gymById.get(w.gymId) : undefined;
    return {
      id: w.id,
      startedAt: w.startedAt,
      finishedAt: w.finishedAt,
      autoFinished: !!w.autoFinished,
      live: w.finishedAt === null,
      durationMs: w.finishedAt ? w.finishedAt - w.startedAt : null,
      gymId: gym?.id ?? null,
      gymName: gym?.name ?? null,
      dayName: w.dayName ?? null,
      sets: strength.reduce((n, e) => n + e.sets.length, 0),
      exercises: strength.length,
      volumeKg: d.workoutVolumeKg(w),
      exerciseNames: [...w.exercises]
        .map((e, i) => ({ e, i }))
        .sort((a, b) => (a.e.position ?? a.i) - (b.e.position ?? b.i))
        .slice(0, 4)
        .map((x) => x.e.name),
    };
  });
}

export function deriveGyms(workouts: Workout[], gyms: Gym[], d: DeriveDeps) {
  return gyms
    .map((g) => {
      const mine = workouts.filter((w) => w.gymId === g.id);
      return {
        id: g.id,
        name: g.name,
        favorite: g.favorite ? 1 : 0,
        lat: g.lat,
        lng: g.lng,
        radiusM: g.radiusM,
        sessions: mine.length,
        lastSessionAt: mine.reduce<number | null>(
          (m, w) => (m === null ? w.startedAt : Math.max(m, w.startedAt)),
          null,
        ),
        volumeKg: mine.reduce((v, w) => v + d.workoutVolumeKg(w), 0),
      };
    })
    .sort(
      (a, b) => b.sessions - a.sessions || b.favorite - a.favorite || a.name.localeCompare(b.name),
    )
    .slice(0, 20);
}

export function deriveTopExercises(workouts: Workout[], d: DeriveDeps) {
  const map = new Map<
    string,
    {
      name: string;
      sets: number;
      sessions: Set<string>;
      lastAt: number;
      volumeKg: number;
      bestE1rm: number | null;
    }
  >();
  for (const w of workouts)
    for (const e of w.exercises) {
      if (!isStrength(e)) continue;
      const key = e.name.toLowerCase();
      const a = map.get(key) ?? {
        name: e.name,
        sets: 0,
        sessions: new Set<string>(),
        lastAt: 0,
        volumeKg: 0,
        bestE1rm: null,
      };
      a.volumeKg += d.exerciseVolumeKg(e);
      for (const s of e.sets) {
        a.sets++;
        const warm = s.isWarmup || (s as { type?: string }).type === 'warmup';
        if (!warm && (s.weight ?? 0) > 0 && s.reps >= 1 && s.reps <= 10)
          a.bestE1rm = Math.max(a.bestE1rm ?? 0, (s.weight ?? 0) * (1 + s.reps / 30));
      }
      a.sessions.add(w.id);
      a.lastAt = Math.max(a.lastAt, w.startedAt);
      map.set(key, a);
    }
  return [...map.values()]
    .filter((a) => a.sets > 0)
    .sort((a, b) => b.volumeKg - a.volumeKg || b.sets - a.sets)
    .slice(0, 8)
    .map((a) => ({ ...a, sessions: a.sessions.size }));
}

/** Fields the server could not compute from sealed workouts, recomputed here. */
export function deriveSummaryExtras(workouts: Workout[], now = Date.now()) {
  const names = new Set<string>();
  let cardioMinutes = 0;
  let durationMs = 0;
  for (const w of workouts) {
    if (w.finishedAt) durationMs += w.finishedAt - w.startedAt;
    for (const e of w.exercises) {
      if (isStrength(e)) names.add(e.name.toLowerCase());
      else
        for (const s of e.sets) cardioMinutes += (s as { durationMin?: number }).durationMin ?? 0;
    }
  }
  return {
    exercises: [...names].filter(Boolean).length,
    cardioMinutes,
    durationMs,
    sessions30: workouts.filter((w) => w.startedAt >= now - 30 * DAY).length,
  };
}

/**
 * Decrypts what the grant allows and rebuilds the derived views. Never throws: anything
 * that cannot be opened stays as the server sent it.
 */
export async function openProfile<T extends Payload>(
  data: T,
  vault: Vault,
  ports: { loadOwnCoachKey(): Promise<CoachKeyRecord | null> },
  deps: DeriveDeps,
): Promise<T> {
  // Coach/admin: the athlete's key via the grant. Self: the vault's own key.
  const athlete = data.grant
    ? await openAthleteKey(vault, data.grant, ports)
    : data.viewer?.relation === 'self'
      ? vault.materialOrNull()
      : null;
  if (!athlete) return data;
  const open = async <X>(list: Raw[] | undefined): Promise<X[]> =>
    Promise.all(
      (list ?? []).map((r) => unsealDoc<Raw>(r, athlete.key).catch(() => r) as Promise<X>),
    );
  const h = data.history;
  const [workouts, activities, sleeps, restPeriods, gyms] = await Promise.all([
    open<Workout>(h?.workouts),
    open<Raw>(h?.activities),
    open<Raw>(h?.sleeps),
    open<Raw>(h?.restPeriods),
    open<Gym>(data.sealedGyms),
  ]);
  const body = data.bodyMetrics
    ? await unsealDoc<Raw>(data.bodyMetrics, athlete.key).catch(() => data.bodyMetrics)
    : data.bodyMetrics;
  const sorted = [...workouts].sort((a, b) => b.startedAt - a.startedAt);
  return {
    ...data,
    history: { ...h, workouts: sorted, activities, sleeps, restPeriods },
    bodyMetrics: body,
    sessions: deriveSessions(sorted, gyms, deps),
    topExercises: deriveTopExercises(sorted, deps),
    gyms: [
      ...(Array.isArray(data.gyms) ? (data.gyms as Raw[]) : []),
      ...deriveGyms(sorted, gyms, deps),
    ],
    summary: { ...data.summary, ...deriveSummaryExtras(sorted) },
  };
}
