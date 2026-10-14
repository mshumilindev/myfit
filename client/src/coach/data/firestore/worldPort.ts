/**
 * The real `CoachWorldPort`: roster from `coachClients`, per-client data from `coachRead` (the one consent-gated,
 * audited read path), sealed parts opened on THIS device with the client's vault grant, decisions and signal state as
 * sealed documents under `users/{trainer}` (`sealOrThrow`, never `prepareWrite`).
 *
 *  - Slots and `planned` per week come from the trainer's schedule (`deps.schedule`, joined by `scheduleJoin.ts`); without
 *    it they stay empty / 0 and the next load joins them.
 *  - Nothing is written for a client whose category is locked, and a document that does not open is dropped.
 */
import type { Vault } from '../../../autoVault';
import { unsealDoc } from '../../../encryptedDoc';
import type { Workout } from '../../../types';
import { openAthleteKey } from '../../../vaultGrants';
import type { CoachKeyRecord } from '../../../vaultShare';
import { VaultLockedError } from '../../../coachCrypto/sealOrThrow';
import type { BookOp } from '../bookOps';
import { openDecision, openSignalState, sealDecision, sealSignalState } from '../decisionDocs';
import { emptyBook, type DecisionBook } from '../../domain/decisions';
import type { ClientHistory } from '../../domain/history';
import type { Category, SharedInjury } from '../../domain/types';
import { PortError, type CoachWorldPort, type LoadOptions, type WorldData } from '../port';
import { toPortError } from './errors';
import { joinHistory, joinSchedule } from './scheduleJoin';
import { WEEK } from '../../domain/time';
import type { ScheduleData } from '../../schedule/port';
import type { FsApi, FsOp, Raw } from './fsApi';
import {
  pendingClient,
  toCoachClient,
  toSignalInput,
  type ReadCategory,
  type Roster,
  type RosterClient,
  doneThisWeek,
  historyFromWorkouts,
  injuriesFromDocs,
  streakFromRead,
} from './worldMap';

export interface WorldCache {
  get(): Promise<{ data: WorldData; fetchedAt: number } | null>;
  set(v: { data: WorldData; fetchedAt: number }): Promise<void>;
}

export interface FirestoreWorldDeps {
  fs: FsApi;
  vault: Vault;
  trainer: { id: string; name: string };
  loadOwnCoachKey: () => Promise<CoachKeyRecord | null>;
  cache?: WorldCache;
  /**
   * The trainer's schedule (opened on this device), used to join `planned` per week and the slots into the world. It
   * may take a moment (the key rings prime first): return null to load without it, the next load joins it.
   */
  schedule?: () => Promise<ScheduleData | null>;
  /** how many clients are read at once */
  concurrency?: number;
}

interface ReadResponse {
  results: Partial<Record<Category, ReadCategory>>;
  grant: unknown;
}

const WANT: Category[] = ['totals', 'sets', 'injury'];
const decisionsPath = (uid: string) => `users/${uid}/decisions`;
const statePath = (uid: string) => `users/${uid}/meta/signalState`;

export function createFirestoreWorldPort(d: FirestoreWorldDeps): CoachWorldPort {
  const { fs, trainer } = d;
  let last: { data: WorldData; fetchedAt: number } | null = null;
  const saved = new Map<string, string>(); // decision id -> JSON last written
  let bookCache: DecisionBook | null = null;
  const listeners = new Set<() => void>();

  void d.cache
    ?.get()
    .then((c) => {
      if (c && !last) last = c;
    })
    .catch(() => undefined);

  const unlocked = () => {
    if (!d.vault.materialOrNull()) throw new VaultLockedError();
  };

  async function loadBook(): Promise<DecisionBook> {
    unlocked();
    const rows = await fs.getDocs(decisionsPath(trainer.id), {});
    const decisions = [];
    for (const r of rows) {
      try {
        const ev = await fs.getDocs(`${decisionsPath(trainer.id)}/${r.id}/evidence`, {});
        const rec = await openDecision(
          r.data,
          ev.map((e) => e.data),
          d.vault,
        );
        decisions.push(rec);
        saved.set(rec.id, JSON.stringify(rec));
      } catch {
        /* does not open: never shown */
      }
    }
    const stateRaw = await fs.get(statePath(trainer.id));
    let state = { snoozed: {}, dismissed: {}, dataQuality: {} } as Awaited<
      ReturnType<typeof openSignalState>
    >;
    if (stateRaw) {
      try {
        state = await openSignalState(stateRaw, d.vault);
      } catch {
        /* keep empty */
      }
    }
    bookCache = {
      ...emptyBook(),
      decisions: decisions.sort((a, b) => b.decidedAt - a.decidedAt),
      snoozed: state.snoozed,
      dismissed: state.dismissed,
      dataQuality: state.dataQuality,
    };
    return bookCache;
  }

  async function readClient(
    c: RosterClient,
    now: number,
  ): Promise<{
    input: ReturnType<typeof toSignalInput>;
    lastSessionAt: number | null;
    done: number;
    streak: number;
    injuries?: SharedInjury[];
    history?: ClientHistory;
  }> {
    const cats = WANT.filter((k) => c.consent[k] !== 'off');
    if (c.mode === 'program' || cats.length === 0)
      return { input: toSignalInput(c, {}, {}, now), lastSessionAt: null, done: 0, streak: 0 };
    const res = await fs.call<ReadResponse>('coachRead', {
      clientId: c.clientId,
      categories: cats,
      via: 'queue',
    });
    const opened: { workouts?: Workout[]; setsView?: unknown } = {};
    // the member's key (from the grant on this device) opens the sealed parts: sets and injuries
    let athleteKey: Awaited<ReturnType<typeof openAthleteKey>> | undefined;
    const openAll = async (docs: readonly Raw[]): Promise<Record<string, unknown>[]> => {
      athleteKey ??= await openAthleteKey(d.vault, res.grant, {
        loadOwnCoachKey: d.loadOwnCoachKey,
      });
      if (!athleteKey) return [];
      const out: Record<string, unknown>[] = [];
      for (const raw of docs) {
        try {
          out.push(await unsealDoc<Raw>(raw, athleteKey.key));
        } catch {
          /* does not open */
        }
      }
      return out;
    };
    const sets = res.results.sets;
    if (sets?.state === 'ok' && sets.docs?.length) {
      const out = await openAll(sets.docs);
      if (sets.level === 'full') opened.workouts = out as unknown as Workout[];
      else opened.setsView = (out[0] as { view?: unknown } | undefined)?.view;
    }
    // injuries exist as documents only at `full` (the sealed "sealed readers" of the trainer side); effects has no document
    const inj = res.results.injury;
    const injuries =
      inj?.state === 'ok' && inj.level === 'full' && inj.docs
        ? injuriesFromDocs(await openAll(inj.docs))
        : undefined;
    const input = toSignalInput(c, res.results, opened, now);
    const t = res.results.totals;
    const lastSessionAt =
      t?.state === 'ok'
        ? t.docs?.length
          ? Math.max(...t.docs.map((x) => Number(x.startedAt)))
          : ((t.view as { lastSessionAt?: number | null } | undefined)?.lastSessionAt ?? null)
        : null;
    return {
      input,
      lastSessionAt,
      done: doneThisWeek(t, now),
      streak: streakFromRead(t, now),
      injuries,
      // Overview / Workouts / Strength: only from the sessions the member shares at sets `full` (the trainer's device opened them)
      history: opened.workouts ? historyFromWorkouts(opened.workouts, now) : undefined,
    };
  }

  /**
   * The program each active client is on and the week they are in, from the plaintext documents the trainer already
   * reads (`programs` they authored + `assignments/{client}`). Without this every roster row says "week 0" of nothing.
   */
  async function withAssignedPrograms<
    X extends { id: string; program: string; programWeek: number },
  >(clients: X[], active: readonly RosterClient[], now: number): Promise<X[]> {
    try {
      const progs = new Map(
        (await fs.getDocs('programs', { where: [['authorId', '==', trainer.id]] })).map((r) => [
          r.id,
          r.data,
        ]),
      );
      const asg = new Map<string, Raw | null>();
      await Promise.all(
        active.map(async (c) =>
          asg.set(c.clientId, await fs.get(`assignments/${c.clientId}`).catch(() => null)),
        ),
      );
      return clients.map((c) => {
        const a = asg.get(c.id);
        const p = a ? progs.get(String(a.programId)) : undefined;
        if (!a || !p) return c;
        const started = Number(a.startedAt);
        const weeks = Number(p.weeks) || 0;
        const week = Number.isFinite(started)
          ? Math.max(1, Math.floor((now - started) / WEEK) + 1)
          : 1;
        return {
          ...c,
          program: String(p.name ?? ''),
          programWeek: weeks > 0 ? Math.min(week, weeks) : week,
        };
      });
    } catch {
      return clients; // a failing side read never blanks the dashboard
    }
  }

  const world: CoachWorldPort = {
    now: () => fs.now(),
    peek: () => last,

    async load({ signal }: LoadOptions) {
      try {
        const roster = await fs.call<Roster>('coachClients', {});
        if (signal.aborted) throw new PortError('timeout', 'aborted');
        const now = roster.serverTime;
        // the book and the schedule do not depend on the client reads: start them now, await them after
        const bookP = loadBook();
        const schedP = (d.schedule?.() ?? Promise.resolve(null)).catch(() => null);
        bookP.catch(() => undefined);
        const active = roster.clients.filter((c) => c.status === 'active');
        const inputs: WorldData['inputs'] = [];
        const history: Record<string, ClientHistory> = {};
        const clients: WorldData['clients'] = [];
        const width = d.concurrency ?? 3;
        for (let i = 0; i < active.length; i += width) {
          const batch = await Promise.all(
            active.slice(i, i + width).map(async (c) => {
              try {
                return { c, ...(await readClient(c, now)) };
              } catch (e) {
                // one client failing must not blank the dashboard: that person shows without data
                if ((e as { status?: number })?.status === 403) throw e;
                return {
                  c,
                  input: toSignalInput(c, {}, {}, now),
                  lastSessionAt: null,
                  done: 0,
                  streak: 0,
                };
              }
            }),
          );
          for (const b of batch) {
            inputs.push(b.input);
            if (b.history) history[b.c.clientId] = b.history;
            clients.push(
              toCoachClient(b.c, b.lastSessionAt, b.done, {
                streakWeeks: b.streak,
                injuries: b.injuries,
              }),
            );
          }
        }
        for (const inv of roster.invites) clients.push(pendingClient(inv));
        const [book, sched] = await Promise.all([bookP, schedP]);
        const withPlan = await withAssignedPrograms(clients, active, now);
        const joined = joinSchedule({ clients: withPlan, inputs, now }, sched);
        const data: WorldData = {
          asOf: now,
          trainer,
          clients: joined.clients,
          inputs: joined.inputs,
          slots: joined.slots,
          book,
          history: joinHistory(history, sched, now),
        };
        last = { data, fetchedAt: now };
        void d.cache?.set(last).catch(() => undefined);
        listeners.forEach((f) => f());
        return data;
      } catch (e) {
        throw toPortError(e);
      }
    },

    async save(op: BookOp, book: DecisionBook) {
      unlocked();
      void op; // the store passes the book AFTER the op (and every op still queued): we persist the difference
      const next = book;
      const ops: FsOp[] = [];
      for (const rec of next.decisions) {
        const json = JSON.stringify(rec);
        if (saved.get(rec.id) === json) continue;
        const s = await sealDecision(rec, d.vault);
        ops.push({ k: 'set', path: `${decisionsPath(trainer.id)}/${rec.id}`, data: s.decision });
        for (const e of s.evidence)
          ops.push({
            k: 'set',
            path: `${decisionsPath(trainer.id)}/${rec.id}/evidence/${e.category}`,
            data: e.doc,
          });
      }
      for (const id of [...saved.keys()]) {
        if (next.decisions.some((x) => x.id === id)) continue;
        const ev = await fs.getDocs(`${decisionsPath(trainer.id)}/${id}/evidence`, {});
        for (const e of ev)
          ops.push({ k: 'delete', path: `${decisionsPath(trainer.id)}/${id}/evidence/${e.id}` });
        ops.push({ k: 'delete', path: `${decisionsPath(trainer.id)}/${id}` });
      }
      ops.push({
        k: 'set',
        path: statePath(trainer.id),
        data: await sealSignalState(next, d.vault, fs.now()),
      });
      try {
        await fs.batch(ops);
      } catch (e) {
        throw toPortError(e);
      }
      for (const rec of next.decisions) saved.set(rec.id, JSON.stringify(rec));
      for (const id of [...saved.keys()])
        if (!next.decisions.some((x) => x.id === id)) saved.delete(id);
      bookCache = next;
    },

    subscribe(on) {
      listeners.add(on);
      return () => void listeners.delete(on);
    },

    async endCoaching(clientId: string) {
      try {
        await fs.call('coachEnd', { clientId });
      } catch (e) {
        throw toPortError(e);
      }
    },
  };
  return world;
}
