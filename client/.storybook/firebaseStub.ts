/**
 * Storybook-only stand-in for src/firebase.ts (wired in main.ts). Same named
 * exports, but a demo project with in-memory auth and no analytics, so stories
 * never read or write the real Spotter backend.
 */
import { initializeApp } from 'firebase/app';
import { inMemoryPersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import type { Analytics } from 'firebase/analytics';

export const app = initializeApp(
  { apiKey: 'demo', projectId: 'demo-spotter-storybook', appId: 'demo' },
  'storybook',
);
export const auth = initializeAuth(app, { persistence: inMemoryPersistence });
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');
export const storage = getStorage(app, 'gs://demo-spotter-storybook');
export const analytics: Analytics | null = null;
