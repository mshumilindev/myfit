import type { Vault } from '../../../../autoVault';
import { readyVault } from '../../../../testVault';
import { createCoachKey, type CoachKeyRecord } from '../../../../vaultShare';
import { ensureGrant, type GrantPorts, type StoredGrant } from '../../../../vaultGrants';
import type { Activity, Workout } from '../../../../types';
import { createRingProvider } from '../keyRing';
import { createRingBook } from '../ringBook';
import { createServerSigningLoader, createSignerDirectory } from '../trust';
import { createDeviceSigner, memorySignerStorage } from '../signerStore';
import { createFirestoreChatPort } from '../chatPort';
import { createFirestoreClientChatPort } from '../clientChatPort';
import { createFirestoreClientPort } from '../clientPort';
import { createFirestoreInvitePort } from '../invitePort';
import { createFirestoreProgramPort } from '../programPort';
import { summarizeChanges } from '../../../program/summary';
import { PG_LOCALES } from '../../../../i18n/coachProgram';
import { createFirestoreWorldPort } from '../worldPort';
import { createFirestoreScheduleStore } from '../scheduleDocStore';
import { createSealedSchedulePort } from '../../../schedule/sealedPort';
import { createFirestoreNotesStore } from '../notesDocStore';
import { createSealedNotesPort } from '../../../notes/sealedPort';
import { createFirestoreShareSource } from '../shareSource';
import { createFirestoreTrustPort } from '../trustPort';
import { createFirestoreReadLog } from '../readLogPort';
import { createSharesPublisher } from '../sharesPublisher';
import { createFirestoreLivePort } from '../livePort';
import { createLiveWriter } from '../liveWriter';
import { scheduleStoreFor } from '../../../schedule/useSchedule';
import { clientStoreFor } from '../../../client/data/store';
import { C, T, deviceFs, trainerActor, clientActor, type Server } from './harness';

export interface TrainerSide {
  fs: ReturnType<typeof deviceFs>;
  vault: Vault;
  rec: CoachKeyRecord;
  rings: ReturnType<typeof createRingProvider>;
  book: ReturnType<typeof createRingBook>;
  chat: ReturnType<typeof createFirestoreChatPort>;
  schedule: ReturnType<typeof createSealedSchedulePort>;
  notes: ReturnType<typeof createSealedNotesPort>;
  program: ReturnType<typeof createFirestoreProgramPort>;
  world: ReturnType<typeof createFirestoreWorldPort>;
  invite: ReturnType<typeof createFirestoreInvitePort>;
  share: ReturnType<typeof createFirestoreShareSource>;
  live: ReturnType<typeof createFirestoreLivePort>;
  trust: ReturnType<typeof createFirestoreTrustPort>;
  readLog: ReturnType<typeof createFirestoreReadLog>;
  ended: string[];
  /** the trainer device publishes a NEW coach key pair (new device / rotation), signed by the server */
  rotateKey(): Promise<CoachKeyRecord>;
}

export async function makeTrainer(s: Server, name = 'Iryna Melnyk'): Promise<TrainerSide> {
  const fs = deviceFs(s, trainerActor);
  const vault = await readyVault();
  const m = vault.materialOrNull()!;
  const rec = await createCoachKey(m.key, m.salt);
  // ensureCoachKey equivalent: publish the public half, ask the server to sign it (keepCoachKeySigned)
  await fs.set(`coachKeys/${T}`, { pub: rec.pub, updatedAt: fs.now() });
  await fs.call('coachKeySign', {});
  const signing = createServerSigningLoader(fs);
  const holder = { rec };
  const loadOwnCoachKey = async () => holder.rec;
  const ended: string[] = [];
  const rings = createRingProvider({
    fs,
    vault,
    uid: T,
    side: 'trainer',
    loadOwnCoachKey,
    signing,
  });
  const book = createRingBook({
    fs,
    rings,
    uid: T,
    side: 'trainer',
    onEnded: (cid) => {
      ended.push(cid);
      rings.forget();
    },
  });
  book.start();
  const schedule = createSealedSchedulePort({
    store: createFirestoreScheduleStore({ fs, book }),
    vault,
    ringFor: book.ringFor,
    ringForEpoch: book.ringForEpoch,
    uid: T,
    now: () => fs.now(),
  });
  const notes = createSealedNotesPort({
    store: createFirestoreNotesStore({ fs, book, uid: T }),
    vault,
    ringFor: book.ringFor,
    ringForEpoch: book.ringForEpoch,
    uid: T,
    now: () => fs.now(),
  });
  const chat = createFirestoreChatPort({
    fs,
    vault,
    uid: T,
    side: 'trainer',
    rings,
    signer: createDeviceSigner({ fs, uid: T, storage: memorySignerStorage() }),
    directory: createSignerDirectory(fs, signing),
    onEnded: (cid) => ended.push(cid),
  });
  const world = createFirestoreWorldPort({
    fs,
    vault,
    trainer: { id: T, name },
    loadOwnCoachKey,
    schedule: async () => {
      await book.ready();
      return new Promise((res) => {
        const off = schedule.subscribe(
          (d) => {
            res(d);
            queueMicrotask(off);
          },
          () => res(null),
        );
        setTimeout(() => res(null), 500);
      });
    },
  });
  const program = createFirestoreProgramPort({
    fs,
    vault,
    trainer: { id: T, name },
    book,
    roster: () => world.peek()?.data.clients ?? [],
    // the same wiring as install.ts
    summarize: (changes) => summarizeChanges(changes, PG_LOCALES.en),
    announce: (clientId, card) =>
      chat.send(`cid-${clientId}`, {
        id: card.id,
        text: '',
        at: fs.now(),
        body: {
          kind: 'system',
          type: 'program-updated',
          text: card.summary ? `v${card.version} · ${card.summary}` : `v${card.version}`,
        },
      }),
  });
  const share = createFirestoreShareSource({
    fs,
    vault,
    side: 'trainer',
    uid: T,
    loadOwnCoachKey,
    plan: { ringFor: book.ringFor, ringForEpoch: book.ringForEpoch, ready: book.ready },
  });
  const live = createFirestoreLivePort({
    fs,
    vault,
    ringForEpoch: book.ringForEpoch,
    onRings: book.watch,
  });
  return {
    fs,
    vault,
    rec,
    rings,
    book,
    chat,
    schedule,
    notes,
    program,
    world,
    invite: createFirestoreInvitePort(fs),
    share,
    live,
    trust: createFirestoreTrustPort(fs, signing),
    readLog: createFirestoreReadLog(fs),
    ended,
    async rotateKey() {
      const next = await createCoachKey(m.key, m.salt);
      holder.rec = next;
      rings.forget();
      await fs.set(`coachKeys/${T}`, { pub: next.pub, updatedAt: fs.now() + 1 });
      await fs.call('coachKeySign', {});
      return next;
    },
  };
}

export interface ClientSide {
  fs: ReturnType<typeof deviceFs>;
  vault: Vault;
  rings: ReturnType<typeof createRingProvider>;
  book: ReturnType<typeof createRingBook>;
  chat: ReturnType<typeof createFirestoreChatPort>;
  chatClient: ReturnType<typeof createFirestoreClientChatPort>;
  port: ReturnType<typeof createFirestoreClientPort>;
  schedule: ReturnType<typeof createSealedSchedulePort>;
  notes: ReturnType<typeof createSealedNotesPort>;
  share: ReturnType<typeof createFirestoreShareSource>;
  trust: ReturnType<typeof createFirestoreTrustPort>;
  publisher: ReturnType<typeof createSharesPublisher>;
  liveWriter: ReturnType<typeof createLiveWriter>;
  workouts: Workout[];
  activities: Activity[];
  ended: string[];
  keyExchanges: (string | null)[];
  snap(): import('../../../client/data/types').ClientSnapshot | null;
  errors: unknown[];
}

export async function makeClient(s: Server, name = 'Oleh'): Promise<ClientSide> {
  const fs = deviceFs(s, clientActor);
  const vault = await readyVault();
  const signing = createServerSigningLoader(fs);
  const ended: string[] = [];
  const keyExchanges: (string | null)[] = [];
  const rings = createRingProvider({ fs, vault, uid: C, side: 'client', signing });
  const book = createRingBook({
    fs,
    rings,
    uid: C,
    side: 'client',
    onEnded: (cid) => {
      ended.push(cid);
      rings.forget();
    },
  });
  book.start();
  const chat = createFirestoreChatPort({
    fs,
    vault,
    uid: C,
    side: 'client',
    rings,
    signer: createDeviceSigner({ fs, uid: C, storage: memorySignerStorage() }),
    directory: createSignerDirectory(fs, signing),
    onEnded: (cid) => ended.push(cid),
  });
  // vaultIO.runKeyExchange(trainerId,false) -> ensureGrant(vault, trainerId, grantPorts(uid)) on the same documents
  const ports: GrantPorts = {
    loadOwnCoachKey: async () => null,
    saveOwnCoachKey: async () => undefined,
    publishCoachPub: async () => undefined,
    async loadCoachPub(id) {
      return ((await fs.get(`coachKeys/${id}`))?.pub as JsonWebKey | undefined) ?? null;
    },
    async loadGrant(id) {
      return (await fs.get(`users/${C}/grants/${id}`)) as unknown as StoredGrant | null;
    },
    async saveGrant(id, g) {
      await fs.set(`users/${C}/grants/${id}`, g as never);
    },
    async listGrantIds() {
      return (await fs.getDocs(`users/${C}/grants`, {})).map((r) => r.id);
    },
    async deleteGrant(id) {
      await fs.del(`users/${C}/grants/${id}`);
    },
  };
  const side = { workouts: [] as Workout[], activities: [] as Activity[] } as Pick<
    ClientSide,
    'workouts' | 'activities'
  >;
  const port = createFirestoreClientPort({
    fs,
    vault,
    uid: C,
    afterLink: async (tid) => {
      keyExchanges.push(tid);
      await ensureGrant(vault, tid, ports);
      await book.refresh();
    },
    onLeft: (cid) => {
      if (cid) {
        ended.push(cid);
        rings.forget();
      }
    },
    plan: { ringFor: book.ringFor, ringForEpoch: book.ringForEpoch, ready: book.ready },
  });
  let latest: import('../../../client/data/types').ClientSnapshot | null = null;
  const errors: unknown[] = [];
  port.subscribe(
    (x) => {
      latest = x;
    },
    (e) => errors.push(e),
  );
  const schedule = createSealedSchedulePort({
    store: createFirestoreScheduleStore({ fs, book }),
    vault,
    ringFor: book.ringFor,
    ringForEpoch: book.ringForEpoch,
    uid: C,
    now: () => fs.now(),
    adoptZone: true,
  });
  // the same wiring as installFirestoreClient: the trainer's shared notes, read only
  const notes = createSealedNotesPort({
    store: createFirestoreNotesStore({ fs, book, uid: C }),
    vault,
    ringFor: book.ringFor,
    ringForEpoch: book.ringForEpoch,
    uid: C,
    now: () => fs.now(),
  });
  const share = createFirestoreShareSource({
    fs,
    vault,
    side: 'client',
    uid: C,
    own: () => side.workouts,
    ownActivities: () => side.activities,
    ownName: () => name,
    plan: { ringFor: book.ringFor, ringForEpoch: book.ringForEpoch, ready: book.ready },
  });
  const publisher = createSharesPublisher({ fs, vault, uid: C });
  const liveWriter = createLiveWriter({
    fs,
    vault,
    uid: C,
    ring: async () => {
      await book.ready();
      const r = book.ringFor(C);
      if (!r) throw new Error('chat-key-missing');
      return r;
    },
  });
  return {
    fs,
    vault,
    rings,
    book,
    chat,
    chatClient: createFirestoreClientChatPort({ fs, chat, uid: C }),
    port,
    schedule,
    notes,
    share,
    trust: createFirestoreTrustPort(fs, signing),
    publisher,
    liveWriter,
    ended,
    keyExchanges,
    snap: () => latest,
    errors,
    get workouts() {
      return side.workouts;
    },
    set workouts(v) {
      side.workouts = v;
    },
    get activities() {
      return side.activities;
    },
    set activities(v) {
      side.activities = v;
    },
  } as ClientSide;
}
export { scheduleStoreFor, clientStoreFor };
