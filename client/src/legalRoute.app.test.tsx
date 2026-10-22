/**
 * /privacy and /terms open the public reader before any auth gate (SPO-295 N2): signed out, signed in, and via the
 * clean URL. Same dead-network harness as startup.offline.test.tsx.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
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
  onSnapshot: () => () => undefined,
  getDoc: () => never(),
  getDocs: () => never(),
  setDoc: () => never(),
  updateDoc: () => never(),
  deleteDoc: () => never(),
}));
vi.mock('firebase/auth', () => ({
  signInWithCustomToken: () => never(),
  onAuthStateChanged: () => () => undefined,
  onIdTokenChanged: () => () => undefined,
  signOut: async () => undefined,
}));
vi.mock('firebase/functions', () => ({ httpsCallable: () => () => never() }));
vi.mock('firebase/storage', () => ({
  ref: () => ({}),
  getBlob: () => never(),
  uploadBytes: () => never(),
  deleteObject: () => never(),
}));

import { App } from './App';
import { setHash } from './route';
import { setLocale } from './i18n';

beforeEach(() => {
  localStorage.clear();
  setLocale('en');
  vi.stubGlobal(
    'fetch',
    vi.fn(() => never()),
  );
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
  window.history.replaceState(null, '', '/');
});

describe('public legal routes', () => {
  it('signed out: /privacy shows the policy, no sign-in form', async () => {
    window.history.replaceState(null, '', '/privacy');
    render(<App />);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(
      'Spotter Privacy Policy',
    );
    expect(document.querySelector('form.auth-body')).toBeNull();
  });

  it('signed out: /terms shows the terms', async () => {
    window.history.replaceState(null, '', '/terms');
    render(<App />);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(
      'Spotter Terms of Use',
    );
  });

  it('signed in: the page is still public and the URL stays /privacy', async () => {
    localStorage.setItem('spotter.uid', 'u1');
    localStorage.setItem('spotter.username', 'Tester');
    localStorage.setItem('spotter.role', 'member');
    window.history.replaceState(null, '', '/privacy');
    render(<App />);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(
      'Spotter Privacy Policy',
    );
    expect(window.location.pathname).toBe('/privacy');
  });

  it('navigating to /terms from the sign-in screen swaps the screen without a reload; leaving returns', async () => {
    window.history.replaceState(null, '', '/');
    render(<App />);
    await waitFor(() => expect(document.querySelector('form.auth-body')).not.toBeNull());
    act(() => setHash('#/terms'));
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(
      'Spotter Terms of Use',
    );
    act(() => setHash('#/'));
    await waitFor(() => expect(document.querySelector('form.auth-body')).not.toBeNull());
  });
});

describe('legal page Back inside the app', () => {
  it('from the sign-in screen: Back returns with history.back() semantics (popstate) and a direct link goes to the root', async () => {
    window.history.replaceState(null, '', '/');
    render(<App />);
    await waitFor(() => expect(document.querySelector('form.auth-body')).not.toBeNull());
    act(() => setHash('#/privacy'));
    await screen.findByRole('heading', { level: 1 });
    const back = vi.spyOn(window.history, 'back');
    act(() => screen.getByRole('button', { name: 'Back' }).click());
    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });

  it('opened directly (no in-app history): Back goes to the sign-in screen', async () => {
    window.history.replaceState(null, '', '/privacy');
    render(<App />);
    await screen.findByRole('heading', { level: 1 });
    act(() => screen.getByRole('button', { name: 'Back' }).click());
    await waitFor(() => expect(document.querySelector('form.auth-body')).not.toBeNull());
    expect(window.location.pathname).toBe('/');
  });

  it('an invite link followed while signed in opens the sign-up screen, not the app behind the gate exemption', async () => {
    localStorage.setItem('spotter.uid', 'u1');
    localStorage.setItem('spotter.username', 'Tester');
    localStorage.setItem('spotter.role', 'member');
    window.history.replaceState(null, '', '/');
    render(<App />);
    act(() => setHash('#/join/abc-123'));
    // the invite sign-up owns the screen (the same as on a cold load); before the fix the app stayed up and the gate stood down
    await waitFor(() => expect(document.querySelector('.app-landing')).not.toBeNull());
  });
});
