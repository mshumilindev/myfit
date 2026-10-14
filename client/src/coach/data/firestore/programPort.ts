/**
 * The real `ProgramPort` (trainer Program editor, M3) over the sealed plan documents:
 *
 *   plans/{clientId}                 the plan: open programId / liveVersion / rev; sealed LIVE overlay
 *   plans/{clientId}/versions/{n}    one document per version: sealed whole program + trainer days + diff + summary
 *
 * Sealing is `program/planCodec.ts` (`sealOrThrow`, conversation key ring, sub-key `plan`): a locked vault or a ring this
 * device does not hold throws `vault-locked` BEFORE anything is written. The draft is the version `liveVersion + 1`
 * with `state: 'draft'` (the client cannot read it: rules); a save is one transaction over the plan (optimistic `rev`,
 * rules: rev == previous + 1) and that draft version. Send = save, then the `publishPlanVersion` callable (the server
 * flips `state`, `liveVersion`, the assignment and writes the one "Program updated" notice), then the trainer refreshes
 * the sealed live overlay of the plan (best effort: the client reads the live VERSION, never the plan overlay).
 *
 * The runnable program: every version owns one immutable template-level document `programs/prg-{clientId}-{n}`
 * (`runnableProgram`: no targets, no activities, no warm-up weights; those stay sealed). Send writes it BEFORE the
 * publish call (a retry overwrites the same id, so Send is idempotent) and nothing references it until the server
 * flips `assignments/{clientId}.programId` in the same transaction as `state: 'live'`. After a publish the previous
 * version's document is removed (best effort). Templates (own programs) are not read here: the library offers the
 * days of the clients already opened on this device.
 */
import type { Vault } from '../../../autoVault';
import { freshProgram, type Program } from '../../../views/programs/model';
import { diffPrograms, forWrite, type Change } from '../../program/ops';
import {
  emptyOverlay,
  openPlan,
  openVersion,
  overlayOf,
  planProgramId,
  runnableProgram,
  sealPlan,
  sealVersion,
  versionProgramId,
  type VersionDocData,
} from '../../program/planCodec';
import type { ProgramPort } from '../../program/port';
import {
  ProgramPortError,
  type LibraryEntry,
  type ProgramBundle,
  type ProgramPortErrorCode,
  type VersionNote,
} from '../../program/types';
import type { ChatKeyRing } from '../../../coachCrypto/conversationKey';
import type { CoachClient, Dow } from '../../domain/types';
import type { FsApi } from './fsApi';

export interface FirestoreProgramDeps {
  fs: FsApi;
  vault: Vault;
  trainer: { id: string; name: string };
  /** The ring book of the trainer: resolves when the first conversation snapshot is processed. */
  book: {
    ringFor(clientId: string): ChatKeyRing | null;
    ringForEpoch?(clientId: string, epoch: number): ChatKeyRing | null;
    ready(): Promise<void>;
  };
  /** The roster (names, program names, who shares a program). */
  roster: () => readonly CoachClient[];
  /** The one-line "what changed" of a version, from its diff against the live one (the trainer's own words). */
  summarize?: (changes: readonly Change[]) => string;
  /**
   * Tell the client in the conversation that a version went live (the "Program updated" card). Called once per sent
   * version with a stable message id, so a retried Send never posts it twice. A failure never fails the Send.
   */
  announce?: (cid: string, card: { id: string; version: number; summary: string }) => Promise<void>;
}

function toError(e: unknown): ProgramPortError {
  if (e instanceof ProgramPortError) return e;
  const x = e as { code?: unknown; status?: unknown; name?: unknown; message?: unknown } | null;
  if (
    x?.name === 'VaultLockedError' ||
    x?.message === 'vault-locked' ||
    x?.message === 'chat-key-missing'
  )
    return new ProgramPortError('vault-locked');
  const code = typeof x?.code === 'string' ? x.code.replace(/^functions\/|^firestore\//, '') : '';
  const status = typeof x?.status === 'number' ? x.status : 0;
  const map: Record<string, ProgramPortErrorCode> = {
    'permission-denied': 'forbidden',
    'failed-precondition': 'conflict',
    aborted: 'conflict',
    'already-exists': 'conflict',
    unavailable: 'offline',
    'deadline-exceeded': 'offline',
  };
  if (map[code]) return new ProgramPortError(map[code]);
  if (status === 403) return new ProgramPortError('forbidden');
  if (status === 0 || status === 503 || status === 504) return new ProgramPortError('offline');
  return new ProgramPortError('unavailable');
}

const planPath = (c: string) => `plans/${c}`;
const seenOf = (n: Record<string, unknown> | null): ProgramBundle['seen'] => {
  const v = Number((n?.ref as { version?: unknown } | undefined)?.version);
  return n && Number.isSafeInteger(v) && v >= 1 && Number.isSafeInteger(n.createdAt)
    ? { version: v, at: n.createdAt as number }
    : null;
};
const versionPath = (c: string, n: number) => `plans/${c}/versions/${n}`;

export function createFirestoreProgramPort(d: FirestoreProgramDeps): ProgramPort {
  const { fs } = d;
  const cache = new Map<string, ProgramBundle>();

  const clientOf = (cid: string): CoachClient => {
    const c = d.roster().find((x) => x.id === cid && !x.invite);
    if (!c) throw new ProgramPortError('forbidden');
    return c;
  };
  async function ringFor(cid: string): Promise<ChatKeyRing> {
    await d.book.ready();
    const ring = d.book.ringFor(cid);
    if (!ring) throw new ProgramPortError('vault-locked', 'chat-key-missing');
    return ring;
  }
  /** Versions sealed before a key rotation open with the ring of their own epoch (the key ring of past epochs). */
  function sourceAt(cid: string, ring: ChatKeyRing, epoch: unknown) {
    const r =
      !Number.isInteger(epoch) || epoch === ring.epoch
        ? ring
        : (d.book.ringForEpoch?.(cid, epoch as number) ?? null);
    return r ? { vault: d.vault, ring: r } : null;
  }
  const starter = (cid: string): Program => ({
    ...freshProgram(clientOf(cid).program || 'Program'),
    id: planProgramId(cid),
    authorId: d.trainer.id,
  });
  const asProgram = (cid: string, p: Program): Program => ({
    ...p,
    id: planProgramId(cid),
    authorId: d.trainer.id,
  });

  async function loadBundle(cid: string, signal?: AbortSignal): Promise<ProgramBundle> {
    const client = clientOf(cid);
    const ring = await ringFor(cid);
    const src = { vault: d.vault, ring };
    const srcAt = (epoch: unknown) => sourceAt(cid, ring, epoch);
    const [planRaw, rows, seenRaw] = await Promise.all([
      fs.get(planPath(cid)),
      fs.getDocs(`plans/${cid}/versions`, { orderBy: ['n', 'desc'], limit: 60 }),
      // the client's acknowledgement of a version: the notice the server keeps in the trainer's own inbox
      fs.get(`users/${d.trainer.id}/notices/pa-${cid}`).catch(() => null),
    ]);
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const versions: VersionDocData[] = [];
    for (const r of rows) {
      try {
        const at = srcAt(r.data.keyEpoch);
        if (at) versions.push(await openVersion(at, cid, d.trainer.id, r.data));
      } catch {
        /* does not open (rotated key, tampered): never shown */
      }
    }
    const planSrc = planRaw ? srcAt(planRaw.keyEpoch) : src;
    const plan = planRaw && planSrc ? await openPlan(planSrc, cid, planRaw) : null;
    const liveN = plan?.liveVersion ?? 0;
    const liveV = versions.find((v) => v.n === liveN && v.state === 'live');
    const draftV = versions.find((v) => v.n === liveN + 1 && v.state === 'draft');
    const live = liveV?.program ?? starter(cid);
    const draft = draftV?.program ?? structuredClone(live);
    const others = d
      .roster()
      .filter((x) => x.id !== cid && !x.invite && client.program && x.program === client.program);
    const notes: VersionNote[] = versions.map((v) => ({
      n: v.n,
      at: v.state === 'draft' ? null : (v.publishedAt ?? v.createdAt),
      by: d.trainer.name,
      summary: v.summary,
    }));
    const bundle: ProgramBundle = {
      clientId: cid,
      rev: plan?.rev ?? 0,
      programName: client.program || draft.name,
      draftVersion: liveN + 1,
      liveVersion: liveN,
      live,
      draft,
      trainerName: d.trainer.name,
      trainerDays: [...(draftV?.trainerDays ?? plan?.trainerDays ?? client.trainerDays)] as Dow[],
      sharedWith: others.map((x) => ({
        clientId: x.id,
        name: x.name,
        version: cache.get(x.id)?.liveVersion ?? 0,
      })),
      versions: notes,
      sentAt: liveV?.publishedAt ?? null,
      seen: seenOf(seenRaw),
    };
    cache.set(cid, bundle);
    return structuredClone(bundle);
  }

  /** One transaction: the plan (rev + 1) and the draft version. */
  async function writeDraft(
    cid: string,
    input: { draft: Program; trainerDays: readonly Dow[]; baseRev: number },
  ): Promise<{ rev: number; n: number; program: Program; summary: string }> {
    clientOf(cid);
    const ring = await ringFor(cid);
    const src = { vault: d.vault, ring };
    const program = forWrite(asProgram(cid, input.draft));
    return fs.transact(async (tx) => {
      const cur = await tx.get(planPath(cid));
      const curRev = Number(cur?.rev ?? 0);
      if (curRev !== input.baseRev) throw new ProgramPortError('conflict');
      const liveN = Number(cur?.liveVersion ?? 0);
      const n = liveN + 1;
      const curV = await tx.get(versionPath(cid, n));
      if (curV && curV.state !== 'draft') throw new ProgramPortError('conflict');
      let liveV: VersionDocData | null = null;
      if (liveN > 0) {
        const raw = await tx.get(versionPath(cid, liveN));
        const at = raw ? sourceAt(cid, ring, raw.keyEpoch) : null;
        if (raw && !at) throw new ProgramPortError('vault-locked', 'chat-key-missing');
        if (raw && at) liveV = await openVersion(at, cid, d.trainer.id, raw);
      }
      const now = fs.now();
      const diff = liveV ? diffPrograms(liveV.program, program) : [];
      // what the client is told changed is the real diff, never a stale text from an earlier save of the draft
      const summary = d.summarize ? d.summarize(diff) : '';
      // the plan keeps pointing at the LIVE version's program; the draft owns the next version's own document
      const planProgram = typeof cur?.programId === 'string' ? cur.programId : planProgramId(cid);
      const programId = versionProgramId(cid, n);
      const overlay = liveV ? overlayOf(liveV.program, liveV.trainerDays) : emptyOverlay();
      tx.set(
        planPath(cid),
        await sealPlan(src, {
          clientId: cid,
          trainerId: d.trainer.id,
          programId: planProgram,
          liveVersion: liveN,
          rev: curRev + 1,
          updatedAt: now,
          ...overlay,
        }),
      );
      tx.set(
        versionPath(cid, n),
        await sealVersion(src, cid, d.trainer.id, {
          n,
          programId,
          state: 'draft',
          createdAt: typeof curV?.createdAt === 'number' ? curV.createdAt : now,
          publishedAt: null,
          reason: '',
          summary,
          diff,
          program,
          trainerDays: input.trainerDays,
        }),
      );
      return { rev: curRev + 1, n, program, summary };
    });
  }

  /** After a publish the plan's sealed overlay follows the new live version (best effort). */
  async function refreshOverlay(
    cid: string,
    n: number,
    program: Program,
    trainerDays: readonly Dow[],
  ): Promise<number | null> {
    try {
      const ring = await ringFor(cid);
      const src = { vault: d.vault, ring };
      return await fs.transact(async (tx) => {
        const cur = await tx.get(planPath(cid));
        if (!cur || Number(cur.liveVersion) !== n) return null;
        const rev = Number(cur.rev) + 1;
        tx.set(
          planPath(cid),
          await sealPlan(src, {
            clientId: cid,
            trainerId: d.trainer.id,
            programId: String(cur.programId),
            liveVersion: n,
            rev,
            updatedAt: fs.now(),
            ...overlayOf(program, trainerDays),
          }),
        );
        return rev;
      });
    } catch {
      return null;
    }
  }

  function remember(cid: string, patch: Partial<ProgramBundle>): void {
    const b = cache.get(cid);
    if (b) cache.set(cid, { ...b, ...patch });
  }

  return {
    peek: (cid) => {
      const b = cache.get(cid);
      return b ? structuredClone(b) : null;
    },
    async load(cid, { signal }) {
      try {
        return await loadBundle(cid, signal);
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') throw e;
        throw toError(e);
      }
    },
    async saveDraft(cid, input) {
      try {
        const w = await writeDraft(cid, input);
        remember(cid, {
          rev: w.rev,
          draft: structuredClone(input.draft),
          trainerDays: [...input.trainerDays],
        });
        return { rev: w.rev };
      } catch (e) {
        throw toError(e);
      }
    },
    async send(cid, input) {
      try {
        const w = await writeDraft(cid, input);
        remember(cid, { rev: w.rev });
        // the runnable program of this version first: unreferenced (private to the author) until the publish flips the
        // assignment; a retry after a failed publish simply rewrites the same document
        const pid = versionProgramId(cid, w.n);
        await fs.set(
          `programs/${pid}`,
          runnableProgram(w.program, {
            id: pid,
            authorId: d.trainer.id,
            updatedAt: fs.now(),
          }) as never,
        );
        await fs.call('publishPlanVersion', { clientId: cid, n: w.n });
        if (d.announce)
          await d
            .announce(cid, {
              id: `pu-${w.n}-${cid}`.slice(0, 80),
              version: w.n,
              summary: w.summary,
            })
            .catch(() => undefined);
        if (w.n > 1)
          await fs.del(`programs/${versionProgramId(cid, w.n - 1)}`).catch(() => undefined);
        // the server bumped `rev` once more (it flips liveVersion on the plan)
        let rev = w.rev + 1;
        const refreshed = await refreshOverlay(cid, w.n, w.program, input.trainerDays);
        if (refreshed != null) rev = refreshed;
        remember(cid, {
          rev,
          live: structuredClone(input.draft),
          draft: structuredClone(input.draft),
          trainerDays: [...input.trainerDays],
          liveVersion: w.n,
          draftVersion: w.n + 1,
          sentAt: fs.now(),
          seen: null,
        });
        return { version: w.n, rev };
      } catch (e) {
        throw toError(e);
      }
    },
    library(cid) {
      const out: LibraryEntry[] = [];
      for (const [id, b] of cache) {
        if (id === cid) continue;
        const c = d.roster().find((x) => x.id === id);
        if (!c) continue;
        for (const day of Object.keys(b.live.dayNames).map(Number).sort()) {
          const its = b.live.items.filter((i) => i.day === day && i.kind === 'strength');
          if (!its.length) continue;
          out.push({
            key: `cl-${id}-${day}`,
            kind: 'client',
            name: b.programName,
            dayName: b.live.dayNames[String(day)] ?? '',
            exercises: its.length,
            sets: its.reduce((n, i) => n + (i.bare ? 0 : i.sets), 0),
            clientId: id,
            clientName: c.name,
            program: b.live,
            day,
          });
        }
      }
      return out;
    },
    async copyTo(cid, target) {
      try {
        const from = cache.get(cid) ?? (await loadBundle(cid));
        if (!from.sharedWith.some((s) => s.clientId === target))
          throw new ProgramPortError('forbidden');
        const t = await loadBundle(target);
        await writeDraft(target, {
          draft: from.draft,
          trainerDays: t.trainerDays,
          baseRev: t.rev,
        });
        cache.delete(target);
      } catch (e) {
        throw toError(e);
      }
    },
  };
}
