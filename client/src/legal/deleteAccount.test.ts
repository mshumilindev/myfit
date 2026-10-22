import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../api';
import { createDeleteAccountPort, DELETE_ACCOUNT_TIMEOUT_MS } from './deleteAccount';

const port = (impl: (...a: unknown[]) => unknown) =>
  createDeleteAccountPort(vi.fn(impl) as unknown as Parameters<typeof createDeleteAccountPort>[0]);

describe('delete account port', () => {
  it('sends the password with confirm and the long timeout, never the identifier', async () => {
    const call = vi.fn().mockResolvedValue({ ok: true });
    const p = createDeleteAccountPort(call as never);
    expect(p.knowsIdentifier()).toBe(true);
    expect(await p.check({ password: 'pw', identifier: 'someone-else' })).toBe('ok');
    expect(call).toHaveBeenCalledWith(
      'deleteMyAccount',
      { password: 'pw', confirm: true },
      { timeoutMs: DELETE_ACCOUNT_TIMEOUT_MS },
    );
  });

  it('an empty password never reaches the server', async () => {
    const call = vi.fn();
    expect(await createDeleteAccountPort(call as never).check({ password: '' })).toBe('wrong');
    expect(call).not.toHaveBeenCalled();
  });

  it('maps the server answers', async () => {
    const answer = (status: number) =>
      port(() => Promise.reject(new HttpError(status, 'x'))).check({ password: 'pw' });
    expect(await answer(403)).toBe('wrong');
    expect(await answer(429)).toBe('locked');
    expect(await answer(503)).toBe('offline');
    expect(await answer(0)).toBe('offline');
    expect(await answer(500)).toBe('error');
    expect(await answer(400)).toBe('error'); // e.g. the last admin: nothing is deleted
    expect(await answer(401)).toBe('error'); // a session that was never used for a deletion
  });

  it('a lost answer then a dead session: the account counts as gone only when the server says so', async () => {
    const run = async (probe: () => Promise<unknown>) => {
      const call = vi.fn(async (name: string) => {
        if (name === 'sessionCheck') return probe();
        if (call.mock.calls.filter((c) => c[0] === 'deleteMyAccount').length === 1)
          throw new HttpError(504, 'timeout');
        throw new HttpError(401, 'unauthenticated');
      });
      const p = createDeleteAccountPort(call as never);
      expect(await p.check({ password: 'pw' })).toBe('error'); // the 504 itself
      return p.check({ password: 'pw' });
    };
    const gone = () => Promise.reject(new HttpError(404, 'x', { reason: 'account-gone' }));
    expect(await run(gone)).toBe('ok');
    // any other answer to the probe leaves the device alone
    expect(await run(() => Promise.resolve({ active: true }))).toBe('error');
    expect(await run(() => Promise.reject(new HttpError(401, 'unauthenticated')))).toBe('error');
    expect(await run(() => Promise.reject(new HttpError(404, 'function not found')))).toBe('error');
    expect(await run(() => Promise.reject(new HttpError(503, 'unavailable')))).toBe('error');
  });

  it('a wrong password (403) then a dead session (401) is NOT a deletion: error, no probe, no wipe', async () => {
    const call = vi
      .fn()
      .mockRejectedValueOnce(new HttpError(403, 'bad-password'))
      .mockRejectedValueOnce(new HttpError(401, 'unauthenticated'));
    const p = createDeleteAccountPort(call as never);
    expect(await p.check({ password: 'nope' })).toBe('wrong');
    expect(await p.check({ password: 'pw' })).toBe('error');
    expect(call.mock.calls.map((c) => c[0])).toEqual(['deleteMyAccount', 'deleteMyAccount']);
  });

  it('429 and offline-before-send never count as a possibly applied attempt', async () => {
    for (const first of [new HttpError(429, 'x'), new HttpError(503, 'offline')]) {
      const call = vi
        .fn()
        .mockRejectedValueOnce(first)
        .mockRejectedValueOnce(new HttpError(401, 'unauthenticated'));
      const p = createDeleteAccountPort(call as never);
      await p.check({ password: 'pw' });
      expect(await p.check({ password: 'pw' })).toBe('error');
      expect(call).toHaveBeenCalledTimes(2); // no probe
    }
  });

  it('a server error or a network error mid-call counts as possibly applied (the probe runs)', async () => {
    for (const first of [new HttpError(500, 'x'), new HttpError(0, 'network'), new Error('boom')]) {
      const call = vi.fn(async (name: string) => {
        if (name === 'sessionCheck') throw new HttpError(404, 'gone', { reason: 'account-gone' });
        if (call.mock.calls.filter((c) => c[0] === 'deleteMyAccount').length === 1) throw first;
        throw new HttpError(401, 'unauthenticated');
      });
      const p = createDeleteAccountPort(call as never);
      await p.check({ password: 'pw' });
      expect(await p.check({ password: 'pw' })).toBe('ok');
    }
  });
});
