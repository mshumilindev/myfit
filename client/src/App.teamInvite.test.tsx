/**
 * Team invite link (`#/team-invite/<token>`, SPO-196): a person who already has an account (cached session) lands
 * straight on "Join the team" with no onboarding in between; a person with no session sees the sign-in screen and the
 * link stays in the address bar, so the token is not lost on the way in.
 */
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
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
  signInWithCustomToken: async () => undefined,
  onAuthStateChanged: () => () => undefined, // session restore never reports
  onIdTokenChanged: () => () => undefined,
  signOut: async () => undefined,
}));
vi.mock('firebase/functions', () => ({
  // every callable hangs, except the sign-in, which succeeds
  httpsCallable: (_f: unknown, name: string) =>
    name === 'login'
      ? async () => ({
          data: { token: 't', userId: 'u9', username: 'ann', name: 'Ann', role: 'member' },
        })
      : () => never(),
}));
vi.mock('firebase/storage', () => ({
  ref: () => ({}),
  getBlob: () => never(),
  uploadBytes: () => never(),
  deleteObject: () => never(),
}));

import { App } from './App';
import { currentHash } from './route';

function stubMedia() {
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
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => never()),
  );
  stubMedia();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('team invite link', () => {
  it('a signed-in person goes straight to Join the team, no onboarding', async () => {
    localStorage.setItem('spotter.uid', 'u1');
    localStorage.setItem('spotter.username', 'Tester');
    localStorage.setItem('spotter.role', 'member');
    window.location.hash = '#/team-invite/tok1';
    render(<App />);
    // the join page's own loading state (the preview callable never answers here)
    await waitFor(() => expect(document.querySelector('.onb-shell')).not.toBeNull(), {
      timeout: 8000,
    });
    expect(currentHash()).toBe('#/team-invite/tok1');
    expect(document.querySelector('input[type="password"]')).toBeNull();
  }, 20000);

  it('a person with no session sees sign-in and the link stays in the address bar', async () => {
    window.location.hash = '#/team-invite/tok1';
    render(<App />);
    await waitFor(() => expect(document.querySelector('input[type="password"]')).not.toBeNull(), {
      timeout: 8000,
    });
    expect(currentHash()).toBe('#/team-invite/tok1');
  }, 20000);

  it('after signing in, the person lands on Join the team, still with no onboarding', async () => {
    window.location.hash = '#/team-invite/tok1';
    render(<App />);
    const pass = await waitFor(
      () => {
        const el = document.querySelector('input[type="password"]');
        expect(el).not.toBeNull();
        return el as HTMLInputElement;
      },
      { timeout: 8000 },
    );
    const form = pass.closest('form') as HTMLFormElement;
    const who = form.querySelector('input:not([type="password"]):not([type="checkbox"])');
    await act(async () => {
      fireEvent.change(who as HTMLInputElement, { target: { value: 'ann' } });
      fireEvent.change(pass, { target: { value: 'secret-pass-1' } });
      fireEvent.submit(form);
    });
    await waitFor(() => expect(document.querySelector('input[type="password"]')).toBeNull(), {
      timeout: 8000,
    });
    expect(currentHash()).toBe('#/team-invite/tok1');
    expect(document.querySelector('.onb-shell')).not.toBeNull();
  }, 20000);
});
