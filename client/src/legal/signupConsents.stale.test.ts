/** SPO-533: a `400 stale-version` on a queued consent asks for the newest build (once), and is still dropped like any permanent refusal. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ grant: vi.fn(), refresh: vi.fn() }));
vi.mock('../api', () => ({
  currentUid: () => 'u1',
  registerSignOutFlush: () => undefined,
  HttpError: class HttpError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock('./consentApi', () => ({ grantConsent: h.grant, withdrawConsent: vi.fn() }));
vi.mock('./staleVersion', async () => {
  const actual = await vi.importActual<typeof import('./staleVersion')>('./staleVersion');
  return { ...actual, refreshBuildOnStale: h.refresh };
});

import { CONSENT_QUEUE_KEY, enqueueConsents, flushPendingConsents } from './signupConsents';

const queued = () => JSON.parse(localStorage.getItem(CONSENT_QUEUE_KEY) ?? '[]');
const err = (status: number, message: string) => Object.assign(new Error(message), { status });

beforeEach(() => {
  localStorage.clear();
  h.grant.mockReset();
  h.refresh.mockReset();
  h.refresh.mockResolvedValue('current');
});

describe('stale-version on a queued grant', () => {
  it('looks for the newest build and still drops the refused item (the gate asks again with current versions)', async () => {
    h.grant.mockRejectedValue(err(400, 'stale-version'));
    enqueueConsents('u1', [{ kind: 'policy-ack', version: '2026-11-05' }]);
    await flushPendingConsents();
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(queued()).toEqual([]);
  });

  it('does not look for a build on other refusals', async () => {
    h.grant.mockRejectedValue(err(400, 'bad-textHash'));
    enqueueConsents('u1', [{ kind: 'policy-ack', version: '2026-11-05' }]);
    await flushPendingConsents();
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('does not look for a build when offline or busy (the item stays queued)', async () => {
    h.grant.mockRejectedValue(err(503, 'unavailable'));
    enqueueConsents('u1', [{ kind: 'policy-ack', version: '2026-11-05' }]);
    await flushPendingConsents();
    expect(h.refresh).not.toHaveBeenCalled();
    expect(queued()[0].items).toHaveLength(1);
  });
});
