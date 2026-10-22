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

import { isGeoPromptOpen, resetGeoGateForTests } from '../data/geoSearchGate';
import { resetAiOverride } from '../atlas/aiConsent';
import { LegalGate } from './LegalGate';
import { LEGAL_VERSIONS, currentVersion, type ConsentRecord } from './consents';
import { CHOICES_SHOWN_KEY, ATLAS_AI_CATEGORIES } from './gateChoices';
import { CONSENT_QUEUE_KEY } from './signupConsents';
import { markVerifiedClear, wasVerifiedClear } from './gateVerified';
import { sha256Hex } from './textHash';
import { trainerTermsHashInput } from './trainerTerms';

const TITLE = 'We updated how Spotter works with your data';
const CHOICES = 'Choose what Spotter may do';

function rec(kind: ConsentRecord['kind']): ConsentRecord {
  return { id: kind, kind, action: 'grant', version: LEGAL_VERSIONS.terms, at: 1 };
}
const REQUIRED = [rec('terms'), rec('policy-ack'), rec('age-18')];

beforeEach(() => {
  resetGeoGateForTests();
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = '#/today';
  h.uid = 'u1';
  h.role = 'member';
  h.roleListeners.clear();
  h.state = { records: [], loading: false, confirmed: true, error: null };
  h.grant.mockReset();
  h.grant.mockResolvedValue({ id: 'x', at: 1 });
  h.signOut.mockReset();
  vi.spyOn(window, 'open').mockReturnValue({ opener: 1 } as unknown as Window);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// The blocking sheet for an unverifiable agreement: checking, offline or service problem (each has its own title).
const unverified = () =>
  screen.queryByRole('alertdialog', {
    name: /Connect to continue|Checking your agreement|couldn't check your agreement/,
  });
const dialog = (name: string) => screen.queryByRole('alertdialog', { name });
const cont = () => screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;

function acceptAll() {
  fireEvent.click(screen.getByText('Terms of Use'));
  fireEvent.click(screen.getByText('Privacy Policy'));
  fireEvent.click(screen.getByRole('checkbox', { name: 'I am 18 or older.' }));
  fireEvent.click(
    screen.getByRole('checkbox', {
      name: 'I agree to the Terms of Use and acknowledge the Privacy Policy.',
    }),
  );
}

describe('when the gate shows', () => {
  it('shows drawer 1 only when the server confirmed a required consent is missing', () => {
    render(<LegalGate />);
    expect(dialog(TITLE)).toBeTruthy();
  });

  it.each([
    ['loading', { records: [], loading: true, confirmed: false, error: null }],
    ['error', { records: [], loading: false, confirmed: false, error: new Error('x') }],
    [
      'offline without server confirmation',
      { records: [], loading: false, confirmed: false, error: null },
    ],
    [
      'all required consents current',
      { records: REQUIRED, loading: false, confirmed: true, error: null },
    ],
  ])(
    'never shows drawer 1 on %s (and not the connect screen once this device saw the consents confirmed)',
    (_n, state) => {
      h.state = state;
      markVerifiedClear('u1');
      render(<LegalGate />);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    },
  );

  it.each([
    ['loading', { records: [], loading: true, confirmed: false, error: null }],
    ['error', { records: [], loading: false, confirmed: false, error: new Error('x') }],
    [
      'offline without server confirmation',
      { records: [], loading: false, confirmed: false, error: null },
    ],
  ])(
    'blocks with the connect screen on %s when nothing was ever confirmed on this device',
    (_n, state) => {
      h.state = state;
      render(<LegalGate />);
      expect(unverified()).toBeTruthy();
      expect(dialog(TITLE)).toBeNull();
      expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    },
  );

  it('the connect screen turns into drawer 1 / the app when the server answers, and says "checking" while online', () => {
    h.state = { records: [], loading: true, confirmed: false, error: null };
    const { rerender } = render(<LegalGate />);
    expect(screen.getByRole('status').textContent).toMatch(/Checking/);
    h.state = { records: [], loading: false, confirmed: true, error: null };
    rerender(<LegalGate />);
    expect(unverified()).toBeNull();
    expect(dialog(TITLE)).toBeTruthy();
  });

  it('a stale cached "clear" (older document versions) does not count', () => {
    localStorage.setItem('spotter.consentVerified', JSON.stringify({ u1: 'terms@2000-01-01' }));
    h.state = { records: [], loading: false, confirmed: false, error: null };
    render(<LegalGate />);
    expect(unverified()).toBeTruthy();
  });

  it('remembers a server-confirmed clear, forgets it when the server says a consent is missing', () => {
    h.state = { records: REQUIRED, loading: false, confirmed: true, error: null };
    const { unmount } = render(<LegalGate />);
    expect(wasVerifiedClear('u1')).toBe(true);
    expect(wasVerifiedClear('u2')).toBe(false);
    unmount();
    h.state = { records: [], loading: false, confirmed: true, error: null };
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

  it('does not show the connect screen on a legal page or invite link, nor once registration queued the consents', () => {
    h.state = { records: [], loading: false, confirmed: false, error: null };
    window.location.hash = '#/privacy';
    const a = render(<LegalGate />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    a.unmount();
    window.location.hash = '#/join/abc';
    const b = render(<LegalGate />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    b.unmount();
  });

  it('does not show when signed out, on a public legal page, on an invite link, or when registration just queued the consents', () => {
    h.uid = null;
    const { unmount } = render(<LegalGate />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    unmount();
    h.uid = 'u1';
    window.location.hash = '#/privacy';
    const b = render(<LegalGate />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    b.unmount();
    window.location.hash = '#/join/abc';
    const c = render(<LegalGate />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
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
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('a queued grant the server can never accept does not hide the gate', () => {
  it('shows when the queued required grants are of an older version', () => {
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
    expect(dialog(TITLE)).toBeTruthy();
  });
});

describe('the read-gate survives a same-tab remount (popup blocked, the document opens in this tab)', () => {
  it('opened documents stay opened after the gate unmounts and mounts again; Continue resets them', async () => {
    sessionStorage.clear();
    const a = render(<LegalGate />);
    fireEvent.click(screen.getByText('Terms of Use'));
    fireEvent.click(screen.getByText('Privacy Policy'));
    a.unmount();
    render(<LegalGate />);
    const age = screen.getByRole('checkbox', { name: 'I am 18 or older.' }) as HTMLInputElement;
    expect(age.disabled).toBe(false);
    fireEvent.click(age);
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'I agree to the Terms of Use and acknowledge the Privacy Policy.',
      }),
    );
    fireEvent.click(cont());
    await waitFor(() => expect(dialog(CHOICES)).toBeTruthy());
    expect(Object.keys(sessionStorage).filter((k) => k.startsWith('spotter.docRead.'))).toEqual([]);
  });
});

describe('drawer 1', () => {
  it('cannot be dismissed: no close button, Escape and the scrim do nothing', () => {
    render(<LegalGate />);
    expect(document.querySelector('.sheet-close')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(document.querySelector('.scrim') as HTMLElement);
    expect(dialog(TITLE)).toBeTruthy();
    expect(h.grant).not.toHaveBeenCalled();
  });

  it('Continue stays disabled until both documents are opened and both boxes ticked', () => {
    render(<LegalGate />);
    expect(cont().disabled).toBe(true);
    fireEvent.click(screen.getByText('Terms of Use'));
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining('#/terms'), 'spotter-legal');
    expect(cont().disabled).toBe(true);
    fireEvent.click(screen.getByText('Privacy Policy'));
    expect(cont().disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'I am 18 or older.' }));
    expect(cont().disabled).toBe(true);
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'I agree to the Terms of Use and acknowledge the Privacy Policy.',
      }),
    );
    expect(cont().disabled).toBe(false);
  });

  it('Continue records terms, policy-ack, age-18 with versions and hashes, and moves on without waiting for the network', async () => {
    let release: (v: unknown) => void = () => undefined;
    h.grant.mockReturnValue(new Promise((r) => (release = r))); // the network is slow
    render(<LegalGate />);
    acceptAll();
    fireEvent.click(cont());
    await waitFor(() => expect(dialog(CHOICES)).toBeTruthy());
    expect(dialog(TITLE)).toBeNull();
    await waitFor(() => expect(h.grant).toHaveBeenCalled());
    const first = h.grant.mock.calls[0][0];
    expect(first).toMatchObject({ kind: 'terms', version: LEGAL_VERSIONS.terms });
    expect(first.textHash).toMatch(/^[0-9a-f]{64}$/);
    // queued locally first: nothing is lost while offline
    expect(JSON.parse(localStorage.getItem(CONSENT_QUEUE_KEY) ?? '[]')[0].items).toHaveLength(3);
    h.grant.mockResolvedValue({ id: 'x', at: 1 });
    await act(async () => release({ id: 'x', at: 1 })); // let the flush finish (it is module state)
  });

  it('all three kinds are sent', async () => {
    render(<LegalGate />);
    acceptAll();
    fireEvent.click(cont());
    await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(3));
    const calls = h.grant.mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.kind)).toEqual(['terms', 'policy-ack', 'age-18']);
    expect(calls[1]).toMatchObject({ version: LEGAL_VERSIONS.policy });
    expect(calls[1].textHash).toMatch(/^[0-9a-f]{64}$/);
    expect(calls[2]).toMatchObject({ version: LEGAL_VERSIONS.age });
    expect(calls[2].textHash).toBeUndefined();
  });
});

describe('sign out', () => {
  it('asks first; Stay keeps the gate, Sign out signs out', () => {
    render(<LegalGate />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByText('Sign out?')).toBeTruthy();
    expect(
      screen.getByText(
        "You can't use Spotter until you accept the Terms and Privacy Policy. Your data stays; you can also delete your account.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.queryByText('Sign out?')).toBeNull();
    expect(h.signOut).not.toHaveBeenCalled();
    expect(dialog(TITLE)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    const confirm = screen.getAllByRole('button', { name: 'Sign out' }).at(-1) as HTMLElement;
    fireEvent.click(confirm);
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });
});

async function toDrawer2() {
  render(<LegalGate />);
  acceptAll();
  fireEvent.click(cont());
  await waitFor(() => expect(dialog(CHOICES)).toBeTruthy());
  await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(3));
  h.grant.mockClear();
}

describe('drawer 2', () => {
  it('lists every optional consent, all off', async () => {
    await toDrawer2();
    const sw = screen.getAllByRole('switch') as HTMLInputElement[];
    expect(sw).toHaveLength(9); // Atlas AI, 7 health features, gym search and maps
    expect(sw.every((s) => !s.checked)).toBe(true);
    expect(screen.getByText('Atlas AI chat')).toBeTruthy();
    expect(screen.getByText('Gym search and maps')).toBeTruthy();
    expect(screen.getAllByText(/^If off: /).length).toBe(9);
    expect(
      screen.getByText('You can change any of this later in Settings > Your privacy > Consents.'),
    ).toBeTruthy();
  });

  it('Save my choices writes only the short-sentence switches that are on, with the displayed version', async () => {
    await toDrawer2();
    fireEvent.click(screen.getByRole('switch', { name: 'Cycle' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Alcohol' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Alcohol' })); // turned off again
    fireEvent.click(screen.getByRole('button', { name: 'Save my choices' }));
    await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(1));
    const calls = h.grant.mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.kind)).toEqual(['health:cycle']);
    expect(calls[0]).toMatchObject({ version: LEGAL_VERSIONS.health });
    expect(calls[0].categories).toBeUndefined();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(isGeoPromptOpen()).toBe(false);
  });

  it('Atlas AI on: opens the full Atlas prompt and records atlas-ai only after it is accepted there', async () => {
    await toDrawer2();
    fireEvent.click(screen.getByRole('switch', { name: 'Atlas AI chat' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Cycle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save my choices' }));
    await waitFor(() => expect(screen.getByText('Turn on Atlas AI chat?')).toBeTruthy());
    // the short-sentence choice is saved, the Atlas one is not recorded yet
    await waitFor(() => expect(h.grant.mock.calls.map((c) => c[0].kind)).toEqual(['health:cycle']));
    fireEvent.click(screen.getByRole('button', { name: 'Turn on Atlas AI' }));
    await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(2));
    expect(h.grant.mock.calls[1][0]).toMatchObject({
      kind: 'atlas-ai',
      categories: [...ATLAS_AI_CATEGORIES],
      engines: ['gemini'],
    });
    await waitFor(() => expect(screen.queryByText('Turn on Atlas AI chat?')).toBeNull());
    resetAiOverride();
  });

  it('declining the Atlas prompt keeps Atlas off and still saves the other choices', async () => {
    await toDrawer2();
    fireEvent.click(screen.getByRole('switch', { name: 'Atlas AI chat' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Cycle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save my choices' }));
    await waitFor(() => expect(screen.getByText('Turn on Atlas AI chat?')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByText('Turn on Atlas AI chat?')).toBeNull());
    await act(async () => undefined);
    expect(h.grant.mock.calls.map((c) => c[0].kind)).toEqual(['health:cycle']);
  });

  it('Gym search on: opens the geo consent prompt (after Atlas, if both) and records nothing itself', async () => {
    await toDrawer2();
    fireEvent.click(screen.getByRole('switch', { name: 'Gym search and maps' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save my choices' }));
    await waitFor(() => expect(isGeoPromptOpen()).toBe(true));
    await act(async () => undefined);
    expect(h.grant).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('both on: Atlas prompt first, the geo prompt opens once Atlas is answered', async () => {
    await toDrawer2();
    fireEvent.click(screen.getByRole('switch', { name: 'Atlas AI chat' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Gym search and maps' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save my choices' }));
    await waitFor(() => expect(screen.getByText('Turn on Atlas AI chat?')).toBeTruthy());
    expect(isGeoPromptOpen()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(isGeoPromptOpen()).toBe(true));
    expect(h.grant).not.toHaveBeenCalled();
  });

  it('Decide later writes nothing and closes', async () => {
    await toDrawer2();
    fireEvent.click(screen.getByRole('button', { name: 'Decide later' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await act(async () => undefined);
    expect(h.grant).not.toHaveBeenCalled();
  });

  it('cannot be dismissed with Escape or the scrim', async () => {
    await toDrawer2();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(document.querySelector('.scrim') as HTMLElement);
    expect(dialog(CHOICES)).toBeTruthy();
  });

  it('is shown once per account: not again after a reload, and a different account still sees it', async () => {
    await toDrawer2();
    fireEvent.click(screen.getByRole('button', { name: 'Decide later' }));
    expect(JSON.parse(localStorage.getItem(CHOICES_SHOWN_KEY) ?? '[]')).toEqual(['u1']);
    cleanup();
    // reload: the gate is still needed (records not yet confirmed as arrived), drawer 2 must not come back
    render(<LegalGate />);
    acceptAll();
    fireEvent.click(cont());
    await act(async () => undefined);
    expect(dialog(CHOICES)).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    cleanup();
    h.uid = 'u2';
    render(<LegalGate />);
    acceptAll();
    fireEvent.click(cont());
    await waitFor(() => expect(dialog(CHOICES)).toBeTruthy());
  });

  it('is skipped when the person already has any optional consent record', async () => {
    h.state = { records: [rec('geo-search')], loading: false, confirmed: true, error: null };
    render(<LegalGate />);
    acceptAll();
    fireEvent.click(cont());
    await act(async () => undefined);
    expect(dialog(CHOICES)).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('delete my account (SPO-285)', () => {
  it('the gate offers it next to Sign out and it opens the first of the three prompts, calling nothing', () => {
    render(<LegalGate />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(screen.getByText('Delete your account?')).toBeTruthy();
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    expect(h.signOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep my account' }));
    expect(screen.queryByText('Delete your account?')).toBeNull();
    expect(dialog(TITLE)).toBeTruthy(); // the gate is still there
  });
});

// --- Trainer Terms + DPA in the same drawer (SPO-295, owner decision 22.10) -----------------------------------------
const TT_TITLE = 'Trainer Terms and data processing';
const TT_V = LEGAL_VERSIONS['trainer-terms'];
const ttRec = (over: Partial<ConsentRecord> = {}): ConsentRecord => ({
  id: 'tt',
  kind: 'trainer-terms',
  action: 'grant',
  version: TT_V,
  at: 2,
  ...over,
});
const AGREE_ALL = {
  name: 'I agree to the Terms of Use, the Trainer Terms and the DPA, and acknowledge the Privacy Policy.',
};
const AGREE_TT = { name: 'I have read and accept the Trainer Terms and the DPA.' };
const openTrainerDocs = () => {
  fireEvent.click(screen.getByText('Trainer Terms'));
  fireEvent.click(screen.getByText('Data Processing Agreement (DPA)'));
};
const server = (records: ConsentRecord[]) => ({
  records,
  loading: false,
  confirmed: true,
  error: null,
});
const setRole = (role: string) =>
  act(() => {
    h.role = role;
    h.roleListeners.forEach((f) => f());
  });

describe('Trainer Terms + DPA in drawer 1', () => {
  it('a new trainer sees Terms + Privacy + 18+ + Trainer Terms + DPA in ONE drawer, with the key points and the Draft line', () => {
    h.role = 'trainer';
    render(<LegalGate />);
    expect(dialog(TITLE)).toBeTruthy();
    expect(dialog(TT_TITLE)).toBeNull();
    for (const d of [
      'Terms of Use',
      'Privacy Policy',
      'Trainer Terms',
      'Data Processing Agreement (DPA)',
    ])
      expect(screen.getByText(d)).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'I am 18 or older.' })).toBeTruthy();
    expect(screen.getByRole('checkbox', AGREE_ALL)).toBeTruthy();
    expect(screen.getByText('Draft: not yet reviewed by a lawyer')).toBeTruthy();
    expect(screen.getByText('In short')).toBeTruthy();
    expect(
      screen.getByText('This is a summary, not the contract. The two documents decide.'),
    ).toBeTruthy();
    expect(document.querySelectorAll('[role="alertdialog"]')).toHaveLength(1);
  });

  it('the read-gate covers all four documents: Continue needs every one opened, then both boxes', () => {
    h.role = 'trainer';
    render(<LegalGate />);
    fireEvent.click(screen.getByText('Terms of Use'));
    fireEvent.click(screen.getByText('Privacy Policy'));
    expect((screen.getByRole('checkbox', AGREE_ALL) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('Trainer Terms'));
    expect(cont().disabled).toBe(true);
    fireEvent.click(screen.getByText('Data Processing Agreement (DPA)'));
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining('#/dpa'), 'spotter-legal');
    fireEvent.click(screen.getByRole('checkbox', { name: 'I am 18 or older.' }));
    expect(cont().disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', AGREE_ALL));
    expect(cont().disabled).toBe(false);
  });

  it('Continue records terms, policy-ack, age-18 and trainer-terms in one queued go, with a hash for each text kind', async () => {
    h.role = 'trainer';
    let release: (v: unknown) => void = () => undefined;
    h.grant.mockReturnValue(new Promise((r) => (release = r))); // slow network: the queue is what is certain
    render(<LegalGate />);
    openTrainerDocs();
    fireEvent.click(screen.getByText('Terms of Use'));
    fireEvent.click(screen.getByText('Privacy Policy'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'I am 18 or older.' }));
    fireEvent.click(screen.getByRole('checkbox', AGREE_ALL));
    expect(cont().disabled).toBe(false);
    fireEvent.click(cont());
    await waitFor(() => expect(dialog(CHOICES)).toBeTruthy()); // new account: drawer 2 follows, no waiting
    await waitFor(() => expect(h.grant).toHaveBeenCalled());
    expect(
      JSON.parse(localStorage.getItem(CONSENT_QUEUE_KEY) ?? '[]')[0].items.map(
        (i: { kind: string }) => i.kind,
      ),
    ).toEqual(['terms', 'policy-ack', 'age-18', 'trainer-terms']);
    h.grant.mockResolvedValue({ id: 'x', at: 1 });
    await act(async () => release({ id: 'x', at: 1 }));
    await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(4));
    const calls = h.grant.mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.kind)).toEqual(['terms', 'policy-ack', 'age-18', 'trainer-terms']);
    expect(calls[0].textHash).toMatch(/^[0-9a-f]{64}$/);
    expect(calls[1].textHash).toMatch(/^[0-9a-f]{64}$/);
    expect(calls[2].textHash).toBeUndefined();
    expect(calls[3]).toMatchObject({ version: TT_V });
    expect(calls[3].textHash).toBe(await sha256Hex(trainerTermsHashInput('en')));
  });

  it('a trainer who already accepted terms / policy / age sees ONLY the trainer block (no 18+, no Terms rows, no drawer 2)', async () => {
    h.role = 'trainer';
    h.state = server(REQUIRED);
    render(<LegalGate />);
    expect(dialog(TT_TITLE)).toBeTruthy();
    expect(dialog(TITLE)).toBeNull();
    expect(screen.queryByText('Terms of Use')).toBeNull();
    expect(screen.queryByText('Privacy Policy')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'I am 18 or older.' })).toBeNull();
    expect(screen.getByText('Draft: not yet reviewed by a lawyer')).toBeTruthy();
    expect(cont().disabled).toBe(true);
    openTrainerDocs();
    fireEvent.click(screen.getByRole('checkbox', AGREE_TT));
    expect(cont().disabled).toBe(false);
    fireEvent.click(cont());
    await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(1));
    expect(h.grant.mock.calls[0][0]).toMatchObject({ kind: 'trainer-terms', version: TT_V });
    expect(h.grant.mock.calls[0][0].textHash).toBe(await sha256Hex(trainerTermsHashInput('en')));
    expect(screen.queryByRole('alertdialog')).toBeNull(); // not drawer 2 again
  });

  it.each(['trainer', 'manager', 'admin'])(
    'a %s who lacks only the trainer terms is asked; a member never',
    (role) => {
      h.state = server(REQUIRED);
      h.role = 'member';
      const m = render(<LegalGate />);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      m.unmount();
      h.role = role;
      render(<LegalGate />);
      expect(dialog(TT_TITLE)).toBeTruthy();
    },
  );

  it('a member with nothing on record sees the old drawer 1 without any trainer block', () => {
    render(<LegalGate />);
    expect(dialog(TITLE)).toBeTruthy();
    expect(screen.queryByText('Trainer Terms')).toBeNull();
    expect(screen.queryByText('Draft: not yet reviewed by a lawyer')).toBeNull();
    expect(screen.queryByRole('checkbox', AGREE_ALL)).toBeNull();
  });

  it.each([
    ['an older version', ttRec({ version: '2026-10-21' })],
    ['a withdrawn acceptance', ttRec({ action: 'withdraw' })],
  ])('%s of the trainer terms asks again (trainer block alone)', (_n, record) => {
    h.role = 'trainer';
    h.state = server([...REQUIRED, record]);
    render(<LegalGate />);
    expect(dialog(TT_TITLE)).toBeTruthy();
  });

  it("a current trainer-terms acceptance shows nothing, and is remembered as the trainer's verified clear", () => {
    h.role = 'trainer';
    h.state = server([...REQUIRED, ttRec()]);
    render(<LegalGate />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(wasVerifiedClear('u1', true)).toBe(true);
    expect(wasVerifiedClear('u1', false)).toBe(false);
  });

  it('role change: an accepted member promoted to trainer is asked for the trainer part at once; a stale member "clear" does not vouch for a trainer', () => {
    h.state = server(REQUIRED);
    render(<LegalGate />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(wasVerifiedClear('u1', false)).toBe(true);
    setRole('trainer');
    expect(dialog(TT_TITLE)).toBeTruthy();
    expect(wasVerifiedClear('u1', true)).toBe(false);
  });

  it('role change while the server cannot be reached: the member cache does not count, so the trainer is told to connect', () => {
    markVerifiedClear('u1'); // as a member
    h.state = { records: REQUIRED, loading: false, confirmed: false, error: null };
    render(<LegalGate />);
    expect(screen.queryByRole('alertdialog')).toBeNull(); // a member: fail open
    setRole('manager');
    expect(unverified()).toBeTruthy();
  });

  it.each([
    ['loading', { records: [], loading: true, confirmed: false, error: null }],
    ['error', { records: [], loading: false, confirmed: false, error: new Error('x') }],
    ['offline', { records: [], loading: false, confirmed: false, error: null }],
  ])(
    'unknown (%s): a trainer with a cached clear for trainers is not blocked, without it the connect screen blocks',
    (_n, state) => {
      h.role = 'trainer';
      h.state = state;
      markVerifiedClear('u1', true);
      const a = render(<LegalGate />);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      a.unmount();
      localStorage.clear();
      render(<LegalGate />);
      expect(unverified()).toBeTruthy();
      expect(dialog(TT_TITLE)).toBeNull();
      expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    },
  );

  it('does not ask again while the trainer-terms grant is queued; a new trainer who just registered is asked for the trainer part only', () => {
    h.role = 'trainer';
    h.state = server(REQUIRED);
    localStorage.setItem(
      CONSENT_QUEUE_KEY,
      JSON.stringify([{ uid: 'u1', items: [{ kind: 'trainer-terms', version: TT_V }] }]),
    );
    const a = render(<LegalGate />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    a.unmount();
    // registration queued terms / policy-ack / age-18; the account is a trainer (role arrived with the claim)
    h.state = server([]);
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
    expect(dialog(TT_TITLE)).toBeTruthy();
    expect(screen.queryByText('Terms of Use')).toBeNull();
  });

  it('is not shown on a public legal page or an invite link (the documents are read there)', () => {
    h.role = 'trainer';
    window.location.hash = '#/trainer-terms';
    const a = render(<LegalGate />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    a.unmount();
    window.location.hash = '#/dpa';
    render(<LegalGate />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('declining = Sign out / Delete my account, exactly like the base gate; nothing is recorded', () => {
    h.role = 'trainer';
    h.state = server(REQUIRED);
    render(<LegalGate />);
    expect(document.querySelector('.sheet-close')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dialog(TT_TITLE)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(screen.getByText('Delete your account?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep my account' }));
    expect(dialog(TT_TITLE)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByText('Sign out?')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign out' }).at(-1) as HTMLElement);
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(h.grant).not.toHaveBeenCalled();
    expect(localStorage.getItem(CONSENT_QUEUE_KEY)).toBeNull();
  });
});

describe('drawer 1 follows the live need (not a one-way stage)', () => {
  const refusal = () => Object.assign(new Error('bad'), { status: 400 });

  it('a permanent refusal brings the drawer back with a visible error', async () => {
    h.grant.mockRejectedValue(refusal());
    render(<LegalGate />);
    acceptAll();
    fireEvent.click(cont());
    await waitFor(() => expect(dialog(CHOICES)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Decide later|Later/ }));
    await waitFor(() => expect(dialog(TITLE)).toBeTruthy());
    expect(screen.getByText(/could not record your agreement/)).toBeTruthy();
    expect(cont().disabled).toBe(true); // ticks and reads start over
  });

  it('role promotion after the member accepted: the trainer part is asked at once', async () => {
    render(<LegalGate />);
    acceptAll();
    fireEvent.click(cont());
    await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(dialog(CHOICES)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Decide later|Later/ }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    h.state = { records: REQUIRED, loading: false, confirmed: true, error: null };
    h.role = 'trainer';
    act(() => h.roleListeners.forEach((cb) => cb()));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeTruthy());
    expect(dialog(TITLE)).toBeNull(); // the trainer part alone
  });
});
