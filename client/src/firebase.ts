/**
 * Firebase app singletons for Spotter.
 *
 * Identity is bridged from the app's own bcrypt credential store: the `login`/
 * `register`/`claim` Cloud Functions verify the password and return a Firebase
 * *custom token*, which the client exchanges via `signInWithCustomToken`. From
 * then on the Firebase Auth session (persisted in IndexedDB) is the source of
 * truth and Firestore/Storage rules see `request.auth`.
 *
 * Tracker data is read/written directly against Firestore (offline persistence
 * enabled); only privileged/cross-user work goes through callable functions.
 */
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { browserLocalPersistence, initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator, waitForPendingWrites } from 'firebase/firestore';
import { registerFirestoreDrain } from './unsynced';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { STORAGE_BUCKET } from './downloads';

const firebaseConfig = {
  apiKey: 'AIzaSyBd29dSkA_ddsCXbJT6XuI1zUi6FGhUeOE',
  authDomain: 'spotter-64c3b.firebaseapp.com',
  projectId: 'spotter-64c3b',
  storageBucket: STORAGE_BUCKET,
  messagingSenderId: '217152431785',
  appId: '1:217152431785:web:ea63d4c2bfa6251484abb8',
};

export const app = initializeApp(firebaseConfig);

// App Check (reCAPTCHA Enterprise) — guards the Gemini key used by Atlas's
// chat (Firebase AI Logic). Tokens ride along on every Firebase request, but
// only services where App Check is *enforced* in the console reject calls
// without one. No key configured → skipped (chat falls back to the phrase book).
const APP_CHECK_KEY = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_KEY as string | undefined;
// The production site key is not valid on localhost: a dev build would log a reCAPTCHA error on every start (SPO-337).
// Dev runs App Check only with a debug token registered in the Firebase console (VITE_APPCHECK_DEBUG_TOKEN).
const APP_CHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN as string | undefined;
const APP_CHECK_ON = !import.meta.env.DEV || !!APP_CHECK_DEBUG_TOKEN;
if (
  typeof window !== 'undefined' &&
  APP_CHECK_KEY &&
  APP_CHECK_ON &&
  !import.meta.env.VITE_USE_EMULATORS
) {
  if (import.meta.env.DEV && APP_CHECK_DEBUG_TOKEN) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      APP_CHECK_DEBUG_TOKEN;
  }
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(APP_CHECK_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn('app check init failed', err);
  }
}

// Persist the session locally so a reload keeps the user signed in.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});

// Offline-first: cache all reads/writes locally and sync when online. This is
// what replaces the old hand-rolled localStorage mutation queue.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  // Workout/gym objects carry optional fields; let Firestore drop undefined
  // rather than throwing, so we can write the in-memory shape as-is.
  ignoreUndefinedProperties: true,
});

// Cloud Functions region must match functions/src/index.ts (us-central1).
// sign-out waits for the server to confirm local writes before it removes the offline cache (SPO-384)
registerFirestoreDrain(() => waitForPendingWrites(db));
export const functions = getFunctions(app, 'us-central1');

export const storage = getStorage(app);

// Local development against the Firebase emulator suite. Enable by running the
// client with VITE_USE_EMULATORS=1 (see `firebase emulators:start`). Ports match
// firebase.json. No-op in production builds.
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}
