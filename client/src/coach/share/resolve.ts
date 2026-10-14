/**
 * resolveShare(ref, viewer, source): the ONE place a share becomes a card (plan 10.3, R-BE-CHAT-12/13). Pure and
 * synchronous over a `ShareSource` snapshot: the card is always built from the READER's access (consent, assignment),
 * and a locked card never carries the item's data (`locked` returns before anything is read).
 *
 *   ok       everything the card can show
 *   limited  part is hidden by the sharing level (workout rows, best set): a "Totals only" line says so
 *   locked   not assigned / private / the client has not shared the category: dashed, lock, no data
 *   removed  the item is gone: dashed, trash
 *   loading  (the caller shows it while the source loads; see `loadingView`)
 */
import { effectiveConsent } from '../domain/consent';
import type { Category } from '../domain/types';
import {
  loadingView,
  type ClientShareData,
  type OpenTarget,
  type ShareFact,
  type ShareKind,
  type ShareReason,
  type ShareRef,
  type ShareRow,
  type ShareSource,
  type ShareView,
  type Viewer,
} from './types';

export { loadingView };

export const KIND_ICON: Record<ShareKind, string> = {
  program: 'list-checks',
  day: 'calendar-check',
  exercise: 'barbell',
  equipment: 'toolbox',
  gym: 'map-pin',
  workout: 'calendar-dots',
  activity: 'heartbeat',
  results: 'chart-line-up',
  muscle: 'person-arms-spread',
};

/** The category a kind of client data needs, and the level for the full card. */
const NEEDS: Partial<Record<ShareKind, { cat: Category }>> = {
  workout: { cat: 'totals' },
  activity: { cat: 'totals' },
  results: { cat: 'sets' },
};

/** Usual weekly hard sets per muscle (design guidance, not a prescription). MuscleGroup ids. */
export const USUAL_WEEKLY_SETS: Readonly<Record<string, readonly [number, number]>> = {
  chest: [10, 16],
  back: [12, 20],
  lats: [10, 16],
  shoulders: [8, 14],
  quads: [10, 16],
  hamstrings: [8, 14],
  glutes: [6, 12],
  biceps: [6, 12],
  triceps: [6, 12],
  calves: [6, 12],
  core: [6, 12],
};

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

export interface Access {
  ok: boolean;
  reason?: ShareReason;
}

/**
 * A program card keeps the id it was sent with. A coached plan has one runnable document per version
 * (`prg-{client}-{n}`), so a card sent for version 1 must follow the plan to the live version instead of turning
 * into "removed" the moment a newer version goes out. An exact id always wins.
 */
export function findProgram<P extends { id: string }>(
  programs: readonly P[],
  id: string,
): P | undefined {
  const exact = programs.find((x) => x.id === id);
  if (exact) return exact;
  const m = /^(prg-.+)-\d+$/.exec(id);
  if (!m) return undefined;
  const stem = `${m[1]}-`;
  return programs.find((x) => x.id.startsWith(stem) && /^\d+$/.test(x.id.slice(stem.length)));
}

const clientOf = (src: ShareSource, id: string): ClientShareData | undefined => src.clients[id];

function levelOf(d: ClientShareData | undefined, cat: Category): 'off' | 'effects' | 'full' {
  if (!d) return 'off';
  return effectiveConsent(d.mode, d.consent)[cat];
}

/**
 * Can the viewer's SIDE put this kind into a message in this thread? Used to lock a type in the picker. A client can
 * share their own data always; a trainer only what the thread's client shares (totals for days and activities,
 * sets for results).
 */
export function kindAccess(kind: ShareKind, viewer: Viewer, src: ShareSource): Access {
  if (viewer.side === 'client') return { ok: true };
  const need = NEEDS[kind];
  if (!need) return { ok: true };
  if (levelOf(clientOf(src, viewer.clientId), need.cat) === 'off')
    return { ok: false, reason: { code: 'notShared', cat: need.cat } };
  return { ok: true };
}

const open = (
  app: 'trainer' | 'client',
  screen: string,
  params: Record<string, string>,
  label: OpenTarget['label'],
  overlay = false,
): OpenTarget => ({ app, screen, params, label, overlay });

const base = (ref: ShareRef) => ({ ref, kind: ref.kind, icon: KIND_ICON[ref.kind] }) as const;

const gone = (
  ref: ShareRef,
  reason: ShareReason,
  target: OpenTarget = open('trainer', 'home', {}, 'peek'),
): ShareView => ({
  ...base(ref),
  state: 'removed',
  title: '',
  facts: [],
  reason,
  openTarget: target,
});
const locked = (
  ref: ShareRef,
  reason: ShareReason,
  title: string,
  target: OpenTarget,
  who?: string,
  exerciseName?: boolean,
): ShareView => ({
  ...base(ref),
  state: 'locked',
  title,
  ...(exerciseName ? { exerciseName } : {}),
  facts: [],
  reason,
  who,
  openTarget: target,
});

const rowOf = (
  r: { name: string; sets: number; reps?: string; kg?: string },
  image?: string,
): ShareRow => ({
  name: r.name,
  sets: r.sets || undefined,
  reps: r.reps,
  kg: r.kg,
  image,
  bare: !r.sets,
});

export function resolveShare(ref: ShareRef, viewer: Viewer, src: ShareSource): ShareView {
  const me = viewer.clientId;
  const isClient = viewer.side === 'client';
  const lib = src.library;
  const imageOf = (name: string, id?: string) =>
    (id ? lib.exercises.find((e) => e.id === id)?.image : undefined) ??
    lib.exercises.find((e) => e.name.toLowerCase() === name.toLowerCase())?.image;

  switch (ref.kind) {
    case 'program': {
      const p = findProgram(src.programs, ref.id);
      if (!p) return gone(ref, { code: 'ownerDeleted' });
      const tgt = isClient
        ? open('client', 'program', { id: p.id }, 'program')
        : open('trainer', 'programs', { id: p.id }, 'programs');
      if (isClient && !p.assignedTo.includes(me))
        return locked(ref, { code: 'notAssigned' }, p.name, tgt);
      const rows = p.days.flatMap((d) => d.rows ?? []);
      const musclesOf = Array.from(
        new Set(
          p.days.flatMap((d) =>
            d.muscles
              ? d.muscles
              : (d.rows ?? []).flatMap(
                  (r) =>
                    lib.exercises.find((e) => e.id === r.exerciseId)?.muscles.slice(0, 1) ?? [],
                ),
          ),
        ),
      );
      return {
        ...base(ref),
        state: 'ok',
        title: p.name,
        sub: { k: 'program', weeks: p.weeks, days: p.days.length },
        facts: [
          { key: 'version', value: p.version ?? 'v1' },
          { key: 'exercises', value: rows.length },
        ],
        chips: musclesOf.slice(0, 5),
        chipsAreMuscles: true,
        rows: rows.slice(0, 3).map((r) => rowOf(r, imageOf(r.name, r.exerciseId))),
        updates: true,
        openTarget: tgt,
      };
    }
    case 'day': {
      const [pid, di] = ref.id.split(':');
      const p = findProgram(src.programs, pid);
      const d = p?.days[Number(di)];
      if (!p || !d) return gone(ref, { code: 'ownerDeleted' });
      const tgt = isClient
        ? open('client', 'program-day', { id: p.id, day: di }, 'day')
        : open('trainer', 'editor', { program: p.id, day: di }, 'editor');
      if (isClient && !p.assignedTo.includes(me))
        return locked(ref, { code: 'notAssigned' }, d.name, tgt);
      const rows = (d.rows ?? []).map((r) => rowOf(r, imageOf(r.name, r.exerciseId)));
      const withTrainer = !!d.wd && (clientOf(src, me)?.trainerDays ?? []).includes(d.wd);
      const facts: ShareFact[] = d.muscles
        ? [{ key: 'dayType', value: 'muscles' }]
        : [
            { key: 'exercises', value: rows.length },
            { key: 'sets', value: (d.rows ?? []).reduce((a, r) => a + r.sets, 0) || '-' },
          ];
      return {
        ...base(ref),
        state: 'ok',
        title: d.name,
        sub: { k: 'day', program: p.name, wd: d.wd },
        facts,
        chips: d.muscles,
        chipsAreMuscles: !!d.muscles,
        rows: d.muscles ? undefined : rows,
        withTrainer,
        updates: true,
        openTarget: tgt,
      };
    }
    case 'exercise': {
      const e = lib.exercises.find((x) => x.id === ref.id);
      if (!e) return gone(ref, { code: 'notInLibrary' });
      const tgt = isClient
        ? open('client', 'exercise', { id: e.id }, 'exercise')
        : open('trainer', 'library', { exercise: e.id }, 'peek', true);
      const facts: ShareFact[] = [];
      if (e.equipment.length)
        facts.push({ key: 'equipment', value: e.equipment.join(','), list: 'equipmentIds' });
      const who = isClient ? me : viewer.clientId;
      const d = clientOf(src, who);
      if (d && (isClient || levelOf(d, 'sets') === 'full')) {
        const r = d.results.find(
          (x) => x.exerciseId === e.id || x.name.toLowerCase() === e.name.toLowerCase(),
        );
        if (r) facts.push({ key: 'best', value: r.best, who: isClient ? undefined : d.firstName });
      }
      return {
        ...base(ref),
        state: 'ok',
        title: e.name,
        exerciseName: true,
        sub: { k: 'family', id: e.family },
        facts,
        chips: e.muscles.slice(0, 3),
        chipsAreMuscles: true,
        image: e.image,
        openTarget: tgt,
      };
    }
    case 'equipment': {
      const e = lib.equipment.find((x) => x.id === ref.id);
      if (!e) return gone(ref, { code: 'notInLibrary' });
      const tgt = isClient
        ? open('client', 'equipment', { id: e.id }, 'equipment')
        : open('trainer', 'library', { equipment: e.id }, 'peek', true);
      const where = lib.gyms.filter((g) => g.equipmentIds.includes(e.id)).map((g) => g.name);
      return {
        ...base(ref),
        state: 'ok',
        title: e.name,
        sub: { k: 'equipCat', id: e.category },
        facts: where.length
          ? [
              {
                key: 'foundIn',
                value: where.length > 2 ? `${where[0]} +${where.length - 1}` : where.join(', '),
              },
            ]
          : [],
        chips: e.muscles.slice(0, 3),
        chipsAreMuscles: true,
        image: e.image,
        openTarget: tgt,
      };
    }
    case 'gym': {
      const g = lib.gyms.find((x) => x.id === ref.id);
      if (!g) return gone(ref, { code: 'notInLibrary' });
      const tgt = isClient
        ? open('client', 'gym', { id: g.id }, 'gym')
        : open('trainer', 'library', { gym: g.id }, 'peek', true);
      const facts: ShareFact[] = [
        { key: 'amenities', value: g.amenities.length },
        { key: 'machines', value: g.machines },
      ];
      if (g.hours) facts.push({ key: 'hours', value: g.hours });
      return {
        ...base(ref),
        state: 'ok',
        title: g.name,
        sub: { k: 'text', text: g.city },
        facts,
        chips: g.amenities.slice(0, 4),
        image: g.photo,
        openTarget: tgt,
      };
    }
    case 'workout':
    case 'activity':
    case 'results': {
      const oid = ref.ownerId ?? me;
      const need = NEEDS[ref.kind]!;
      const tgt =
        ref.kind === 'results'
          ? isClient
            ? open('client', 'exercise-results', { id: ref.id }, 'exercise')
            : open('trainer', 'client360', { id: oid, tab: 'strength', ex: ref.id }, 'strength')
          : isClient
            ? open('client', 'history-day', { id: ref.id }, 'day')
            : open('trainer', 'client360', { id: oid, tab: 'workouts', item: ref.id }, 'workouts');
      const d = clientOf(src, oid);
      const who = d?.firstName;
      const title =
        ref.kind === 'results' ? (d?.results.find((r) => r.id === ref.id)?.name ?? '') : '';
      // Another person's data is never readable here, whoever asks.
      if (oid !== me)
        return locked(ref, { code: 'private' }, title, tgt, who, ref.kind === 'results');
      const level = levelOf(d, need.cat);
      if (!isClient && level === 'off')
        return locked(
          ref,
          { code: 'notShared', cat: need.cat },
          title,
          tgt,
          who,
          ref.kind === 'results',
        );
      if (!d) return gone(ref, { code: 'notInHistory' }, tgt);
      const fullSets = isClient || levelOf(d, 'sets') === 'full';
      const whoLabel = isClient ? undefined : d.firstName;

      if (ref.kind === 'workout') {
        const w = d.workouts.find((x) => x.id === ref.id);
        // set rows are only readable at the full level: a trainer whose access dropped sees a lock, not "removed"
        if (!w && !isClient && !fullSets)
          return locked(ref, { code: 'notShared', cat: 'sets' }, title, tgt, who);
        if (!w) return gone(ref, { code: 'notInHistory' }, tgt);
        return {
          ...base(ref),
          state: fullSets ? 'ok' : 'limited',
          title: w.title,
          sub: { k: 'workout', at: w.at, gym: w.gym },
          facts: fullSets
            ? [
                { key: 'duration', value: w.minutes, unit: 'min' },
                { key: 'tonnage', value: Math.round(w.tonnageKg / 100) / 10, unit: 't' },
                { key: 'sets', value: w.sets },
              ]
            : [{ key: 'duration', value: w.minutes, unit: 'min' }],
          rows: fullSets
            ? w.rows.slice(0, 4).map((r) => ({ name: r.name, top: r.top, image: r.image }))
            : undefined,
          chips: fullSets ? undefined : w.rows.slice(0, 3).map((r) => r.name),
          withTrainer: w.withTrainer,
          who: whoLabel,
          limited: fullSets ? undefined : { cat: 'sets' },
          openTarget: tgt,
        };
      }
      if (ref.kind === 'activity') {
        const a = d.activities.find((x) => x.id === ref.id);
        if (!a && !isClient && level !== 'full')
          return locked(ref, { code: 'notShared', cat: 'totals' }, title, tgt, who);
        if (!a) return gone(ref, { code: 'notInHistory' }, tgt);
        const facts: ShareFact[] = [
          { key: 'time', value: a.minutes, unit: 'min' },
          { key: 'effort', value: a.effort },
        ];
        if (a.km) facts.push({ key: 'distance', value: a.km, unit: 'km' });
        if (a.avgHr) facts.push({ key: 'avgHr', value: a.avgHr, unit: 'bpm' });
        return {
          ...base(ref),
          state: 'ok',
          icon: a.icon,
          title: a.type,
          sub: { k: 'date', at: a.at },
          facts,
          chips: a.route ? [a.route] : undefined,
          track: a.points,
          who: whoLabel,
          openTarget: tgt,
        };
      }
      const r = d.results.find((x) => x.id === ref.id);
      if (!r && !isClient && !fullSets)
        return locked(ref, { code: 'notShared', cat: 'sets' }, title, tgt, who, true);
      if (!r || r.sessions < 3) return gone(ref, { code: 'fewSessions' }, tgt);
      const facts: ShareFact[] = [];
      if (fullSets) facts.push({ key: 'best', value: r.best });
      facts.push({ key: 'e1rm', value: r.e1rm, unit: 'kg' });
      facts.push({ key: 'change', value: r.change, unit: 'kg' });
      return {
        ...base(ref),
        state: fullSets ? 'ok' : 'limited',
        title: r.name,
        exerciseName: true,
        sub: { k: 'results', who: whoLabel },
        facts,
        series: r.series,
        image: r.image,
        who: whoLabel,
        limited: fullSets ? undefined : { cat: 'sets' },
        openTarget: tgt,
      };
    }
    case 'muscle': {
      const m = ref.id;
      if (!USUAL_WEEKLY_SETS[m] && !lib.exercises.some((e) => e.muscles.includes(m)))
        return gone(ref, { code: 'notInLibrary' });
      const tgt = isClient
        ? open('client', 'muscle', { id: m }, 'muscle')
        : open('trainer', 'library', { muscle: m }, 'peek', true);
      const oid = ref.ownerId ?? (isClient ? me : undefined);
      const band = USUAL_WEEKLY_SETS[m];
      const facts: ShareFact[] = [];
      let limited: ShareView['limited'];
      let who: string | undefined;
      if (oid) {
        const d = clientOf(src, oid);
        who = d?.firstName;
        if (oid !== me) return locked(ref, { code: 'private' }, '', tgt, who);
        if (isClient || levelOf(d, 'sets') !== 'off') {
          facts.push({ key: 'setsWeek', value: d?.weeklySets[m] ?? 0 });
          if (band) facts.push({ key: 'usualRange', value: `${band[0]}-${band[1]}` });
        } else limited = { cat: 'sets' };
      } else if (band) facts.push({ key: 'usualWeekly', value: `${band[0]}-${band[1]}` });
      const exs = lib.exercises.filter((e) => e.muscles[0] === m).slice(0, 3);
      return {
        ...base(ref),
        state: limited ? 'limited' : 'ok',
        title: m,
        sub: { k: 'muscle', who: isClient ? undefined : who, you: isClient && !!oid },
        facts,
        muscle: m,
        limited,
        who,
        rows: exs.map((e) => ({ name: e.name, image: e.image })),
        openTarget: tgt,
      };
    }
  }
}
