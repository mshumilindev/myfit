/**
 * AUDIT harness: ONE shared in-memory Firestore store, the REAL server services (functions/src/coach/service.ts, run on a Kv
 * adapter over the same store, callables dispatched per signed-in actor, device-write triggers simulated) and the REAL
 * client-side adapters of BOTH sides (same wiring as install.ts, without module-global configure* so both can coexist).
 */
import { generateKeyPairSync, sign as edSign, randomBytes } from 'node:crypto';
import * as svc from '../../../../../../functions/src/coach/service';
import type { Doc, Kv, Query, Row } from '../../../../../../functions/src/coach/kv';
import { adoptMyLegacyTrainer } from '../../../../../../functions/src/coach/lifecycle';
import { conversationId } from '../../../../../../functions/src/coach/logic';
import { createMemoryFs, type MemoryFs } from '../memoryFs';
import type { FsApi, FsOp, FsQuery, Raw } from '../fsApi';
import { readyVault } from '../../../../testVault';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRules } from '../../../../../../tests/rules/engine/rulesEngine';
import { enforceRules, type EnforcedFs } from '../../../../../../tests/rules/engine/rulesFs';

export const T = 'trainer-1';
export const C = 'client-1';
export const NOW = Date.UTC(2026, 9, 12, 9, 0, 0);

const clone = <T>(x: T): T => structuredClone(x);
const getPath = (o: Doc, p: string): unknown =>
  p
    .split('.')
    .reduce<unknown>((a, k) => (a && typeof a === 'object' ? (a as Doc)[k] : undefined), o);

function applyQuery(rows: Row[], q?: Query): Row[] {
  let out = rows;
  for (const [f, op, v] of q?.where ?? []) {
    out = out.filter((r) => {
      const x = getPath(r.data, f) as number | null | undefined;
      if (op === '==') return x === v;
      if (x === undefined || x === null) return false;
      if (op === 'in') return (v as unknown[]).includes(x);
      if (op === '<') return x < (v as number);
      if (op === '<=') return x <= (v as number);
      if (op === '>') return x > (v as number);
      return x >= (v as number);
    });
  }
  if (q?.after !== undefined)
    out = [...out].filter((r) => r.id > q.after!).sort((a, b) => (a.id < b.id ? -1 : 1));
  else if (q?.orderBy) {
    const [f, dir] = q.orderBy;
    out = [...out].sort((a, b) => {
      const x = getPath(a.data, f) as number;
      const y = getPath(b.data, f) as number;
      return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'asc' ? 1 : -1);
    });
  }
  return q?.limit ? out.slice(0, q.limit) : out;
}

/** The server's Kv over the shared MemoryFs (writes notify the device listeners). `tx` rolls back by journal. */
export function kvOver(fs: MemoryFs, journal?: Map<string, Raw | null>): Kv {
  const note = async (p: string) => {
    if (journal && !journal.has(p)) journal.set(p, await fs.get(p));
  };
  const parent = (p: string) => p.slice(0, p.lastIndexOf('/'));
  const rowsOf = async (pred: (path: string) => boolean): Promise<Row[]> =>
    Promise.all(
      fs
        .keys('')
        .filter(pred)
        .map(async (p) => ({
          id: p.slice(p.lastIndexOf('/') + 1),
          path: p,
          data: (await fs.get(p)) as Doc,
        })),
    );
  const kv: Kv = {
    get: (p) => fs.get(p),
    async set(p, d) {
      await note(p);
      await fs.set(p, d as Raw);
    },
    async merge(p, patch) {
      await note(p);
      await fs.update(p, patch as Raw);
    },
    async del(p) {
      await note(p);
      await fs.del(p);
    },
    async list(coll, q) {
      return applyQuery(await rowsOf((p) => parent(p) === coll), q);
    },
    async group(id, q) {
      return applyQuery(
        await rowsOf(
          (p) => parent(p).split('/').pop() === id && parent(p).split('/').length % 2 === 1,
        ),
        q,
      );
    },
    async tx(fn) {
      const j = new Map<string, Raw | null>();
      try {
        const r = await fn(kvOver(fs, j));
        if (journal) for (const [k, v] of j) if (!journal.has(k)) journal.set(k, v);
        return r;
      } catch (e) {
        for (const [p, v] of j) {
          if (v) fs.seed(p, v);
          else await fs.del(p).catch(() => undefined);
        }
        throw e;
      }
    },
  };
  return kv;
}

export interface Pushes {
  uid: string;
  kind: string;
}

export interface Server {
  fs: MemoryFs;
  kv: Kv;
  pushes: Pushes[];
  pepper: Uint8Array;
  ctx: svc.Ctx;
  signer: svc.Signer;
  cidOf(clientId: string, trainerId: string): string;
}

function asHttp(e: unknown): never {
  if (e instanceof svc.CoachError)
    throw Object.assign(new Error(e.reason), { code: e.code, status: 400, reason: e.reason });
  throw e;
}

export async function makeServer(): Promise<Server> {
  const fs = createMemoryFs(NOW);
  const pair = generateKeyPairSync('ed25519');
  const pem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  fs.seed('config/coachSigning', { alg: 'Ed25519', kid: 'srv1', pub: pem });
  const pepper = new Uint8Array(randomBytes(32));
  const pushes: Pushes[] = [];
  let n = 0;
  const kv = kvOver(fs);
  const ctx: svc.Ctx = {
    kv,
    now: () => fs.now(),
    pepper,
    newToken: () => `tok${(++n).toString().padStart(12, '0')}`,
    baseUrl: 'https://spotter.test',
    notify: async (uid, kind) => void pushes.push({ uid, kind }),
  };
  const signer: svc.Signer = {
    kid: 'srv1',
    sign: (payload) => edSign(null, Buffer.from(payload), pair.privateKey).toString('base64'),
  };
  await kv.set(`users/${T}`, {
    role: 'trainer',
    status: 'active',
    firstName: 'Iryna',
    lastName: 'Melnyk',
    username: 'iryna',
  });
  await kv.set(`users/${C}`, {
    role: 'member',
    status: 'active',
    firstName: 'Oleh',
    lastName: 'K',
    username: 'oleh',
    trainerId: null,
  });
  return { fs, kv, pushes, pepper, ctx, signer, cidOf: (c, t) => conversationId(pepper, c, t) };
}

type Role = 'member' | 'trainer' | 'admin';
const CALLS: Record<string, (s: Server, a: svc.Actor, d: Raw) => Promise<unknown>> = {
  coachInvite: (s, a, d) => svc.coachInvite(s.ctx, a, d),
  coachInviteRevoke: (s, a, d) => svc.coachInviteRevoke(s.ctx, a, d),
  coachInvitePreview: (s, a, d) => svc.invitePreview(s.ctx, d.token, a),
  coachAccept: (s, a, d) => svc.coachAccept(s.ctx, a, d),
  coachDecline: (s, a, d) => svc.coachDecline(s.ctx, a, d),
  coachEnd: (s, a, d) => svc.coachEnd(s.ctx, a, d),
  setCoachingMode: (s, a, d) => svc.setCoachingMode(s.ctx, a, d),
  setConsent: (s, a, d) => svc.setConsent(s.ctx, a, d),
  coachMyLink: (s, a) => svc.coachMyLink(s.ctx, a),
  coachAdoptLegacy: (s, a) => adoptMyLegacyTrainer(s.ctx, a),
  coachRead: (s, a, d) => svc.coachRead(s.ctx, a, d),
  coachLogRead: (s, a, d) => svc.logRead(s.ctx, a, d),
  coachClients: (s, a) => svc.coachRoster(s.ctx, a),
  coachChatReset: (s, a, d) => svc.chatResetKey(s.ctx, a, d),
  rescheduleCreate: (s, a, d) => svc.rescheduleCreate(s.ctx, a, d),
  rescheduleRespond: (s, a, d) => svc.rescheduleRespond(s.ctx, a, d),
  publishPlanVersion: (s, a, d) => svc.publishPlanVersion(s.ctx, a, d),
  programAck: (s, a, d) => svc.programAck(s.ctx, a, d),
  coachPublishSignKey: (s, a, d) => svc.publishSignKey(s.ctx, a, d, s.signer),
  coachKeySign: (s, a) => svc.coachKeySign(s.ctx, a, s.signer),
  coachExport: (s, a, d) => svc.coachExport(s.ctx, a, d),
};

/** An FsApi for ONE signed-in device: same store, callables run as this actor, device writes fire the server triggers. */
export const RULES = parseRules(readFileSync(resolve(process.cwd(), '../firestore.rules'), 'utf8'));
export function deviceFs(
  s: Server,
  actor: svc.Actor,
  enforce = true,
): FsApi & { offline: boolean; denied: EnforcedFs['denied'] } {
  const admin = s.fs;
  const dev: FsApi & Partial<EnforcedFs> = enforce
    ? enforceRules(RULES, s.fs, { uid: actor.uid, role: actor.role })
    : s.fs;
  const base = dev as FsApi;
  const state = { offline: false };
  const trig = async (path: string, before: Raw | null) => {
    const after = await admin.get(path);
    let m: RegExpExecArray | null;
    if ((m = /^conversations\/([^/]+)\/messages\/([^/]+)$/.exec(path))) {
      if (!before && after) await svc.afterMessageCreated(s.ctx, m[1], m[2]);
      else if (before && after) await svc.recomputeConversation(s.ctx, m[1]);
    } else if ((m = /^conversations\/([^/]+)$/.exec(path))) {
      await svc.onConversationKey(s.ctx, m[1], before as Doc | null, after as Doc | null);
      const ptr = (d: Raw | null) => JSON.stringify([d?.readUpTo ?? {}, d?.clearedBefore ?? {}]);
      if (ptr(before) !== ptr(after)) await svc.recomputeConversation(s.ctx, m[1]);
    } else if ((m = /^coachKeys\/([^/]+)$/.exec(path))) {
      await svc.onCoachKeyChanged(s.ctx, m[1], before as Doc | null, after as Doc | null);
    }
  };
  const watched = (p: string) =>
    /^(conversations\/[^/]+(\/messages\/[^/]+)?|coachKeys\/[^/]+)$/.test(p);
  const gate = () => {
    if (state.offline)
      throw Object.assign(new Error('offline'), { code: 'unavailable', status: 0 });
  };
  const fs: FsApi & { offline: boolean; denied: EnforcedFs['denied'] } = {
    get denied() {
      return dev.denied ?? [];
    },
    get offline() {
      return state.offline;
    },
    set offline(v) {
      state.offline = v;
    },
    now: () => base.now(),
    get: async (p) => (gate(), base.get(p)),
    async set(p, d) {
      gate();
      const b = watched(p) ? await admin.get(p) : null;
      await base.set(p, d);
      if (watched(p)) await trig(p, b);
    },
    async update(p, patch) {
      gate();
      const b = watched(p) ? await admin.get(p) : null;
      await base.update(p, patch);
      if (watched(p)) await trig(p, b);
    },
    async del(p) {
      gate();
      await base.del(p);
    },
    async batch(ops: readonly FsOp[]) {
      gate();
      const bs = new Map<string, Raw | null>();
      for (const o of ops) if (watched(o.path)) bs.set(o.path, await admin.get(o.path));
      await base.batch(ops);
      for (const [p, b] of bs) await trig(p, b);
    },
    async transact(fn) {
      gate();
      return base.transact(fn);
    },
    listenDoc: (p, on, err) => base.listenDoc(p, on, err),
    listen: (c, q: FsQuery, on, err) => base.listen(c, q, on, err),
    getDocs: async (c, q) => (gate(), base.getDocs(c, q)),
    async call<T>(name: string, data: Raw): Promise<T> {
      gate();
      admin.calls.push({ name, data: clone(data) });
      const h = CALLS[name];
      if (!h) throw Object.assign(new Error('unimplemented ' + name), { code: 'unimplemented' });
      try {
        return (await h(s, actor, data)) as T;
      } catch (e) {
        return asHttp(e);
      }
    },
  };
  return fs;
}

export const trainerActor: svc.Actor = { uid: T, role: 'trainer' as Role };
export const clientActor: svc.Actor = { uid: C, role: 'member' as Role };

export interface Side<P> {
  fs: ReturnType<typeof deviceFs>;
  vault: Awaited<ReturnType<typeof readyVault>>;
  ports: P;
  stop(): void;
  ended: string[];
}

const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
export { settle };
