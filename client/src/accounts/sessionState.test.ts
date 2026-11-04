import { describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({
  handlers: [] as { next: (s: unknown) => void; err: () => void }[],
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  onSnapshot: (_ref: unknown, next: (s: unknown) => void, err: () => void) => {
    fs.handlers.push({ next, err });
    return () => undefined;
  },
}));
vi.mock('../firebase', () => ({ db: {} }));

import { watchRevokedFlag } from './sessionState';

const snap = (data: Record<string, unknown> | null) => ({
  exists: () => data !== null,
  data: () => data,
});

describe('watchRevokedFlag', () => {
  it('ends this device once, when its flag appears', () => {
    const onRevoked = vi.fn();
    watchRevokedFlag('u1', 'dev-00000001', onRevoked);
    const h = fs.handlers.at(-1)!;
    h.next(snap(null));
    expect(onRevoked).not.toHaveBeenCalled();
    h.next(snap({ revokedAt: 1700000000000 }));
    h.next(snap({ revokedAt: 1700000000001 }));
    expect(onRevoked).toHaveBeenCalledTimes(1);
  });
  it('a document without the flag, or a listener error, does nothing', () => {
    const onRevoked = vi.fn();
    watchRevokedFlag('u1', 'dev-00000001', onRevoked);
    const h = fs.handlers.at(-1)!;
    h.next(snap({}));
    h.err();
    expect(onRevoked).not.toHaveBeenCalled();
  });
});
