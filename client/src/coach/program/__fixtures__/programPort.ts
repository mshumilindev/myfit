import type { CoachClient } from '../../domain/types';
import type { WorldData } from '../../data/port';
import type { ProgramPort } from '../port';
import { ProgramPortError, type ProgramBundle } from '../types';
import { buildBundle, libraryEntries } from './fixtures';

export interface FixturesProgramPortOptions {
  world: Pick<WorldData, 'clients' | 'trainer'>;
  delayMs?: number;
  /** Start with the bundle already in the local cache. */
  warm?: boolean;
  /** Make the next save fail with this code (tests, stories). */
  failNext?: 'conflict' | 'offline' | 'unavailable';
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    if (signal?.aborted) return rej(new DOMException('aborted', 'AbortError'));
    const t = setTimeout(res, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      rej(new DOMException('aborted', 'AbortError'));
    });
  });

/** In-memory adapter: every client gets a bundle derived from its roster row; saves and sends mutate it. */
export function createFixturesProgramPort(o: FixturesProgramPortOptions): ProgramPort & {
  /** Another editor saved first (an admin): the next save by this one is a conflict. */
  bumpRev(clientId: string): void;
  failNext(code: 'conflict' | 'offline' | 'unavailable' | null): void;
} {
  const store = new Map<string, ProgramBundle>();
  const clientOf = (cid: string): CoachClient => {
    const c = o.world.clients.find((x) => x.id === cid);
    if (!c) throw new ProgramPortError('forbidden');
    return c;
  };
  const get = (cid: string): ProgramBundle => {
    let b = store.get(cid);
    if (!b) {
      b = buildBundle(clientOf(cid), o.world);
      store.set(cid, b);
    }
    return b;
  };
  let fail: 'conflict' | 'offline' | 'unavailable' | null = o.failNext ?? null;
  const gate = (baseRev: number, b: ProgramBundle) => {
    if (fail) {
      const f = fail;
      fail = null;
      throw new ProgramPortError(f);
    }
    if (baseRev !== b.rev) throw new ProgramPortError('conflict');
  };
  const delay = o.delayMs ?? 0;
  return {
    peek: (cid) => {
      if (!o.warm && !store.has(cid)) return null;
      // An unknown client is "nothing cached"; the load reports `forbidden`.
      return o.world.clients.some((x) => x.id === cid) ? structuredClone(get(cid)) : null;
    },
    async load(cid, { signal }) {
      if (delay) await wait(delay, signal);
      return structuredClone(get(cid));
    },
    async saveDraft(cid, { draft, trainerDays, baseRev }) {
      if (delay) await wait(delay);
      const b = get(cid);
      gate(baseRev, b);
      b.draft = structuredClone(draft);
      b.trainerDays = [...trainerDays];
      b.rev += 1;
      return { rev: b.rev };
    },
    async send(cid, { draft, trainerDays, baseRev }) {
      if (delay) await wait(delay);
      const b = get(cid);
      gate(baseRev, b);
      b.live = structuredClone(draft);
      b.draft = structuredClone(draft);
      b.trainerDays = [...trainerDays];
      b.liveVersion = b.draftVersion;
      b.draftVersion += 1;
      b.sentAt = Date.now();
      b.seen = null;
      b.rev += 1;
      return { version: b.liveVersion, rev: b.rev };
    },
    library: (cid) => libraryEntries(o.world, cid),
    async copyTo(cid, target) {
      if (delay) await wait(delay);
      const b = get(cid);
      const t = b.sharedWith.find((s) => s.clientId === target);
      if (!t) throw new ProgramPortError('forbidden');
      t.version = b.draftVersion;
    },
    bumpRev(cid) {
      get(cid).rev += 1;
    },
    failNext(code) {
      fail = code;
    },
  };
}
