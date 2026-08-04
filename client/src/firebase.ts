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
import { getAnalytics, isSupported as analyticsIsSupported } from 'firebase/analytics';
import { browserLocalPersistence, initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import type { Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyBd29dSkA_ddsCXbJT6XuI1zUi6FGhUeOE',
  authDomain: 'spotter-64c3b.firebaseapp.com',
  projectId: 'spotter-64c3b',
  storageBucket: 'spotter-64c3b.firebasestorage.app',
  messagingSenderId: '217152431785',
  appId: '1:217152431785:web:ea63d4c2bfa6251484abb8',
  measurementId: 'G-4RZ03T456T',
};

export const app = initializeApp(firebaseConfig);

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

// Analytics only in a supporting browser context (no-op in tests / SSR).
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  analyticsIsSupported()
    .then((ok) => {
      if (ok) analytics = getAnalytics(app);
    })
    .catch(() => {
      /* analytics unavailable — non-fatal */
    });
}
