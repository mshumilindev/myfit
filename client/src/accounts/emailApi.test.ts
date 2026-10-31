import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  callFn: vi.fn(),
  user: { reload: vi.fn(), getIdToken: vi.fn() } as Record<string, unknown> | null,
}));

vi.mock('../api', () => {
  class HttpError extends Error {
    constructor(
      public status: number,
      message: string,
      public details?: unknown,
    ) {
      super(message);
    }
  }
  return { callFn: h.callFn, HttpError };
});
vi.mock('../i18n', () => ({ getLocale: () => 'uk' }));
vi.mock('../firebase', () => ({
  auth: {
    get currentUser() {
      return h.user;
    },
  },
}));

import { HttpError } from '../api';
import { attachEmail, emailErrorKind, refreshEmailState, sendConfirmation } from './emailApi';

beforeEach(() => {
  vi.resetAllMocks();
  h.user = {
    reload: vi.fn().mockResolvedValue(undefined),
    getIdToken: vi.fn().mockResolvedValue('t'),
  };
});

describe('emailErrorKind', () => {
  it.each([
    [new HttpError(503, 'offline'), 'offline'],
    [new HttpError(429, 'x'), 'tooMany'],
    [new HttpError(401, 'x'), 'signedOut'],
    [new HttpError(403, 'Wrong password.'), 'password'],
    [new HttpError(409, 'x', { reason: 'taken' }), 'taken'],
    [new HttpError(400, 'x', { reason: 'invalid' }), 'invalid'],
    [new HttpError(500, 'x'), 'generic'],
    [new Error('boom'), 'generic'],
  ])('%#', (err, kind) => {
    expect(emailErrorKind(err)).toBe(kind);
  });
});

describe('attachEmail', () => {
  it('sends email and password to the callable', async () => {
    h.callFn.mockResolvedValue({ email: 'a@b.co', verified: false });
    await expect(attachEmail('a@b.co', 'pw')).resolves.toEqual({
      email: 'a@b.co',
      verified: false,
    });
    expect(h.callFn).toHaveBeenCalledWith('attachEmail', { email: 'a@b.co', password: 'pw' });
  });
});

describe('sendConfirmation', () => {
  it('asks the server to send the letter in the current locale', async () => {
    h.callFn.mockResolvedValue({ sent: true });
    await sendConfirmation();
    expect(h.callFn).toHaveBeenCalledWith('sendConfirmationMail', { locale: 'uk' });
  });
  it('refuses when signed out, without calling the server', async () => {
    h.user = null;
    await expect(sendConfirmation()).rejects.toMatchObject({ status: 401 });
    expect(h.callFn).not.toHaveBeenCalled();
  });
  it('passes the server error through for the UI mapping', async () => {
    h.callFn.mockRejectedValue(new HttpError(429, 'x'));
    await expect(sendConfirmation()).rejects.toMatchObject({ status: 429 });
  });
});

describe('refreshEmailState', () => {
  it('renews the token once the email is confirmed', async () => {
    h.callFn.mockResolvedValue({ email: 'a@b.co', verified: true });
    await refreshEmailState();
    expect((h.user as { getIdToken: (f: boolean) => void }).getIdToken).toHaveBeenCalledWith(true);
  });
  it('leaves the token alone while unconfirmed', async () => {
    h.callFn.mockResolvedValue({ email: 'a@b.co', verified: false });
    await refreshEmailState();
    expect((h.user as { getIdToken: () => void }).getIdToken).not.toHaveBeenCalled();
  });
});
