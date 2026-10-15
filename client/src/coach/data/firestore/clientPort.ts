/**
 * The real `ClientCoachPort`: the client's side of the trainer link (S-25 .. S-34) over the coach callables and the
 * client's own documents. The server holds the rules; this adapter only maps them to the screens' model.
 *
 *   link        coaching/{me} (own read) + `coachMyLink` (the trainer's display NAME and the conversation id: a client
 *               cannot read another profile) + users/{me}/grants/{trainer} (missing = the trainer app has not turned
 *               sharing on yet -> `waiting`).
 *   accept      `coachAccept({ token, consent })`: nothing is written before this call, the consent is the client's own
 *               choice. Afterwards `afterLink` runs the key exchange (the grant for the trainer's key).
 *   setLevel    `setConsent`: applies at once; a downgrade deletes derived shares and the trainer's evidence server-side.
 *   revoke      `setConsent` with everything off (the relationship stays); restore writes the previous levels back.
 *   leave       `coachEnd`; chat and program stay with the client.
 *   accessLog   users/{me}/audit (the trainer's reads, content-free: category, via, count, time).
 *   program     `plans/{me}` + the LIVE version, opened with the conversation key ring (`clientProgram.ts`); null without
 *               a published version or a key on this device. `acked` follows the "Program updated" notice; `ackProgram`
 *               marks that notice as read.
 */
import { sealOrThrow, openSealed, VaultLockedError } from '../../../coachCrypto/sealOrThrow';
import type { Vault } from '../../../autoVault';
import type { Consent, Dow } from '../../domain/types';
import { CATEGORIES, DOWS } from '../../domain/types';
import { ALL_OFF } from '../../domain/consent';
import type { ClientCoachPort } from '../../client/data/port';
import { classifyProblem } from '../problem';
import {
  ClientPortError,
  type AccessEntry,
  type AccessWhat,
  type ClientSnapshot,
  type InviteInfo,
  type InviteState,
} from '../../client/data/types';
import type { ChatKeyRing } from '../../../coachCrypto/conversationKey';
import { readProgramLayer } from './clientProgram';
import type { FsApi, Raw } from './fsApi';

export interface ClientPortDeps {
  fs: FsApi;
  vault: Vault;
  uid: string;
  /** Runs the key exchange for the new trainer (vaultIO.runKeyExchange). Failures are silent: retried on the next trigger. */
  afterLink?: (trainerId: string | null) => Promise<void> | void;
  /** The relationship ended on this device: wipe the sealed chat cache of this conversation. */
  onLeft?: (cid: string | null) => void;
  cache?: {
    get(): Promise<ClientSnapshot | null>;
    set(s: ClientSnapshot): Promise<void>;
  };
  /** The member's own conversation key ring (ring book): without it the program layer stays null. */
  plan?: {
    ringFor(clientId: string): ChatKeyRing | null;
    ringForEpoch?(clientId: string, epoch: number): ChatKeyRing | null;
    ready(): Promise<void>;
  };
}

interface LinkInfo {
  linked: boolean;
  trainer?: { id: string; name: string };
  since?: number;
  cid?: string;
  mode?: string;
  consentVersion?: number;
}

const PROBLEM: Record<string, InviteState> = {
  expired: 'expired',
  claimed: 'used',
  revoked: 'declined',
};

const VIA_WHAT: Record<string, AccessWhat> = {
  client360: 'summary',
  queue: 'week',
  brief: 'summary',
  export: 'history',
  'chat-share': 'summary',
  live: 'live',
  view: 'session',
};

const level = (v: unknown): Consent[keyof Consent] => (v === 'full' || v === 'effects' ? v : 'off');
const toConsent = (raw: unknown): Consent => {
  const o = (raw ?? {}) as Record<string, unknown>;
  return Object.fromEntries(CATEGORIES.map((c) => [c, level(o[c])])) as Consent;
};
const sharesNothing = (c: Consent) => CATEGORIES.every((k) => k === 'checkins' || c[k] === 'off');

/** The listener / link-info path only reads: there a not-found callable or document means the backend is not deployed. */
function toLoadError(e: unknown): ClientPortError {
  const r = toError(e);
  return r.code === 'not-found' ? new ClientPortError('not-deployed') : r;
}

function toError(e: unknown): ClientPortError {
  if (e instanceof ClientPortError) return e;
  const x = e as { code?: unknown; status?: unknown; name?: unknown; message?: unknown } | null;
  if (x?.name === 'VaultLockedError' || x?.message === 'vault-locked')
    return new ClientPortError('vault-locked');
  const code = typeof x?.code === 'string' ? x.code.replace(/^functions\/|^firestore\//, '') : '';
  const status = typeof x?.status === 'number' ? x.status : 0;
  const why = classifyProblem(e);
  if (why === 'denied') return new ClientPortError('forbidden');
  // a missing callable / collection is "not deployed"; a not-found invite or link keeps its own code
  if (why === 'not-deployed' && (code === 'unimplemented' || status === 501))
    return new ClientPortError('not-deployed');
  if (code === 'not-found' || status === 404) return new ClientPortError('not-found');
  if (code === 'unavailable' || status === 0 || status === 503 || status === 504)
    return new ClientPortError('offline');
  return new ClientPortError('unavailable');
}

export function createFirestoreClientPort(d: ClientPortDeps): ClientCoachPort {
  const { fs, uid } = d;
  let last: ClientSnapshot | null = null;
  let info: LinkInfo | null = null;
  let infoKey = '';
  let selfDays: readonly Dow[] = [];
  const subs = new Set<(s: ClientSnapshot) => void>();

  // the on-device snapshot (sealed): read once, in the background; `hydrate` lets the store adopt it when it lands
  const hydrated: Promise<void> = d.cache
    ? d.cache
        .get()
        .then((c) => {
          if (c && !last) last = c;
        })
        .catch(() => undefined)
    : Promise.resolve();

  const selfPath = `users/${uid}/meta/selfCoach`;

  // A legacy trainer (`users.trainerId`, the card the app already shows) without a coaching document yet: ask the server once
  // per session to adopt it (mode app, every level off = nothing shared until the member chooses). The `coaching/{me}` listener
  // then delivers the document and the key exchange runs, so the card opens the real screens and not "No trainer yet".
  // The result is awaited BEFORE the first snapshot of a member without a coaching document: a failing adoption (service not deployed,
  // denied, offline) is an error the screen explains (with the legacy trainer card), never a silent "No trainer yet".
  let adoptP: Promise<ClientPortError | null> | null = null;
  function adoptLegacy(): Promise<ClientPortError | null> {
    adoptP ??= (async () => {
      try {
        const r = await fs.call<{ adopted?: boolean; trainerId?: string | null }>(
          'coachAdoptLegacy',
          {},
        );
        if (r?.adopted)
          await Promise.resolve(d.afterLink?.(r.trainerId ?? null)).catch(() => undefined);
        return null;
      } catch (e) {
        adoptP = null; // the next subscription (Retry, next session) asks again
        return toLoadError(e);
      }
    })();
    return adoptP;
  }

  async function loadInfo(c: Raw | null): Promise<LinkInfo> {
    const key = c ? `${String(c.trainerId)}|${String(c.status)}|${String(c.consentVersion)}` : '';
    if (info && key === infoKey) return info;
    if (!c || c.status !== 'active') {
      infoKey = key;
      return (info = { linked: false });
    }
    try {
      info = await fs.call<LinkInfo>('coachMyLink', {});
      infoKey = key;
    } catch (e) {
      if (!info?.linked) throw e; // keep the previous trainer line while offline
    }
    return info!;
  }

  async function build(
    c: Raw | null,
    grant: Raw | null,
    planDoc: Raw | null,
    notice: Raw | null,
  ): Promise<ClientSnapshot> {
    const li = await loadInfo(c);
    const asOf = fs.now();
    if (!c || !li.linked || !li.trainer) {
      return {
        link: {
          state: 'none',
          trainer: null,
          grants: { ...ALL_OFF },
          cid: null,
          clientId: uid,
          lastSeenAt: null,
        },
        program: null,
        selfCoachDays: selfDays,
        asOf,
      };
    }
    const grants = toConsent(c.consent);
    if (d.plan) await d.plan.ready();
    const program = await readProgramLayer({
      fs,
      vault: d.vault,
      uid,
      ring: d.plan?.ringFor(uid) ?? null,
      ringAt: d.plan?.ringForEpoch ? (epoch) => d.plan!.ringForEpoch!(uid, epoch) : undefined,
      plan: planDoc,
      notice,
    });
    const state =
      c.mode !== 'program' && !grant
        ? 'waiting'
        : sharesNothing(grants) && Number(c.consentVersion ?? 1) > 1 && c.mode !== 'program'
          ? 'revoked'
          : 'active';
    return {
      link: {
        state,
        trainer: { id: li.trainer.id, name: li.trainer.name, org: '', since: li.since ?? asOf },
        grants,
        cid: li.cid ?? null,
        clientId: uid,
        lastSeenAt: null,
        ...(c.migratedFrom && sharesNothing(grants) && Number(c.consentVersion ?? 1) <= 1
          ? { migrated: true }
          : {}),
      },
      program,
      selfCoachDays: selfDays,
      asOf,
    };
  }

  const publish = (s: ClientSnapshot) => {
    last = s;
    void d.cache?.set(s).catch(() => undefined);
    subs.forEach((f) => f(s));
  };

  async function loadSelfDays(): Promise<void> {
    try {
      const raw = await fs.get(selfPath);
      if (!raw) return;
      const o = await openSealed<{ days?: unknown }>('selfCoach', raw, { vault: d.vault });
      selfDays = Array.isArray(o.days)
        ? (o.days.filter((x) => DOWS.includes(x as Dow)) as Dow[])
        : [];
    } catch {
      /* locked or unreadable: keep empty */
    }
  }

  return {
    now: () => fs.now(),
    peek: () => last,
    hydrate: () => hydrated,

    subscribe(on, onError) {
      let stop = false;
      let coaching: Raw | null = null;
      let grant: Raw | null = null;
      let grantFor = '';
      let grantOff: (() => void) | null = null;
      let planDoc: Raw | null = null;
      let notice: Raw | null = null;
      let seq = 0;
      let gotDoc = false;
      // while a missing coaching document waits for the legacy adoption, no snapshot is published (it would say "no trainer")
      let adopting = false;
      subs.add(on);
      if (last) on(last);
      const run = () => {
        if (adopting) return;
        const mine = ++seq;
        void build(coaching, grant, planDoc, notice).then(
          (s) => {
            if (!stop && mine === seq) publish(s);
          },
          (e) => !stop && onError(toLoadError(e)),
        );
      };
      void loadSelfDays().then(() => !stop && gotDoc && run());
      // the plan and its notice: a published version arrives as a change of `plans/{me}`
      const planOff = fs.listenDoc(
        `plans/${uid}`,
        (doc) => {
          planDoc = doc;
          if (gotDoc) run();
        },
        () => undefined,
      );
      const noticeOff = fs.listenDoc(
        `users/${uid}/notices/pu-${uid}`,
        (doc) => {
          notice = doc;
          if (gotDoc) run();
        },
        () => undefined,
      );
      const off = fs.listenDoc(
        `coaching/${uid}`,
        (doc) => {
          gotDoc = true;
          coaching = doc;
          const needAdopt = !doc || doc.status !== 'active';
          const tid = doc?.status === 'active' ? String(doc.trainerId) : '';
          if (tid !== grantFor) {
            grantOff?.();
            grantOff = null;
            grantFor = tid;
            grant = null;
            if (tid)
              grantOff = fs.listenDoc(
                `users/${uid}/grants/${tid}`,
                (g) => {
                  grant = g;
                  run();
                },
                (e) => onError(toLoadError(e)),
              );
          }
          adopting = needAdopt;
          if (!needAdopt) return run();
          void adoptLegacy().then((err) => {
            if (stop) return;
            if (err) return onError(err); // stays blocked: the screen shows why (Retry subscribes again)
            adopting = false;
            run();
          });
        },
        (e) => onError(toLoadError(e)),
      );
      return () => {
        stop = true;
        subs.delete(on);
        off();
        planOff();
        noticeOff();
        grantOff?.();
      };
    },

    async getInvite(token): Promise<InviteInfo> {
      try {
        const r = await fs.call<{
          kind?: string;
          trainerName?: string;
          expiresAt?: number;
          problem?: string | null;
        }>('coachInvitePreview', { token });
        if (r.problem === 'wrong-kind' || r.problem === 'not-for-you')
          throw new ClientPortError('not-found');
        return {
          token,
          state: r.problem ? (PROBLEM[r.problem] ?? 'expired') : 'valid',
          trainerName: r.trainerName ?? '',
          org: '',
          expiresAt: r.expiresAt ?? 0,
        };
      } catch (e) {
        throw toError(e);
      }
    },

    async acceptInvite(token, grants) {
      try {
        const r = await fs.call<{ trainerId: string }>('coachAccept', { token, consent: grants });
        info = null;
        infoKey = '';
        await Promise.resolve(d.afterLink?.(r.trainerId)).catch(() => undefined);
      } catch (e) {
        throw toError(e);
      }
    },
    async declineInvite(token) {
      try {
        await fs.call('coachDecline', { token });
      } catch (e) {
        throw toError(e);
      }
    },
    async setLevel(category, lvl) {
      try {
        await fs.call('setConsent', { category, level: lvl });
      } catch (e) {
        throw toError(e);
      }
    },
    async revoke() {
      const previous = last?.link.grants ?? { ...ALL_OFF };
      try {
        await fs.call('setConsent', { consent: { ...ALL_OFF } });
      } catch (e) {
        throw toError(e);
      }
      return { previous };
    },
    async restore(previous: Consent) {
      try {
        await fs.call('setConsent', { consent: previous });
      } catch (e) {
        throw toError(e);
      }
    },
    async leave() {
      const cid = last?.link.cid ?? null;
      try {
        await fs.call('coachEnd', { clientId: uid });
      } catch (e) {
        throw toError(e);
      }
      info = null;
      infoKey = '';
      d.onLeft?.(cid);
      void d.afterLink?.(null);
    },
    async accessLog(): Promise<AccessEntry[]> {
      try {
        const rows = await fs.getDocs(`users/${uid}/audit`, {
          orderBy: ['at', 'desc'],
          limit: 200,
        });
        const out: AccessEntry[] = [];
        for (const r of rows) {
          const cat = CATEGORIES.find((c) => c === r.data.category);
          if (!cat) continue;
          out.push({
            id: r.id,
            at: Number(r.data.lastAt ?? r.data.at ?? 0),
            category: cat,
            what: VIA_WHAT[String(r.data.via)] ?? 'summary',
            ...(Number(r.data.count) > 1 ? { count: Number(r.data.count) } : {}),
          });
        }
        return out;
      } catch (e) {
        throw toError(e);
      }
    },
    async ackProgram(version) {
      try {
        // the program notice is the only open trace of "a new version"; reading it clears the dot
        await fs.update(`users/${uid}/notices/pu-${uid}`, { readAt: fs.now() });
      } catch {
        /* nothing to mark (no notice) */
      }
      // and the trainer is told which version was opened ("Seen by ..."); best effort, never blocks the dot
      await fs.call('programAck', { version }).catch(() => undefined);
    },
    async setSelfCoachDays(input) {
      const days = input.filter((x): x is Dow => DOWS.includes(x as Dow));
      try {
        const doc = await sealOrThrow(
          'selfCoach',
          { updatedAt: fs.now(), days },
          { vault: d.vault },
        );
        await fs.set(selfPath, doc);
        selfDays = days;
        if (last) publish({ ...last, selfCoachDays: days, asOf: fs.now() });
      } catch (e) {
        if (e instanceof VaultLockedError) throw new ClientPortError('vault-locked');
        throw toError(e);
      }
    },
  };
}
