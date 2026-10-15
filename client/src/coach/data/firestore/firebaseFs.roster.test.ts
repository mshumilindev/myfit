import { beforeEach, describe, expect, it, vi } from 'vitest';

const callFn = vi.fn();
vi.mock('../../../api', () => ({ callFn: (...a: unknown[]) => callFn(...a) }));
vi.mock('../../../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({}));

import { createFirebaseFs } from './firebaseFs';

describe('the shared roster call', () => {
  beforeEach(() => {
    callFn.mockReset();
    callFn.mockResolvedValue({ clients: [] });
  });

  it('answers callers that ask at the same time with one request', async () => {
    const fs = createFirebaseFs();
    await Promise.all([
      fs.call('coachClients', {}),
      fs.call('coachClients', {}),
      fs.call('coachClients', {}),
    ]);
    expect(callFn).toHaveBeenCalledTimes(1);
  });

  it('reuses the answer for a moment, then asks again', async () => {
    vi.useFakeTimers();
    const fs = createFirebaseFs();
    await fs.call('coachClients', {});
    await fs.call('coachClients', {});
    expect(callFn).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 6000);
    await fs.call('coachClients', {});
    expect(callFn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('forgets the answer after something that changes the roster', async () => {
    const fs = createFirebaseFs();
    await fs.call('coachClients', {});
    await fs.call('coachInvite', { name: 'x' });
    await fs.call('coachClients', {});
    expect(callFn).toHaveBeenCalledTimes(3);
  });

  it('does not keep a failed answer', async () => {
    const fs = createFirebaseFs();
    callFn.mockRejectedValueOnce(new Error('boom'));
    await expect(fs.call('coachClients', {})).rejects.toThrow('boom');
    await fs.call('coachClients', {});
    expect(callFn).toHaveBeenCalledTimes(2);
  });
});
