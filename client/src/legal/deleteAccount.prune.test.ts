import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ uid: 'u1' as string | null }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  currentUid: () => h.uid,
}));

import { HttpError } from '../api';
import { createDeleteAccountPort } from './deleteAccount';
import { localOffKinds, markLocalOff } from './localOff';
import { CONSENT_QUEUE_KEY, enqueueConsents } from './signupConsents';

const GEO = { kind: 'geo-search', action: 'withdraw', version: 'v1' } as const;

beforeEach(() => {
  localStorage.clear();
  h.uid = 'u1';
  enqueueConsents('u1', [GEO]);
  enqueueConsents('u2', [GEO]);
  markLocalOff('u1', 'geo-search');
  markLocalOff('u2', 'geo-search');
});

const queuedUids = () =>
  (JSON.parse(localStorage.getItem(CONSENT_QUEUE_KEY) ?? '[]') as { uid: string }[]).map(
    (x) => x.uid,
  );

describe("delete account prunes the account's device-level consent data", () => {
  it('after a successful deletion: its queue and local-off flags go, other accounts keep theirs', async () => {
    const call = vi.fn().mockResolvedValue({ ok: true });
    expect(await createDeleteAccountPort(call as never).check({ password: 'pw' })).toBe('ok');
    expect(queuedUids()).toEqual(['u2']);
    expect(localOffKinds('u1')).toEqual([]);
    expect(localOffKinds('u2')).toEqual(['geo-search']);
  });

  it('a failed deletion (wrong password) prunes nothing', async () => {
    const call = vi.fn().mockRejectedValue(new HttpError(403, 'bad-password'));
    expect(await createDeleteAccountPort(call as never).check({ password: 'pw' })).toBe('wrong');
    expect(queuedUids()).toEqual(['u1', 'u2']);
    expect(localOffKinds('u1')).toEqual(['geo-search']);
  });
});
