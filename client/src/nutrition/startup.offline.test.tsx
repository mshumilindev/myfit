/**
 * Non-blocking startup of Nutrition (same contract as ../startup.offline.test.tsx): with a session cached on the
 * device and a network where nothing answers (Auth restore and every Firestore listener hang), the app renders its
 * shell from local state at once. No full-screen "Loading..." replaces it, and it is interactive.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const never = <T,>() => new Promise<T>(() => undefined);

vi.mock('../firebase', () => ({
  app: {},
  auth: { currentUser: null },
  db: {},
  functions: {},
  storage: {},
  analytics: null,
}));
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig<typeof import('firebase/firestore')>()),
  doc: () => ({}),
  onSnapshot: () => () => undefined, // the first snapshot never arrives
  setDoc: () => never(),
}));
vi.mock('firebase/auth', () => ({
  signInWithCustomToken: () => never(),
  onAuthStateChanged: () => () => undefined, // session restore never reports
  onIdTokenChanged: () => () => undefined,
  signOut: async () => undefined,
}));
vi.mock('firebase/functions', () => ({ httpsCallable: () => () => never() }));

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  window.location.hash = '#/nutrition';
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
afterEach(cleanup);

async function mountRoot() {
  const { NutritionRoot } = await import('./App');
  return render(
    <NutritionRoot
      now={Date.now()}
      onOpenShell={vi.fn()}
      onOpenProfile={vi.fn()}
      notifs={[]}
      notifState={{}}
      notifUnread={0}
      onNotifSeen={vi.fn()}
      onNotifMarkAll={vi.fn()}
    />,
  );
}

describe('Nutrition startup with a network that never answers', () => {
  it('renders the shell from the cached session and does not block on Auth restore', async () => {
    localStorage.setItem('spotter.uid', 'u1');
    localStorage.setItem('spotter.username', 'Tester');
    await mountRoot();
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
    // interactive: the add pill opens the add flow
    fireEvent.click(screen.getByRole('button', { name: /Add/ }));
    expect(document.querySelector('.scrim, [role="dialog"]')).toBeTruthy();
  });

  it('a device with no session at all still shows only the quiet loading label', async () => {
    await mountRoot();
    expect(screen.getByText('Loading…')).toBeTruthy();
  });
});
