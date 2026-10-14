/**
 * The real `LivePort`: `liveSessions where trainerId == me`. The athlete's device writes ONE small doc (id = their
 * uid) with the open presence fields (`trainerId`, `startedAt`, heartbeat `updatedAt` about every 45 s, `finishedAt`)
 * and a sealed `enc` extension (see `liveWriter.ts`): gym, exercise count, session name, the previous session's
 * context and, only after the session ended, its final sets and tonnage. Never exercise names, sets in progress,
 * loads or notes (R-FE-062, rules allow-list).
 *
 * The extension is opened with the conversation key of the epoch named by the doc (`ringForEpoch` of the ring book).
 * Without a key, or when authentication fails, the row falls back to presence only (never an error for the list).
 * Names come from the sealed `athleteName` when present, else from the roster (`coachClients`). A session of someone
 * who is not in the active roster is dropped.
 */
import type { Vault } from '../../../autoVault';
import type { ChatKeyRing } from '../../../coachCrypto/conversationKey';
import { openSealed } from '../../../coachCrypto/sealOrThrow';
import type { CoachLiveSession, LivePort } from '../../screens/live/port';
import type { FsApi, FsRow } from './fsApi';

interface RosterRow {
  clientId: string;
  name: string;
  status: string;
}
const ROSTER_TTL_MS = 60_000;

export function createFirestoreLivePort(d: {
  fs: FsApi;
  roster?: () => Promise<readonly { clientId: string; name: string }[]>;
  /** the ring book's `ringForEpoch` (clientId, epoch); absent = presence only */
  ringForEpoch?: (clientId: string, epoch: number) => ChatKeyRing | null;
  /** trainer vault (the sealed extension is opened with the conversation key; any `ready` vault will do) */
  vault?: Vault;
  /** re-open the rows when a new key arrives (ring book `watch`) */
  onRings?: (f: () => void) => () => void;
}): LivePort {
  const { fs } = d;
  let cached: { at: number; names: Map<string, string> } | null = null;
  const names = async (): Promise<Map<string, string>> => {
    if (cached && fs.now() - cached.at < ROSTER_TTL_MS) return cached.names;
    const rows = d.roster
      ? await d.roster()
      : (await fs.call<{ clients: RosterRow[] }>('coachClients', {})).clients.filter(
          (c) => c.status === 'active',
        );
    cached = { at: fs.now(), names: new Map(rows.map((r) => [r.clientId, r.name])) };
    return cached.names;
  };

  const SEALED_KEYS = [
    'athleteName',
    'gymName',
    'exerciseCount',
    'sessionName',
    'lastName',
    'lastSets',
    'lastTonnageKg',
    'lastAt',
    'finalSets',
    'finalTonnageKg',
  ] as const;

  /** the sealed extension, or {} (no key / no vault / failed authentication: presence only) */
  const extension = async (r: FsRow): Promise<Record<string, unknown>> => {
    const x = r.data;
    if (!x.enc || !d.ringForEpoch || !d.vault) return {};
    const epoch = typeof x.keyEpoch === 'number' ? x.keyEpoch : 0;
    const ring = d.ringForEpoch(r.id, epoch);
    if (!ring) return {};
    try {
      const open = await openSealed<Record<string, unknown>>('liveSessions', x, {
        vault: d.vault,
        ring,
        ctx: { messageId: r.id, fromUid: r.id, at: x.startedAt as number },
      });
      const out: Record<string, unknown> = {};
      for (const k of SEALED_KEYS) if (open[k] !== undefined) out[k] = open[k];
      return out;
    } catch {
      return {};
    }
  };

  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

  const toSession = async (
    r: FsRow,
    who: Map<string, string>,
    trainerUid: string,
  ): Promise<CoachLiveSession | null> => {
    const name = who.get(r.id);
    const x = r.data;
    if (name === undefined) return null; // not one of my active clients
    if (typeof x.startedAt !== 'number' || typeof x.updatedAt !== 'number') return null;
    const e = await extension(r);
    const finishedAt = typeof x.finishedAt === 'number' ? x.finishedAt : null;
    const s: CoachLiveSession = {
      id: r.id,
      clientId: r.id,
      athleteName: name,
      trainerId: trainerUid,
      startedAt: x.startedAt,
      updatedAt: x.updatedAt,
      finishedAt,
    };
    const gym = str(e.gymName);
    if (gym) s.gymName = gym;
    const count = num(e.exerciseCount);
    if (count !== undefined) s.exerciseCount = count;
    const sn = str(e.sessionName);
    if (sn) s.sessionName = sn;
    const ln = str(e.lastName);
    if (ln) s.lastName = ln;
    const ls = num(e.lastSets);
    if (ls !== undefined) s.lastSets = ls;
    const lt = num(e.lastTonnageKg);
    if (lt !== undefined) s.lastTonnageKg = lt;
    const la = num(e.lastAt);
    if (la !== undefined) s.lastAt = la;
    // sets and weights only once the session is over, whatever a (forged) doc says
    if (finishedAt !== null) {
      const fs_ = num(e.finalSets);
      if (fs_ !== undefined) s.finalSets = fs_;
      const ft = num(e.finalTonnageKg);
      if (ft !== undefined) s.finalTonnageKg = ft;
    }
    return s;
  };

  return {
    now: () => fs.now(),
    subscribe(trainerUid, onSessions, onError) {
      let stop = false;
      let rows: FsRow[] = [];
      let seq = 0;
      const emit = () => {
        const mine = ++seq;
        const snapshot = rows;
        void names()
          .then(async (who) => {
            const out = await Promise.all(snapshot.map((r) => toSession(r, who, trainerUid)));
            if (stop || mine !== seq) return;
            onSessions(out.filter((s): s is CoachLiveSession => !!s));
          })
          .catch(onError);
      };
      const off = fs.listen(
        'liveSessions',
        { where: [['trainerId', '==', trainerUid]] },
        (r) => {
          rows = r;
          emit();
        },
        onError,
      );
      const offRings = d.onRings?.(emit);
      return () => {
        stop = true;
        offRings?.();
        off();
      };
    },
  };
}
