import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { setLocale } from '../client/src/i18n';

process.env.GYM_DATA_DIR ??= fs.mkdtempSync(path.join(os.tmpdir(), 'gym-vitest-'));
process.env.GYM_JWT_SECRET ??= 'test-secret';
process.env.PORT ??= '0';

// --- Firebase stubs ---------------------------------------------------------
// Client modules import the Firebase SDK (and ./firebase, which boots the app);
// none of that should run under jsdom. Stub the app singletons and the SDK
// entry points so the store's local-state logic is exercised while every
// Firestore/Storage/Auth call is an inert no-op. Signed-out (currentUser null)
// means store writes short-circuit and only touch in-memory state — exactly
// what these unit tests assert.
vi.mock('../client/src/firebase', () => ({
  app: {},
  auth: { currentUser: null },
  db: {},
  functions: {},
  storage: {},
  analytics: null,
}));
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: () => ({}),
  setDoc: async () => undefined,
  deleteDoc: async () => undefined,
  updateDoc: async () => undefined,
  getDocs: async () => ({ docs: [] }),
  query: () => ({}),
  where: () => ({}),
  onSnapshot: () => () => undefined,
}));
vi.mock('firebase/storage', () => ({
  ref: () => ({}),
  getBlob: async () => {
    throw new Error('no avatar in tests');
  },
  uploadBytes: async () => undefined,
  deleteObject: async () => undefined,
}));
vi.mock('firebase/auth', () => ({
  signInWithCustomToken: async () => undefined,
  onAuthStateChanged: () => () => undefined,
  onIdTokenChanged: () => () => undefined,
  signOut: async () => undefined,
}));
vi.mock('firebase/functions', () => ({
  httpsCallable: () => async () => ({ data: {} }),
}));

beforeEach(() => {
  localStorage.clear();
  setLocale('en');
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: true,
  });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
