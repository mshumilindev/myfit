/**
 * Non-blocking startup contract: with a cached session and a network where
 * nothing ever answers (fetch, callables, Firestore listeners and Auth restore
 * all hang), the shell renders from the local cache, is interactive, and no
 * blocking overlay / spinner / "Syncing" screen covers the viewport.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const never = <T,>() => new Promise<T>(() => undefined);

vi.mock('./firebase', () => ({
  app: {},
  auth: { currentUser: null },
  db: {},
  functions: {},
  storage: {},
  analytics: null,
}));
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig<typeof import('firebase/firestore')>()),
  collection: () => ({}),
  collectionGroup: () => ({}),
  doc: () => ({}),
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: () => () => undefined, // the first snapshot never arrives
  getDoc: () => never(),
  getDocs: () => never(),
  setDoc: () => never(),
  updateDoc: () => never(),
  deleteDoc: () => never(),
}));
vi.mock('firebase/auth', () => ({
  signInWithCustomToken: () => never(),
  onAuthStateChanged: () => () => undefined, // session restore never reports
  onIdTokenChanged: () => () => undefined,
  signOut: async () => undefined,
}));
vi.mock('firebase/functions', () => ({
  httpsCallable: () => () => never(), // every callable hangs
}));
vi.mock('firebase/storage', () => ({
  ref: () => ({}),
  getBlob: () => never(),
  uploadBytes: () => never(),
  deleteObject: () => never(),
}));

import { App } from './App';
import { SyncStatusHost } from './components/SyncStatusHost';
import { callFn, trackMutation } from './api';
import { currentHash } from './route';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('spotter.uid', 'u1');
  localStorage.setItem('spotter.username', 'Tester');
  localStorage.setItem('spotter.role', 'member');
  // The hung fetch of a dead network.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => never()),
  );
  window.location.hash = '#/today';
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Nothing that blocks the screen: no scrim, no busy/modal dialog, no auth form. */
function expectNoBlockingOverlay() {
  expect(document.querySelector('.server-busy-scrim')).toBeNull();
  expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  expect(document.querySelector('[aria-modal="true"]')).toBeNull();
  expect(document.querySelector('input[type="password"]')).toBeNull();
}

describe('startup with a network that never answers', () => {
  it('renders the shell from the local cache and stays interactive', async () => {
    render(<App />);
    // The tab bar (primary navigation) is there without waiting for any request.
    const nav = await screen.findByRole('navigation', {}, { timeout: 8000 });
    expect(nav).toBeTruthy();
    expectNoBlockingOverlay();

    // Interactive: a tab press navigates (no overlay swallows the tap).
    const buttons = nav.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(1);
    await act(async () => {
      fireEvent.click(buttons[1]);
    });
    await waitFor(() => expect(currentHash()).not.toBe('#/today'));
    expectNoBlockingOverlay();
  }, 20000);

  it('a hanging mutation shows a small status chip, not a scrim', async () => {
    vi.useFakeTimers();
    try {
      render(<SyncStatusHost />);
      const pending = callFn('updateProfile', {}).catch(() => undefined);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      const chip = document.querySelector('[data-sync-state="saving"]');
      expect(chip).not.toBeNull();
      expect(chip?.getAttribute('aria-live')).toBe('polite');
      expectNoBlockingOverlay();
      void pending;
    } finally {
      vi.useRealTimers();
    }
  });

  it('a tracked write that never settles drops its chip after the cap', async () => {
    vi.useFakeTimers();
    try {
      render(<SyncStatusHost />);
      void trackMutation(never<void>());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(document.querySelector('[data-sync-state="saving"]')).not.toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(16_000);
      });
      expect(document.querySelector('[data-sync-state="saving"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
