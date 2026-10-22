import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  uid: 'u1' as string | null,
  role: 'member' as string,
  roleListeners: new Set<() => void>(),
  state: { records: [], loading: false, confirmed: true, error: null } as {
    records: unknown[];
    loading: boolean;
    confirmed: boolean;
    error: Error | null;
  },
  grant: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('../api', () => ({
  currentUid: () => h.uid,
  getRole: () => h.role,
  onRoleChange: (cb: () => void) => {
    h.roleListeners.add(cb);
    return () => void h.roleListeners.delete(cb);
  },
  onAuthChange: () => () => undefined,
  isSigningIn: () => false,
  onSigningInChange: () => () => undefined,
  signOut: h.signOut,
}));
vi.mock('./consentApi', async () => {
  const real = await vi.importActual<typeof import('./consentApi')>('./consentApi');
  return {
    ...real,
    useConsentRecords: () => ({ ...h.state, retry: vi.fn() }),
    grantConsent: h.grant,
  };
});

import { resetGeoGateForTests } from '../data/geoSearchGate';
import { resetAiOverride } from '../atlas/aiConsent';
import { LegalGate } from './LegalGate';
import { LEGAL_VERSIONS, currentVersion, type ConsentRecord } from './consents';
import { CHOICES_SHOWN_KEY, ATLAS_AI_CATEGORIES } from './gateChoices';
import { loadGateDraft } from './gateDraft';
import { CONSENT_QUEUE_KEY } from './signupConsents';
import { markVerifiedClear, wasVerifiedClear } from './gateVerified';
import { sha256Hex } from './textHash';
import { trainerTermsHashInput } from './trainerTerms';

const TITLE = 'We updated how Spotter works with your data';
const CHOICES = 'Choose what Spotter may do';
const TT_TITLE = 'Trainer Terms and data processing';
const TT_V = LEGAL_VERSIONS['trainer-terms'];

function rec(kind: ConsentRecord['kind']): ConsentRecord {
  return { id: kind, kind, action: 'grant', version: LEGAL_VERSIONS.terms, at: 1 };
}
const REQUIRED = [rec('terms'), rec('policy-ack'), rec('age-18')];
const ttRec = (over: Partial<ConsentRecord> = {}): ConsentRecord => ({
  id: 'tt',
  kind: 'trainer-terms',
  action: 'grant',
  version: TT_V,
  at: 2,
  ...over,
});
const server = (records: ConsentRecord[]) => ({
  records,
  loading: false,
  confirmed: true,
  error: null,
});

beforeEach(() => {
  resetGeoGateForTests();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  window.location.hash = '#/today';
  h.uid = 'u1';
  h.role = 'member';
  h.roleListeners.clear();
  h.state = server([]);
  h.grant.mockReset();
  h.grant.mockResolvedValue({ id: 'x', at: 1 });
  h.signOut.mockReset();
  vi.spyOn(window, 'open').mockReturnValue({ opener: 1 } as unknown as Window);
});
afterEach(() => {
  cleanup();
  resetAiOverride();
  vi.restoreAllMocks();
});

// The opaque loading page for an unverifiable agreement: checking, offline or service problem (each has its own title).
const unverified = () =>
  screen.queryByRole('dialog', {
    name: /Connect to continue|Checking your agreement|couldn't check your agreement/,
  });
const page = (name: string) => screen.queryByRole('dialog', { name });
const cont = () =>
  screen.getByRole('button', { name: /^(Continue|Saving your agreement…)/ }) as HTMLButtonElement;
const AGE = { name: 'I am 18 or older.' };
const AGREE = { name: 'I agree to the Terms of Use and acknowledge the Privacy Policy.' };
const AGREE_ALL = {
  name: 'I agree to the Terms of Use, the Trainer Terms and the DPA, and acknowledge the Privacy Policy.',
};
const AGREE_TT = { name: 'I have read and accept the Trainer Terms and the DPA.' };
const doc = (re: RegExp) => screen.getByRole('button', { name: re });
const done = () => document.querySelectorAll('.uichk-i.is-done').length;
/** In jsdom a document has no height, so opening it counts as reading it to the end. */
const readBase = () => {
  fireEvent.click(doc(/^Terms of Use/));
  fireEvent.click(doc(/^Privacy Policy/));
};
const readTrainer = () => {
  fireEvent.click(doc(/^Trainer Terms/));
  fireEvent.click(doc(/^Data Processing Agreement/));
};
function acceptAll() {
  readBase();
  fireEvent.click(screen.getByRole('switch', AGE));
  fireEvent.click(screen.getByRole('switch', AGREE));
}
const toStep2 = async () => {
  render(<LegalGate />);
  acceptAll();
  fireEvent.click(cont());
  await waitFor(() => expect(page(CHOICES)).toBeTruthy());
  await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(3));
  h.grant.mockClear();
};

describe('when the gate shows', () => {
  it('shows the one-page gate only when the server confirmed a required consent is missing', () => {
    render(<LegalGate />);
    expect(page(TITLE)).toBeTruthy();
    expect(document.querySelector('.sheet')).toBeNull(); // a page, not a drawer
    expect(screen.getByText('Step 1 of 2 · Terms')).toBeTruthy();
  });

  it.each([
    ['loading', { records: [], loading: true, confirmed: false, error: null }],
    ['error', { records: [], loading: false, confirmed: false, error: new Error('x') }],
    [
      'offline without server confirmation',
      { records: [], loading: false, confirmed: false, error: null },
    ],
    ['all required consents current', server(REQUIRED)],
  ])('shows nothing on %s once this device saw the consents confirmed (no loader)', (_n, state) => {
    h.state = state;
    markVerifiedClear('u1');
    render(<LegalGate />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    ['loading', { records: [], loading: true, confirmed: false, error: null }],
    ['error', { records: [], loading: false, confirmed: false, error: new Error('x') }],
    [
      'offline without server confirmation',
      { records: [], loading: false, confirmed: false, error: null },
    ],
  ])(
    'shows an opaque loading page on %s when nothing was ever confirmed on this device',
    (_n, state) => {
      h.state = state;
      render(<LegalGate />);
      expect(unverified()).toBeTruthy();
      expect(document.querySelector('.uifp')).toBeTruthy();
      expect(page(TITLE)).toBeNull();
      // loading shows the ladder; an error or being offline shows the way out
      expect(
        document.querySelector('.uils-spin') ?? screen.queryByRole('button', { name: 'Sign out' }),
      ).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    },
  );

  it('the loading page turns into the gate page when the server answers, and says "checking" while online', () => {
    h.state = { records: [], loading: true, confirmed: false, error: null };
    const { rerender } = render(<LegalGate />);
    expect(screen.getByRole('status').textContent).toMatch(/Checking/);
    h.state = server([]);
    rerender(<LegalGate />);
    expect(unverified()).toBeNull();
    expect(page(TITLE)).toBeTruthy();
  });

  it('a stale cached "clear" (older document versions) does not count', () => {
    localStorage.setItem('spotter.consentVerified', JSON.stringify({ u1: 'terms@2000-01-01' }));
    h.state = { records: [], loading: false, confirmed: false, error: null };
    render(<LegalGate />);
    expect(unverified()).toBeTruthy();
  });

  it('remembers a server-confirmed clear, forgets it when the server says a consent is missing', () => {
    h.state = server(REQUIRED);
    const { unmount } = render(<LegalGate />);
    expect(wasVerifiedClear('u1')).toBe(true);
    expect(wasVerifiedClear('u2')).toBe(false);
    unmount();
    h.state = server([]);
    render(<LegalGate />);
    expect(wasVerifiedClear('u1')).toBe(false);
  });

  it('the cached clear is per account: account B on the same device is still unverified', () => {
    markVerifiedClear('u1');
    h.uid = 'u2';
    h.state = { records: [], loading: false, confirmed: false, error: null };
    render(<LegalGate />);
    expect(unverified()).toBeTruthy();
  });

  it('does not show when signed out, on a public legal page, on an invite link, or when registration just queued the consents', () => {
    h.state = { records: [], loading: false, confirmed: false, error: null };
    h.uid = null;
    const { unmount } = render(<LegalGate />);
    expect(screen.queryByRole('dialog')).toBeNull();
    unmount();
    h.uid = 'u1';
    window.location.hash = '#/privacy';
    const b = render(<LegalGate />);
    expect(screen.queryByRole('dialog')).toBeNull();
    b.unmount();
    window.location.hash = '#/join/abc';
    const c = render(<LegalGate />);
    expect(screen.queryByRole('dialog')).toBeNull();
    c.unmount();
    window.location.hash = '#/today';
    localStorage.setItem(
      CONSENT_QUEUE_KEY,
      JSON.stringify([
        {
          uid: 'u1',
          items: (['terms', 'policy-ack', 'age-18'] as const).map((kind) => ({
            kind,
            version: currentVersion(kind),
          })),
        },
      ]),
    );
    render(<LegalGate />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows when the queued required grants are of an older version (the server can never accept them)', () => {
    localStorage.setItem(
      CONSENT_QUEUE_KEY,
      JSON.stringify([
        {
          uid: 'u1',
          items: (['terms', 'policy-ack', 'age-18'] as const).map((kind) => ({
            kind,
            version: '2020-01-01',
          })),
        },
      ]),
    );
    render(<LegalGate />);
    expect(page(TITLE)).toBeTruthy();
  });
});

describe('step 1: the documents are read on the page', () => {
  it('is a page nobody can dismiss: no close button, Escape does nothing', () => {
    render(<LegalGate />);
    expect(document.querySelector('.sheet-close')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(page(TITLE)).toBeTruthy();
    expect(h.grant).not.toHaveBeenCalled();
  });

  it('lists every item in the checklist and turns each green as it is done; nothing disappears', () => {
    render(<LegalGate />);
    const items = () => Array.from(document.querySelectorAll('.uichk-i'));
    expect(items().map((i) => i.textContent?.trim())).toEqual([
      'Read: Terms of Use',
      'Read: Privacy Policy',
      'Confirm you are 18 or older',
      'Tick the agreement',
    ]);
    expect(done()).toBe(0);
    fireEvent.click(doc(/^Terms of Use/));
    expect(items()).toHaveLength(4);
    expect(done()).toBe(1);
    expect(screen.getByText('Still to do on this page')).toBeTruthy();
    fireEvent.click(doc(/^Privacy Policy/));
    fireEvent.click(screen.getByRole('switch', AGE));
    fireEvent.click(screen.getByRole('switch', AGREE));
    expect(done()).toBe(4);
    expect(screen.getByText('Ready to continue')).toBeTruthy();
  });

  it('a document counts as read only once scrolled to its end', () => {
    const own = (k: 'scrollHeight' | 'clientHeight', v: number) =>
      Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => v });
    own('scrollHeight', 1000);
    own('clientHeight', 300);
    try {
      render(<LegalGate />);
      fireEvent.click(doc(/^Terms of Use/));
      expect(done()).toBe(0);
      const box = screen.getByRole('region', { name: 'Terms of Use' });
      Object.defineProperty(box, 'scrollTop', { configurable: true, value: 200, writable: true });
      fireEvent.scroll(box);
      expect(done()).toBe(0);
      (box as HTMLElement).scrollTop = 700;
      fireEvent.scroll(box);
      expect(done()).toBe(1);
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
      Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
    }
  });

  it('the 18+ and agree switches stay locked until every document is read; Continue needs all of it', () => {
    render(<LegalGate />);
    expect(cont().disabled).toBe(true);
    const age = screen.getByRole('switch', AGE) as HTMLInputElement;
    expect(age.disabled).toBe(true);
    fireEvent.click(doc(/^Terms of Use/));
    expect(age.disabled).toBe(true);
    fireEvent.click(doc(/^Privacy Policy/));
    expect(age.disabled).toBe(false);
    expect(cont().disabled).toBe(true);
    fireEvent.click(age);
    expect(cont().disabled).toBe(true);
    fireEvent.click(screen.getByRole('switch', AGREE));
    expect(cont().disabled).toBe(false);
  });

  it('"Accept all" appears once everything is read and switches both on', () => {
    render(<LegalGate />);
    expect(screen.queryByRole('button', { name: 'Accept all' })).toBeNull();
    readBase();
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }));
    expect((screen.getByRole('switch', AGE) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('switch', AGREE) as HTMLInputElement).checked).toBe(true);
    expect(cont().disabled).toBe(false);
  });

  it('shows no "Before you continue" heading and no locked hint', () => {
    render(<LegalGate />);
    expect(screen.queryByText('Before you continue')).toBeNull();
    expect(screen.queryByText(/to unlock the boxes below/)).toBeNull();
  });

  it('sign out and delete are small danger buttons with icons', () => {
    render(<LegalGate />);
    for (const name of ['Sign out', 'Delete my account']) {
      const b = screen.getByRole('button', { name });
      expect(b.className).toContain('uibtn--danger');
      expect(b.querySelector('svg')).toBeTruthy();
    }
  });
});

describe('Continue waits until the server has the agreement', () => {
  it('records terms, policy-ack, age-18 with versions and hashes, in that order', async () => {
    render(<LegalGate />);
    acceptAll();
    fireEvent.click(cont());
    await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(3));
    const calls = h.grant.mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.kind)).toEqual(['terms', 'policy-ack', 'age-18']);
    expect(calls[0]).toMatchObject({ version: LEGAL_VERSIONS.terms });
    expect(calls[0].textHash).toMatch(/^[0-9a-f]{64}$/);
    expect(calls[1]).toMatchObject({ version: LEGAL_VERSIONS.policy });
    expect(calls[2]).toMatchObject({ version: LEGAL_VERSIONS.age });
    expect(calls[2].textHash).toBeUndefined();
  });

  it('stays on step 1 with "Saving your agreement…" while the network is slow, then moves on', async () => {
    let release: (v: unknown) => void = () => undefined;
    h.grant.mockReturnValue(new Promise((r) => (release = r)));
    render(<LegalGate />);
    acceptAll();
    fireEvent.click(cont());
    await waitFor(() => expect(h.grant).toHaveBeenCalled());
    expect(page(TITLE)).toBeTruthy();
    expect(page(CHOICES)).toBeNull();
    expect(cont().textContent).toBe('Saving your agreement…');
    expect(cont().disabled).toBe(true);
    // queued locally first: nothing is lost
    expect(JSON.parse(localStorage.getItem(CONSENT_QUEUE_KEY) ?? '[]')[0].items).toHaveLength(3);
    h.grant.mockResolvedValue({ id: 'x', at: 1 });
    await act(async () => release({ id: 'x', at: 1 }));
    await waitFor(() => expect(page(CHOICES)).toBeTruthy());
  });

  it('offline: waits ("Keep this page open"), and moves on by itself when the connection returns', async () => {
    h.grant.mockRejectedValue(new TypeError('network'));
    render(<LegalGate />);
    acceptAll();
    fireEvent.click(cont());
    await waitFor(() =>
      expect(screen.getByText(/Waiting for the connection to save your agreement/)).toBeTruthy(),
    );
    expect(page(TITLE)).toBeTruthy();
    expect(page(CHOICES)).toBeNull();
    h.grant.mockResolvedValue({ id: 'x', at: 1 });
    act(() => void window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(page(CHOICES)).toBeTruthy());
    expect(JSON.parse(localStorage.getItem(CONSENT_QUEUE_KEY) ?? '[]')).toEqual([]);
  });

  it('a permanent refusal is retried by itself, then says so with "Try again"; the ticks are kept, nothing is asked again', async () => {
    h.grant.mockRejectedValue(Object.assign(new Error('bad'), { status: 400 }));
    render(<LegalGate />);
    acceptAll();
    fireEvent.click(cont());
    await waitFor(
      () => expect(screen.getByText(/could not save your agreement yet/)).toBeTruthy(),
      { timeout: 10000 },
    );
    expect(screen.queryByText(/Please accept again/)).toBeNull();
    expect((screen.getByRole('switch', AGE) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('switch', AGREE) as HTMLInputElement).checked).toBe(true);
    expect(page(CHOICES)).toBeNull();
    const retry = screen.getByRole('button', { name: 'Try again' }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);
    h.grant.mockResolvedValue({ id: 'x', at: 1 });
    fireEvent.click(retry);
    await waitFor(() => expect(page(CHOICES)).toBeTruthy());
  }, 20000);
});

describe('unsent progress is kept on this device only', () => {
  it('keeps the read documents and both switches across a reload, and drops them once recorded', async () => {
    const a = render(<LegalGate />);
    acceptAll();
    const raw = localStorage.getItem('spotter.gateDraft.u1') ?? '';
    expect(JSON.parse(raw)).toMatchObject({ opened: ['terms', 'privacy'], age: true, agree: true });
    a.unmount();
    sessionStorage.clear(); // a different tab / browser restart: only localStorage is left
    render(<LegalGate />);
    await waitFor(() => expect(cont().disabled).toBe(false));
    expect(done()).toBe(4);
    fireEvent.click(cont());
    await waitFor(() => expect(page(CHOICES)).toBeTruthy());
    expect(localStorage.getItem('spotter.gateDraft.u1')).toBeNull();
  });

  it('a new document version or another account does not inherit it', () => {
    const a = render(<LegalGate />);
    acceptAll();
    a.unmount();
    expect(loadGateDraft('u1', 'terms@old|privacy@old')).toBeNull();
    expect(loadGateDraft('u2', 'whatever')).toBeNull();
    h.uid = 'u2';
    sessionStorage.clear();
    render(<LegalGate />);
    expect(cont().disabled).toBe(true);
  });
});

describe('?gatepreview=1', () => {
  it('shows both steps for a fully accepted account and writes nothing', async () => {
    h.state = server(REQUIRED);
    markVerifiedClear('u1');
    window.history.replaceState(null, '', '/?gatepreview=1');
    render(<LegalGate />);
    expect(page(TITLE)).toBeTruthy();
    acceptAll();
    fireEvent.click(cont());
    await waitFor(() => expect(page(CHOICES)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Turn on all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save my choices' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(h.grant).not.toHaveBeenCalled();
    expect(localStorage.getItem(CONSENT_QUEUE_KEY)).toBeNull();
    expect(localStorage.getItem('spotter.gateDraft.u1')).toBeNull();
    expect(window.location.search).toBe('');
  });
});

describe('step 2: your choices', () => {
  it('lists every optional consent, all off, with the Stepper on step 2 of 2', async () => {
    await toStep2();
    expect(screen.getByText('Step 2 of 2 · Your choices')).toBeTruthy();
    const sw = screen.getAllByRole('switch') as HTMLInputElement[];
    expect(sw).toHaveLength(9); // Atlas AI, 7 health features, gym search and maps
    expect(sw.every((s) => !s.checked)).toBe(true);
    expect(screen.getAllByText(/^If off: /).length).toBe(9);
    expect(screen.getByText('0 of 9 on')).toBeTruthy();
  });

  it('"Turn on all" switches everything on and "Turn off all" back', async () => {
    await toStep2();
    fireEvent.click(screen.getByRole('button', { name: 'Turn on all' }));
    expect((screen.getAllByRole('switch') as HTMLInputElement[]).every((s) => s.checked)).toBe(
      true,
    );
    expect(screen.getByText('9 of 9 on')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Turn off all' }));
    expect((screen.getAllByRole('switch') as HTMLInputElement[]).every((s) => !s.checked)).toBe(
      true,
    );
  });

  it('shows what is sent right under Atlas AI and gym search once they are switched on', async () => {
    await toStep2();
    expect(screen.queryByText('Who receives it')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'Atlas AI chat' }));
    expect(screen.getByText('Who receives it')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Gym search and maps' }));
    expect(screen.getAllByText('Who receives it').length).toBeGreaterThan(1);
  });

  it('Save writes the health switches that are on, Atlas AI and gym search with their full grants', async () => {
    await toStep2();
    fireEvent.click(screen.getByRole('switch', { name: 'Cycle' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Alcohol' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Alcohol' })); // turned off again
    fireEvent.click(screen.getByRole('switch', { name: 'Atlas AI chat' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Gym search and maps' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save my choices' }));
    await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(3));
    const calls = h.grant.mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.kind).sort()).toEqual(['atlas-ai', 'geo-search', 'health:cycle']);
    expect(calls.find((c) => c.kind === 'atlas-ai')).toMatchObject({
      categories: [...ATLAS_AI_CATEGORIES],
      engines: ['gemini'],
    });
    expect(calls.find((c) => c.kind === 'health:cycle')).toMatchObject({
      version: LEGAL_VERSIONS.health,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a failed Atlas grant keeps the page open with a message; Decide later closes it', async () => {
    await toStep2();
    h.grant.mockRejectedValue(Object.assign(new Error('bad'), { status: 400 }));
    fireEvent.click(screen.getByRole('switch', { name: 'Atlas AI chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save my choices' }));
    await waitFor(() => expect(screen.getByText(/Some choices were not saved/)).toBeTruthy());
    expect(page(CHOICES)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Decide later' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 6000 }); // the opening page ends with the 4 s cap
  }, 10000);

  it('Decide later writes nothing and closes; no switch on says "Save and start"', async () => {
    await toStep2();
    expect(screen.getByRole('button', { name: 'Save and start' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Decide later' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 6000 }); // the opening page ends with the 4 s cap
    expect(h.grant).not.toHaveBeenCalled();
  }, 10000);

  it('cannot be dismissed with Escape', async () => {
    await toStep2();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(page(CHOICES)).toBeTruthy();
  });

  it('is shown once per account: not again after it was shown, and a different account still sees it', async () => {
    await toStep2();
    expect(localStorage.getItem(CHOICES_SHOWN_KEY)).toBeNull(); // marked when the page is finished
    fireEvent.click(screen.getByRole('button', { name: 'Decide later' }));
    expect(localStorage.getItem(CHOICES_SHOWN_KEY)).toContain('u1');
    cleanup();
    h.uid = 'u2';
    h.state = server([]);
    render(<LegalGate />);
    expect(screen.getByText('Step 1 of 2 · Terms')).toBeTruthy();
  });

  it('is skipped when the person already has any optional consent record', () => {
    h.state = server([
      { id: 'c', kind: 'health:cycle', action: 'grant', version: LEGAL_VERSIONS.health, at: 1 },
    ]);
    render(<LegalGate />);
    expect(page(TITLE)).toBeTruthy();
    expect(screen.queryByText(/Step 1 of/)).toBeNull(); // a single step: no Stepper
  });
});

describe('sign out and delete my account', () => {
  it('Sign out asks first; Stay keeps the gate, Sign out signs out', () => {
    render(<LegalGate />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByText('Sign out?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.queryByText('Sign out?')).toBeNull();
    expect(h.signOut).not.toHaveBeenCalled();
    expect(page(TITLE)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign out' }).at(-1) as HTMLElement);
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });

  it('Delete my account opens the first of the three prompts, calling nothing', () => {
    render(<LegalGate />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(screen.getByText('Delete your account?')).toBeTruthy();
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    expect(h.signOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep my account' }));
    expect(screen.queryByText('Delete your account?')).toBeNull();
    expect(page(TITLE)).toBeTruthy();
  });
});

describe('Trainer Terms + DPA on the same page', () => {
  it('a new trainer reads Terms + Privacy + Trainer Terms + DPA on ONE page, with the key points and the Draft line', () => {
    h.role = 'trainer';
    render(<LegalGate />);
    expect(page(TITLE)).toBeTruthy();
    expect(page(TT_TITLE)).toBeNull();
    for (const d of [
      /^Terms of Use/,
      /^Privacy Policy/,
      /^Trainer Terms/,
      /^Data Processing Agreement/,
    ])
      expect(doc(d)).toBeTruthy();
    expect(screen.getByRole('switch', AGE)).toBeTruthy();
    expect(screen.getByRole('switch', AGREE_ALL)).toBeTruthy();
    expect(screen.getByText('Draft: not yet reviewed by a lawyer')).toBeTruthy();
    expect(screen.getByText('In short')).toBeTruthy();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it('every one of the four documents must be read, then both switches', () => {
    h.role = 'trainer';
    render(<LegalGate />);
    readBase();
    expect((screen.getByRole('switch', AGREE_ALL) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(doc(/^Trainer Terms/));
    expect(cont().disabled).toBe(true);
    fireEvent.click(doc(/^Data Processing Agreement/));
    fireEvent.click(screen.getByRole('switch', AGE));
    expect(cont().disabled).toBe(true);
    fireEvent.click(screen.getByRole('switch', AGREE_ALL));
    expect(cont().disabled).toBe(false);
  });

  it('Continue records terms, policy-ack, age-18 and trainer-terms in one queued go, with a hash for each text kind', async () => {
    h.role = 'trainer';
    render(<LegalGate />);
    readBase();
    readTrainer();
    fireEvent.click(screen.getByRole('switch', AGE));
    fireEvent.click(screen.getByRole('switch', AGREE_ALL));
    fireEvent.click(cont());
    await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(4));
    const calls = h.grant.mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.kind)).toEqual(['terms', 'policy-ack', 'age-18', 'trainer-terms']);
    expect(calls[2].textHash).toBeUndefined();
    expect(calls[3]).toMatchObject({ version: TT_V });
    expect(calls[3].textHash).toBe(await sha256Hex(trainerTermsHashInput('en')));
    await waitFor(() => expect(page(CHOICES)).toBeTruthy()); // new account: step 2 follows
  });

  it('a trainer who already accepted terms / policy / age sees ONLY the trainer part (no 18+, no Terms row, no step 2)', async () => {
    h.role = 'trainer';
    h.state = server(REQUIRED);
    render(<LegalGate />);
    expect(page(TT_TITLE)).toBeTruthy();
    expect(page(TITLE)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Terms of Use/ })).toBeNull();
    expect(screen.queryByRole('switch', AGE)).toBeNull();
    expect(screen.queryByText(/Step 1 of/)).toBeNull();
    expect(screen.getByText('Draft: not yet reviewed by a lawyer')).toBeTruthy();
    expect(cont().disabled).toBe(true);
    readTrainer();
    fireEvent.click(screen.getByRole('switch', AGREE_TT));
    expect(cont().disabled).toBe(false);
    fireEvent.click(cont());
    await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(1));
    expect(h.grant.mock.calls[0][0]).toMatchObject({ kind: 'trainer-terms', version: TT_V });
    expect(h.grant.mock.calls[0][0].textHash).toBe(await sha256Hex(trainerTermsHashInput('en')));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it.each(['trainer', 'manager', 'admin'])(
    'a %s who lacks only the trainer terms is asked; a member never',
    (role) => {
      h.state = server(REQUIRED);
      const m = render(<LegalGate />);
      expect(screen.queryByRole('dialog')).toBeNull();
      m.unmount();
      h.role = role;
      render(<LegalGate />);
      expect(page(TT_TITLE)).toBeTruthy();
    },
  );

  it('a member with nothing on record sees no trainer block', () => {
    render(<LegalGate />);
    expect(page(TITLE)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Trainer Terms/ })).toBeNull();
    expect(screen.queryByText('Draft: not yet reviewed by a lawyer')).toBeNull();
    expect(screen.queryByRole('switch', AGREE_ALL)).toBeNull();
  });

  it.each([
    ['an older version', ttRec({ version: '2026-10-21' })],
    ['a withdrawn acceptance', ttRec({ action: 'withdraw' })],
  ])('%s of the trainer terms asks again (trainer part alone)', (_n, record) => {
    h.role = 'trainer';
    h.state = server([...REQUIRED, record]);
    render(<LegalGate />);
    expect(page(TT_TITLE)).toBeTruthy();
  });

  it("a current trainer-terms acceptance shows nothing, and is remembered as the trainer's verified clear", () => {
    h.role = 'trainer';
    h.state = server([...REQUIRED, ttRec()]);
    render(<LegalGate />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(wasVerifiedClear('u1', true)).toBe(true);
  });

  it('role promotion after the member accepted: the trainer part is asked at once', async () => {
    render(<LegalGate />);
    acceptAll();
    fireEvent.click(cont());
    await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(page(CHOICES)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Decide later' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 6000 }); // the opening page ends with the 4 s cap
    h.state = server(REQUIRED);
    h.role = 'trainer';
    act(() => h.roleListeners.forEach((cb) => cb()));
    await waitFor(() => expect(page(TT_TITLE)).toBeTruthy());
    expect(page(TITLE)).toBeNull();
  }, 10000);

  it('role change while the server cannot be reached: the member cache does not count, so the trainer sees the loading page', () => {
    markVerifiedClear('u1', false);
    h.state = { records: [], loading: false, confirmed: false, error: null };
    h.role = 'trainer';
    render(<LegalGate />);
    expect(unverified()).toBeTruthy();
  });
});
