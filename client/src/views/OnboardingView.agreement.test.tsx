import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  uid: null as string | null,
  callFn: vi.fn(),
  grant: vi.fn(),
}));
vi.mock('../api', () => ({
  registerSignOutFlush: () => undefined, // signupConsents registers its queues with api.ts at import
  callFn: h.callFn,
  currentUid: () => h.uid,
  signInWithPayload: vi.fn(async () => {
    h.uid = 'u1';
  }),
}));
vi.mock('../legal/consentApi', () => ({ grantConsent: h.grant }));
vi.mock('../store', () => ({
  addWeight: vi.fn(),
  startWorkout: vi.fn(),
  updateBodyMetrics: vi.fn(),
  upsertGym: vi.fn(),
  getCurrentPositionOnce: vi.fn(),
}));

import { OnboardingView } from './OnboardingView';
import { LEGAL_VERSIONS } from '../legal/consents';
import { CONSENT_QUEUE_KEY } from '../legal/signupConsents';

const invite = { state: 'valid', kind: 'invite', inviter: 'Coach', expiresAt: Date.now() + 1e9 };

function setup() {
  h.callFn.mockImplementation(async (name: string) => {
    if (name === 'invitePreview') return invite;
    if (name === 'claim') return { token: 't', userId: 'u1' };
    return undefined;
  });
  return render(<OnboardingView token="tok" onDone={vi.fn()} skipLanding />);
}
const fill = (ph: string, v: string) =>
  fireEvent.change(screen.getByPlaceholderText(ph), { target: { value: v } });
const cont = () => screen.getByRole('button', { name: /^Continue/ }) as HTMLButtonElement;
const fillAll = async () => {
  await screen.findByText('Before you continue');
  fill('First name', 'Ann');
  fill('Username', 'ann');
  fill('Password (min. 6 characters)', 'secret1');
};
const openBoth = () => {
  fireEvent.click(screen.getByText('Terms of Use'));
  fireEvent.click(screen.getByText('Privacy Policy'));
};

beforeEach(() => {
  localStorage.clear();
  h.uid = null;
  h.callFn.mockReset();
  h.grant.mockReset();
  h.grant.mockResolvedValue({ id: 'x', at: 1 });
  vi.spyOn(window, 'open').mockImplementation(() => ({ opener: {} }) as unknown as Window);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('OnboardingView step 1: read-before-accept', () => {
  it('blocked: Continue is disabled with the form filled until documents are opened and both boxes ticked', async () => {
    setup();
    await fillAll();
    expect(cont().disabled).toBe(true);
    expect(screen.getAllByText('Not opened yet')).toHaveLength(2);
    const [age, agree] = screen.getAllByRole('switch') as HTMLInputElement[];
    expect(age.disabled && agree.disabled).toBe(true);

    fireEvent.click(screen.getByText('Terms of Use'));
    expect(cont().disabled).toBe(true);
    fireEvent.click(screen.getByText('Privacy Policy'));
    expect(age.disabled).toBe(false);
    expect(cont().disabled).toBe(true); // read, but not agreed
    fireEvent.click(age);
    expect(cont().disabled).toBe(true);
    fireEvent.click(agree);
    expect(cont().disabled).toBe(false); // ready
  });

  it('even with everything agreed, an incomplete form keeps Continue disabled', async () => {
    setup();
    await screen.findByText('Before you continue');
    openBoth();
    const [age, agree] = screen.getAllByRole('switch');
    fireEvent.click(age);
    fireEvent.click(agree);
    expect(cont().disabled).toBe(true);
  });

  it('opens each document in a new tab at its public route, keeping this page', async () => {
    setup();
    await screen.findByText('Before you continue');
    fireEvent.click(screen.getByText('Terms of Use'));
    fireEvent.click(screen.getByText('Privacy Policy'));
    const urls = (window.open as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(urls[0]).toMatch(/#\/terms$/);
    expect(urls[1]).toMatch(/#\/privacy$/);
    expect(screen.getByPlaceholderText('First name')).toBeTruthy();
  });

  it('ready: claims the account, then records terms, policy-ack and age-18 with versions', async () => {
    setup();
    await fillAll();
    openBoth();
    for (const c of screen.getAllByRole('switch')) fireEvent.click(c);
    fireEvent.click(cont());
    await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(3));
    expect(h.callFn).toHaveBeenCalledWith('claim', expect.objectContaining({ token: 'tok' }));
    const calls = h.grant.mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.kind)).toEqual(['terms', 'policy-ack', 'age-18']);
    expect(calls.every((c) => c.version === LEGAL_VERSIONS.terms)).toBe(true);
    expect(calls[0].textHash).toMatch(/^[0-9a-f]{64}$/);
    expect(calls[1].textHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('offline recording does not block sign-up and leaves the consents queued', async () => {
    h.grant.mockRejectedValue(new Error('offline'));
    setup();
    await fillAll();
    openBoth();
    for (const c of screen.getAllByRole('switch')) fireEvent.click(c);
    fireEvent.click(cont());
    await waitFor(() => expect(h.callFn).toHaveBeenCalledWith('claim', expect.anything()));
    await waitFor(() => expect(localStorage.getItem(CONSENT_QUEUE_KEY)).toContain('policy-ack'));
  });

  it('a resumed invite (account already created) is not asked again', async () => {
    h.uid = 'u1';
    localStorage.setItem('onb.tok', JSON.stringify({ step: 1, name: 'Ann' }));
    setup();
    await screen.findByPlaceholderText('First name');
    expect(screen.queryByText('Before you continue')).toBeNull();
  });
});
