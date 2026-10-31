import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  state: { email: null, verified: false, required: true } as {
    email: string | null;
    verified: boolean;
    required?: boolean;
  },
  attach: vi.fn(),
  send: vi.fn(),
  refresh: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('./emailApi', async (orig) => {
  const real = await orig<typeof import('./emailApi')>();
  return {
    ...real,
    attachEmail: h.attach,
    sendConfirmation: h.send,
    refreshEmailState: h.refresh,
  };
});
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  currentUid: () => 'u1',
  onAuthChange: () => () => undefined,
  signOut: h.signOut,
}));

import { HttpError } from '../api';
import { EmailGate } from './EmailGate';
import { EMAIL_AUTH_LOCALES } from '../i18n/emailAuth';
import { setLegalGateUp } from '../legal/gateUp';

const t = EMAIL_AUTH_LOCALES.en;
const field = (type: string) => document.querySelector(`input[type=${type}]`) as HTMLInputElement;

beforeEach(() => {
  h.state = { email: null, verified: false, required: true };
  h.refresh.mockReset().mockImplementation(async () => h.state);
  h.attach.mockReset();
  h.send.mockReset().mockResolvedValue(undefined);
  window.history.replaceState(null, '', '/');
  window.location.hash = '';
});
afterEach(() => {
  cleanup();
  setLegalGateUp(false);
});

describe('EmailGate', () => {
  it('shows nothing while the switch is off', async () => {
    h.state = { email: null, verified: false, required: false };
    render(<EmailGate />);
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays out of the way while the server cannot be reached', async () => {
    h.refresh.mockRejectedValue(new HttpError(503, 'offline'));
    render(<EmailGate />);
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('waits behind the legal gate page', async () => {
    setLegalGateUp(true);
    render(<EmailGate />);
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => setLegalGateUp(false));
    await screen.findByRole('dialog', { name: t.gateAddTitle });
  });

  it('add: email + password, links, sends the letter, moves to "check your inbox"', async () => {
    h.attach.mockResolvedValue({ email: 'ada@example.com', verified: false });
    render(<EmailGate />);
    await screen.findByRole('dialog', { name: t.gateAddTitle });
    const send = screen.getByRole('button', { name: t.gateAddAction }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(field('email'), { target: { value: 'ada@example.com' } });
    fireEvent.change(field('password'), { target: { value: 'pw' } });
    expect(send.disabled).toBe(false);
    fireEvent.click(send);
    await screen.findByRole('dialog', { name: t.gateCheckTitle('ada@example.com') });
    expect(h.attach).toHaveBeenCalledWith('ada@example.com', 'pw');
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(screen.getByText(t.resendSent)).toBeTruthy();
    // the resend button is on cooldown right after a letter went out
    expect(
      (screen.getByRole('button', { name: /Send again in/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('a refusal shows localized text and nothing is sent', async () => {
    h.attach.mockRejectedValue(new HttpError(409, 'x', { reason: 'taken' }));
    render(<EmailGate />);
    await screen.findByRole('dialog', { name: t.gateAddTitle });
    fireEvent.change(field('email'), { target: { value: 'ada@example.com' } });
    fireEvent.change(field('password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: t.gateAddAction }));
    await screen.findByText(t.errors.taken);
    expect(h.send).not.toHaveBeenCalled();
  });

  it('check your inbox: still unconfirmed, then confirmed closes the page', async () => {
    h.state = { email: 'ada@example.com', verified: false, required: true };
    render(<EmailGate />);
    await screen.findByRole('dialog', { name: t.gateCheckTitle('ada@example.com') });
    fireEvent.click(screen.getByRole('button', { name: t.checkNow }));
    await screen.findByText(t.stillPending);
    h.state = { email: 'ada@example.com', verified: true, required: true };
    fireEvent.click(screen.getByRole('button', { name: t.checkNow }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('"use another email" goes back to the form', async () => {
    h.state = { email: 'ada@example.com', verified: false, required: true };
    render(<EmailGate />);
    await screen.findByRole('dialog', { name: t.gateCheckTitle('ada@example.com') });
    fireEvent.click(screen.getByRole('button', { name: t.gateChange }));
    await screen.findByRole('dialog', { name: t.gateAddTitle });
  });

  it('the preview shows the form and writes nothing', async () => {
    window.history.replaceState(null, '', '/?emailgatepreview=1');
    render(<EmailGate />);
    await screen.findByRole('dialog', { name: t.gateAddTitle });
    fireEvent.change(field('email'), { target: { value: 'ada@example.com' } });
    fireEvent.change(field('password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: t.gateAddAction }));
    expect(h.attach).not.toHaveBeenCalled();
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('does not cover the public legal pages', async () => {
    window.location.hash = '#/privacy';
    render(<EmailGate />);
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
