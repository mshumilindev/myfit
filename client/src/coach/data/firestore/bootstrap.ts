/**
 * The one real caller of `installFirestoreCoach` / `installFirestoreClient`. Loaded lazily (dynamic import) only when
 * `VITE_COACH_BACKEND=firestore` and a Coach screen or the client bridge is on; the Gym entry never includes it.
 *
 * Wires, per side:
 *   - the Firestore `FsApi` (`firebaseFs.ts`, the only file importing `firebase/*`),
 *   - the app vault and the coach key record (`vaultIO`),
 *   - the device chat signer (`signerStore.ts`: key in IndexedDB, public half published through the server),
 *   - trainer: the server signature of the coach public key (`coachKeySign`, re-asked whenever the key doc changes),
 *   - client: the key exchange after a link change and the member's workouts for the share cards / effects view.
 * `acquireBackend` is ref-counted by role + user: several screens may ask, the adapters install once.
 */
import type { LibGym } from '../../share/types';
import { configureScheduleGyms } from '../../schedule/types';
import { createFirebaseFs } from './firebaseFs';
import { installFirestoreClient, installFirestoreCoach } from './install';
import { keepCoachKeySigned } from './coachKeySigned';
import { createDeviceSigner } from './signerStore';

interface Running {
  refs: number;
  ready: Promise<() => void>;
}
const running = new Map<string, Running>();

async function ownGyms(): Promise<() => readonly LibGym[]> {
  // The app's own gyms are the only source of a gym's name and city (sharedGyms only holds equipment).
  const { getStoreState } = await import('../../../store');
  return () =>
    (getStoreState().gyms ?? []).map((g): LibGym => ({
      id: g.id,
      name: g.name,
      city: '',
      amenities: [],
      machines: g.equipmentItems?.length ?? 0,
      equipmentIds: g.equipmentItems ?? [],
      shareable: !!g.externalId,
    }));
}

async function startTrainer(who: { id: string; name: string }): Promise<() => void> {
  const fs = createFirebaseFs();
  const { vault, loadOwnCoachKey } = await import('../../../vaultIO');
  const stopSign = keepCoachKeySigned(fs, who.id);
  const { workoutCatalog } = await import('./shareCatalog');
  const gyms = await ownGyms();
  const stop = installFirestoreCoach({
    fs,
    catalog: workoutCatalog,
    vault,
    trainer: who,
    loadOwnCoachKey,
    signer: createDeviceSigner({ fs, uid: who.id }),
    gyms,
  });
  // The schedule offers the trainer's own gyms, never the fixtures'.
  // (with the place of each, so the calendar can look up its opening hours)
  const { getStoreState } = await import('../../../store');
  configureScheduleGyms(() =>
    (getStoreState().gyms ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      short: g.name,
      place:
        Number.isFinite(g.lat) && Number.isFinite(g.lng) ? { lat: g.lat, lng: g.lng } : undefined,
    })),
  );
  return () => {
    configureScheduleGyms(null);
    stopSign();
    stop();
  };
}

async function startClient(who: { id: string; name: string }): Promise<() => void> {
  const fs = createFirebaseFs();
  const [{ vault, runKeyExchange }, store] = await Promise.all([
    import('../../../vaultIO'),
    import('../../../store'),
  ]);
  const { workoutCatalog } = await import('./shareCatalog');
  const stop = installFirestoreClient({
    fs,
    catalog: workoutCatalog,
    vault,
    uid: who.id,
    name: () => who.name,
    signer: createDeviceSigner({ fs, uid: who.id }),
    afterLink: (tid) => runKeyExchange(tid, false),
    gyms: await ownGyms(),
    workouts: () => store.getStoreState().workouts.filter((w) => w.finishedAt != null),
    liveWorkouts: () =>
      store
        .getStoreState()
        .workouts.filter((w) => w.finishedAt != null || (w.exercises ?? []).length > 0),
    onWorkouts: store.subscribeStore,
    activities: () => store.getStoreState().activities ?? [],
  });
  // One live-session writer: the sealed one just installed owns liveSessions/{me}; the legacy presence writer yields.
  store.setLegacyLiveWriter(false);
  return () => {
    store.setLegacyLiveWriter(true);
    stop();
  };
}

/** Installs the real adapters for this role and user (once) and returns the release function. */
export async function acquireBackend(
  role: 'trainer' | 'client',
  who: { id: string | null; name: string },
): Promise<() => void> {
  if (!who.id) return () => undefined; // not signed in: nothing to install, the fixtures never reach a real user
  const key = `${role}|${who.id}`;
  let r = running.get(key);
  if (!r) {
    const start = role === 'trainer' ? startTrainer : startClient;
    r = { refs: 0, ready: start({ id: who.id, name: who.name }) };
    running.set(key, r);
    r.ready.catch(() => running.delete(key));
  }
  r.refs++;
  const entry = r;
  const stop = await entry.ready;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--entry.refs > 0) return;
    running.delete(key);
    stop();
  };
}
