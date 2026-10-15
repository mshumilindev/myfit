/**
 * Selects the real adapters. This runs whenever the backend mode is `firestore` (the default outside tests and Storybook;
 * see `backend.ts`) and the `coach` flag is on, from `bootstrap.ts`. It is a function, never a side effect of import, so tests and
 * stories stay offline. Two entry points, one per side of a relationship:
 *
 *   installFirestoreCoach    the trainer's dashboard: world, chat (sealed local cache around it), notes, schedule (+requests),
 *                            live, invites, share source, read log.
 *   installFirestoreClient   the member's app: link (`ClientCoachPort`), chat, schedule, share source, and the publisher of
 *                            the derived `effects` view of the sets.
 *
 * Both return a teardown that forgets every key and puts the fixtures back (sign-out).
 */
import type { Vault } from '../../../autoVault';
import type { CoachKeyRecord } from '../../../vaultShare';
import type { Activity, Workout } from '../../../types';
import { configureClientCoach } from '../../client/data/config';
import { withLocalCache } from '../../chat/cachedPort';
import { getSealedLocal } from '../../chat/sealedLocal';
import { configureTrustPort } from '../../security/trustPort';
import { createFirestoreTrustPort } from './trustPort';
import type { SigningKey } from '../../chat/chatSignature';
import { createSealedNotesPort } from '../../notes/sealedPort';
import { configureProgramData } from '../../program/config';
import { configureNotes } from '../../notes/useNotes';
import { initCoachTimeZone } from '../../format';
import { configureCalendarSettings } from '../../schedule/calendarSettings';
import { createSealedCalendarSettingsPort } from './calendarSettingsPort';
import { configureLive } from '../../screens/live/config';
import { createSealedSchedulePort } from '../../schedule/sealedPort';
import type { ScheduleData, SchedulePort } from '../../schedule/port';
import { scheduleFeedOf } from '../../schedule/feed';
import { configureSchedule, scheduleStoreFor } from '../../schedule/useSchedule';
import { configureShare } from '../../share/config';
import type { LibGym } from '../../share/types';
import { configureCoachData } from '../config';
import { configureInvitePort, createLocalInvitePort } from '../inviteStore';
import { configureReadLog } from '../readLog';
import { createFirestoreChatPort } from './chatPort';
import { createFirestoreClientChatPort } from './clientChatPort';
import { createFirestoreClientPort } from './clientPort';
import type { FsApi } from './fsApi';
import { createFirestoreInvitePort } from './invitePort';
import { createRingProvider } from './keyRing';
import { createFirestoreLivePort } from './livePort';
import { LIVE_BEAT_MS, createLiveWriter } from './liveWriter';
import { createFirestoreNotesStore } from './notesDocStore';
import { createFirestoreProgramPort } from './programPort';
import { summarizeChanges } from '../../program/summary';
import { PG_LOCALES } from '../../../i18n/coachProgram';
import { getLocale } from '../../../i18n';
import { createFirestoreReadLog } from './readLogPort';
import { createRingBook } from './ringBook';
import { createFirestoreScheduleStore } from './scheduleDocStore';
import { createFirestoreShareSource } from './shareSource';
import { createSharesPublisher } from './sharesPublisher';
import type { ExtrasCatalog } from './shareExtras';
import { createServerSigningLoader, createSignerDirectory } from './trust';
import { createFirestoreWorldPort } from './worldPort';
import { worldCacheOver } from './worldCache';
import { clientCacheOver } from './clientCache';
import { scheduleCacheOver } from './scheduleCache';

type Signer = () => Promise<Pick<SigningKey, 'kid' | 'privateKey'> | null>;

export interface InstallDeps {
  fs: FsApi;
  vault: Vault;
  trainer: { id: string; name: string };
  loadOwnCoachKey: () => Promise<CoachKeyRecord | null>;
  signer?: Signer;
  /** the app's gyms as library entries (share cards) */
  gyms?: () => readonly LibGym[];
  /** wipe the sealed local cache of one conversation (relationship ended); default: the app-wide sealed store */
  wipeCid?: (cid: string) => Promise<void> | void;
  /** the app's exercise / activity catalogues for the share cards (`shareCatalog.ts`) */
  catalog?: ExtrasCatalog;
}

/**
 * A relationship ended: the sealed entries of that conversation go, then the read caches, and Firestore's offline cache
 * (it holds the other side's documents) is scheduled to be dropped at the next start once nothing is left unsynced.
 */
export const defaultWipe = async (cid: string) => {
  try {
    const local = await getSealedLocal();
    await local.wipeCid(cid);
    // the snapshots hold the other side's data (a client's numbers, a trainer's name): they go with the relationship
    for (const k of [
      ...(await local.keys('world:')),
      ...(await local.keys('client:')),
      ...(await local.keys('schedule:')),
    ])
      await local.remove(k);
    // the offline Gym snapshots (rosters, profiles, history) may hold the other side's data as well
    const { wipeOfflineEntries } = await import('../../../offline/offlineCache');
    await wipeOfflineEntries();
  } catch {
    /* nothing cached */
  }
  try {
    const m = await import('../../../deviceWipe');
    await m.wipeAfterRelationshipEnd(await m.liveEnv());
  } catch {
    /* best effort */
  }
};

/** The schedule as the port holds it after its on-device snapshot had up to `ms` to load (the read waits for the vault key). Never rejects. */
async function snapshotWithin(port: SchedulePort, ms = 1500): Promise<ScheduleData | null> {
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      port.hydrate?.(),
      new Promise<void>((res) => {
        t = setTimeout(res, ms);
      }),
    ]);
  } catch {
    /* no snapshot */
  } finally {
    clearTimeout(t);
  }
  return port.peek();
}

/** First schedule snapshot (or the last good one), but never longer than `ms`: the world loads without it otherwise. */
function firstSchedule(port: SchedulePort, ms = 4000): Promise<ScheduleData | null> {
  const cached = port.peek();
  if (cached) return Promise.resolve(cached);
  return new Promise((res) => {
    let off: (() => void) | null = null;
    const done = (v: ScheduleData | null) => {
      clearTimeout(t);
      queueMicrotask(() => off?.());
      res(v);
    };
    const t = setTimeout(() => done(null), ms);
    off = port.subscribe(
      (data) => done(data),
      () => done(null),
    );
  });
}

/** Trainer side. Returns the teardown (forget keys on sign-out). */
export function installFirestoreCoach(d: InstallDeps): () => void {
  const wipe = d.wipeCid ?? defaultWipe;
  const signing = createServerSigningLoader(d.fs);
  const rings = createRingProvider({
    fs: d.fs,
    vault: d.vault,
    uid: d.trainer.id,
    side: 'trainer',
    loadOwnCoachKey: d.loadOwnCoachKey,
    signing,
  });
  const ended = (cid: string) => {
    rings.forget();
    void Promise.resolve(wipe(cid)).catch(() => undefined);
  };
  const book = createRingBook({
    fs: d.fs,
    rings,
    uid: d.trainer.id,
    side: 'trainer',
    onEnded: (cid) => ended(cid),
  });
  const stopBook = book.start();

  // the trainer's zone (stored setting, else this browser): sessions are wall-clock times in it, and every schedule
  // document records it so the members read the same wall-clock times
  initCoachTimeZone();
  const schedule = createSealedSchedulePort({
    store: createFirestoreScheduleStore({ fs: d.fs, book }),
    vault: d.vault,
    ringFor: book.ringFor,
    ringForEpoch: book.ringForEpoch,
    uid: d.trainer.id,
    now: () => d.fs.now(),
    cache: scheduleCacheOver(getSealedLocal(), d.trainer.id),
  });
  const notes = createSealedNotesPort({
    store: createFirestoreNotesStore({ fs: d.fs, book, uid: d.trainer.id }),
    vault: d.vault,
    ringFor: book.ringFor,
    ringForEpoch: book.ringForEpoch,
    uid: d.trainer.id,
    now: () => d.fs.now(),
  });
  const chat = withLocalCache(
    createFirestoreChatPort({
      fs: d.fs,
      vault: d.vault,
      uid: d.trainer.id,
      side: 'trainer',
      rings,
      signer: d.signer,
      directory: createSignerDirectory(d.fs, signing),
      onEnded: ended,
    }),
    getSealedLocal(),
  );

  const world = createFirestoreWorldPort({
    fs: d.fs,
    vault: d.vault,
    trainer: d.trainer,
    loadOwnCoachKey: d.loadOwnCoachKey,
    cache: worldCacheOver(getSealedLocal(), d.trainer.id),
    schedule: async () => {
      // an on-device snapshot answers at once (the live schedule replaces it through the feed); only without one the world
      // waits for the key rings, and then at most `firstSchedule`'s limit
      const snap = await snapshotWithin(schedule);
      if (snap) return snap;
      await book.ready();
      return firstSchedule(schedule);
    },
  });
  // the schedule store is the single source of sessions: an accepted reschedule moves Today / Roster / Week at once
  configureCoachData({
    uid: d.trainer.id,
    world,
    chat,
    scheduleFeed: scheduleFeedOf(scheduleStoreFor(schedule)),
  });
  configureProgramData({
    port: createFirestoreProgramPort({
      fs: d.fs,
      vault: d.vault,
      trainer: d.trainer,
      book,
      roster: () => world.peek()?.data.clients ?? [],
      summarize: (changes) => summarizeChanges(changes, PG_LOCALES[getLocale()]),
      announce: (clientId, card) =>
        chat.send(`cid-${clientId}`, {
          id: card.id,
          text: '',
          at: d.fs.now(),
          body: {
            kind: 'system',
            type: 'program-updated',
            text: card.summary ? `v${card.version} · ${card.summary}` : `v${card.version}`,
          },
        }),
    }),
  });
  configureSchedule(schedule);
  configureNotes(notes);
  configureLive(
    createFirestoreLivePort({
      fs: d.fs,
      vault: d.vault,
      ringForEpoch: book.ringForEpoch,
      onRings: book.watch,
    }),
  );
  configureInvitePort(createFirestoreInvitePort(d.fs));
  configureShare({
    source: createFirestoreShareSource({
      fs: d.fs,
      vault: d.vault,
      side: 'trainer',
      uid: d.trainer.id,
      loadOwnCoachKey: d.loadOwnCoachKey,
      gyms: d.gyms,
      catalog: d.catalog,
      plan: { ringFor: book.ringFor, ringForEpoch: book.ringForEpoch, ready: book.ready },
    }),
  });
  configureReadLog(createFirestoreReadLog(d.fs));
  configureTrustPort(createFirestoreTrustPort(d.fs, signing));
  // working hours, the gyms the trainer works at, the visible range: sealed with the trainer's own key
  configureCalendarSettings(
    createSealedCalendarSettingsPort({ fs: d.fs, vault: d.vault, uid: d.trainer.id }),
  );

  return () => {
    configureCalendarSettings(null);
    configureTrustPort(null);
    stopBook();
    rings.forget();
    configureCoachData();
    configureProgramData();
    configureSchedule(null);
    configureNotes(null);
    configureLive(null);
    configureInvitePort(createLocalInvitePort());
    configureShare();
    configureReadLog(null);
  };
}

export interface ClientInstallDeps {
  fs: FsApi;
  vault: Vault;
  uid: string;
  name: () => string;
  signer?: Signer;
  /** runs the key exchange for a new / removed trainer (vaultIO.runKeyExchange) */
  afterLink?: (trainerId: string | null) => Promise<void> | void;
  gyms?: () => readonly LibGym[];
  /** the member's finished workouts (share cards, effects view) and a change feed */
  workouts: () => readonly Workout[];
  /** The Live writer also needs the OPEN workout (with at least one exercise); absent = `workouts`. */
  liveWorkouts?: () => readonly Workout[];
  onWorkouts: (f: () => void) => () => void;
  /** the member's logged activities (share cards, the totals `full` view); absent = none */
  activities?: () => readonly Activity[];
  wipeCid?: (cid: string) => Promise<void> | void;
  catalog?: ExtrasCatalog;
}

/** Member side. */
export function installFirestoreClient(d: ClientInstallDeps): () => void {
  const wipe = d.wipeCid ?? defaultWipe;
  const signing = createServerSigningLoader(d.fs);
  const rings = createRingProvider({
    fs: d.fs,
    vault: d.vault,
    uid: d.uid,
    side: 'client',
    signing,
  });
  const ended = (cid: string) => {
    rings.forget();
    void Promise.resolve(wipe(cid)).catch(() => undefined);
  };
  const book = createRingBook({
    fs: d.fs,
    rings,
    uid: d.uid,
    side: 'client',
    onEnded: (cid) => ended(cid),
  });
  const stopBook = book.start();

  const chat = withLocalCache(
    createFirestoreChatPort({
      fs: d.fs,
      vault: d.vault,
      uid: d.uid,
      side: 'client',
      rings,
      signer: d.signer,
      directory: createSignerDirectory(d.fs, signing),
      onEnded: ended,
    }),
    getSealedLocal(),
  );
  const port = createFirestoreClientPort({
    fs: d.fs,
    vault: d.vault,
    uid: d.uid,
    cache: clientCacheOver(getSealedLocal(), d.uid),
    afterLink: async (tid) => {
      await d.afterLink?.(tid);
      await book.refresh();
    },
    onLeft: (cid) => {
      if (cid) ended(cid);
    },
    plan: { ringFor: book.ringFor, ringForEpoch: book.ringForEpoch, ready: book.ready },
  });
  configureClientCoach({
    port,
    chat: createFirestoreClientChatPort({ fs: d.fs, chat, uid: d.uid }),
  });
  configureSchedule(
    createSealedSchedulePort({
      store: createFirestoreScheduleStore({ fs: d.fs, book }),
      vault: d.vault,
      ringFor: book.ringFor,
      ringForEpoch: book.ringForEpoch,
      // a member never writes a schedule document; the trainer's uid is only the author recorded by `saveDoc`
      uid: d.uid,
      now: () => d.fs.now(),
      adoptZone: true,
    }),
  );
  // the trainer's shared notes (read only here: the rules let just the conversation's trainer write them)
  configureNotes(
    createSealedNotesPort({
      store: createFirestoreNotesStore({ fs: d.fs, book, uid: d.uid }),
      vault: d.vault,
      ringFor: book.ringFor,
      ringForEpoch: book.ringForEpoch,
      uid: d.uid,
      now: () => d.fs.now(),
    }),
  );
  configureShare({
    source: createFirestoreShareSource({
      fs: d.fs,
      vault: d.vault,
      side: 'client',
      uid: d.uid,
      gyms: d.gyms,
      own: d.workouts,
      ownActivities: d.activities,
      catalog: d.catalog,
      ownName: d.name,
      plan: { ringFor: book.ringFor, ringForEpoch: book.ringForEpoch, ready: book.ready },
    }),
  });

  // The derived `effects` view of the sets lives only on this device: publish it whenever consent or workouts change.
  const shares = createSharesPublisher({
    fs: d.fs,
    vault: d.vault,
    uid: d.uid,
    catalog: d.catalog,
  });
  let consent = port.peek()?.link.grants ?? null;
  const push = () => {
    if (consent)
      void shares
        .sync({ consent, workouts: d.workouts(), activities: d.activities?.() ?? [] })
        .catch(() => undefined);
  };
  const offPort = port.subscribe(
    (s) => {
      consent = s.link.grants;
      push();
    },
    () => undefined,
  );
  // The Live feed: ONE small sealed doc while a workout is open (plan-backend section 9). Failures are silent: Live
  // is a courtesy to the trainer and must never disturb logging.
  const live = createLiveWriter({
    fs: d.fs,
    vault: d.vault,
    uid: d.uid,
    ring: async () => {
      await book.ready();
      const r = book.ringFor(d.uid);
      if (!r) throw new Error('chat-key-missing');
      return r;
    },
  });
  const syncLive = () => {
    const snap = port.peek();
    const link = snap?.link;
    void live
      .sync({
        active: link?.state === 'active',
        trainerId: link?.trainer?.id ?? null,
        cid: link?.cid ?? null,
        totals: link?.grants.totals ?? 'off',
        workouts: (d.liveWorkouts ?? d.workouts)(),
        athleteName: d.name(),
        gymName: (id) => (id ? (d.gyms?.().find((g) => g.id === id)?.name ?? null) : null),
      })
      .catch(() => undefined);
  };
  const offLivePort = port.subscribe(syncLive, () => undefined);
  const offLiveWorkouts = d.onWorkouts(syncLive);
  const liveTimer = setInterval(() => void live.beat().catch(() => undefined), LIVE_BEAT_MS);
  syncLive();
  const offWorkouts = d.onWorkouts(push);

  configureTrustPort(createFirestoreTrustPort(d.fs, signing));

  return () => {
    configureTrustPort(null);
    offPort();
    offLivePort();
    offLiveWorkouts();
    clearInterval(liveTimer);
    offWorkouts();
    stopBook();
    rings.forget();
    configureClientCoach();
    configureSchedule(null);
    configureNotes(null);
    configureShare();
  };
}
