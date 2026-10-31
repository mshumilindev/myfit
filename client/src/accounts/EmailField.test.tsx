import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  state: { email: null, verified: false } as { email: string | null; verified: boolean },
  attach: vi.fn(),
  send: vi.fn(),
  refresh: vi.fn(),
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

import { HttpError } from '../api';
import { EmailField } from './EmailField';
import { EMAIL_AUTH_LOCALES } from '../i18n/emailAuth';

const t = EMAIL_AUTH_LOCALES.en;

beforeEach(() => {
  h.state = { email: null, verified: false };
  h.refresh.mockReset().mockImplementation(async () => h.state);
  h.attach.mockReset();
  h.send.mockReset().mockResolvedValue(undefined);
});
afterEach(() => cleanup());

// The kit Field is a <label> that also holds its hint, so inputs are found by type, not by label text.
const input = (label: string): HTMLInputElement =>
  document.querySelector(
    label === t.passwordLabel ? 'input[type=password]' : 'input[type=email]',
  ) as HTMLInputElement;
const type = (label: string, value: string) =>
  fireEvent.change(input(label), { target: { value } });

describe('EmailField', () => {
  it('no email: type, ask for the password, link and send the letter', async () => {
    h.attach.mockResolvedValue({ email: 'ada@example.com', verified: false });
    render(<EmailField />);
    await screen.findByText(t.hintNone);
    expect(document.querySelector('input[type=password]')).toBeNull();
    type(t.fieldLabel, 'ada@example.com');
    const save = screen.getByRole('button', { name: t.save });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    type(t.passwordLabel, 'pw');
    expect((save as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(save);
    await screen.findByText(t.resendSent);
    expect(h.attach).toHaveBeenCalledWith('ada@example.com', 'pw');
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(screen.getByText(t.statusPending)).toBeTruthy();
  });

  it('not confirmed: resend, and "I confirmed" while still unconfirmed', async () => {
    h.state = { email: 'ada@example.com', verified: false };
    render(<EmailField />);
    await screen.findByText(t.hintPending('ada@example.com'));
    fireEvent.click(screen.getByRole('button', { name: t.resend }));
    await screen.findByText(t.resendSent);
    fireEvent.click(screen.getByRole('button', { name: t.checkNow }));
    await screen.findByText(t.stillPending);
  });

  it('confirmed: shows the tag; Change opens the edit with a password', async () => {
    h.state = { email: 'ada@example.com', verified: true };
    render(<EmailField />);
    await screen.findByText(t.statusVerified);
    expect(screen.queryByRole('button', { name: t.resend })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t.change }));
    type(t.fieldLabel, 'new@example.com');
    expect(document.querySelector('input[type=password]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t.cancel }));
    expect(document.querySelector('input[type=password]')).toBeNull();
  });

  it('maps server refusals to localized text', async () => {
    h.attach.mockRejectedValue(new HttpError(409, 'x', { reason: 'taken' }));
    render(<EmailField />);
    await screen.findByText(t.hintNone);
    type(t.fieldLabel, 'ada@example.com');
    type(t.passwordLabel, 'pw');
    fireEvent.click(screen.getByRole('button', { name: t.save }));
    await screen.findByText(t.errors.taken);
    expect(h.send).not.toHaveBeenCalled();
  });

  it('shows a load failure (offline) instead of hanging', async () => {
    h.refresh.mockRejectedValue(new HttpError(503, 'offline'));
    render(<EmailField />);
    await waitFor(() => expect(screen.getByText(t.errors.offline)).toBeTruthy());
  });
});
