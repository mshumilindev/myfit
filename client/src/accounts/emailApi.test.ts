import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  callFn: vi.fn(),
  send: vi.fn(),
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
vi.mock('../firebase', () => ({
  auth: {
    get currentUser() {
      return h.user;
    },
  },
}));
vi.mock('firebase/auth', () => ({ sendEmailVerification: h.send }));

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
  it('reloads the user and sends the letter', async () => {
    h.send.mockResolvedValue(undefined);
    await sendConfirmation();
    expect((h.user as { reload: () => void }).reload).toHaveBeenCalled();
    expect(h.send).toHaveBeenCalledWith(h.user);
  });
  it('refuses when signed out', async () => {
    h.user = null;
    await expect(sendConfirmation()).rejects.toMatchObject({ status: 401 });
  });
  it.each([
    ['auth/too-many-requests', 429],
    ['auth/network-request-failed', 503],
    ['auth/other', 500],
  ])('maps %s to %i', async (code, status) => {
    h.send.mockRejectedValue({ code });
    await expect(sendConfirmation()).rejects.toMatchObject({ status });
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
