import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { configureCoachData } from './config';
import { createFixturesPort } from './__fixtures__/fixtures';
import { useCoachUnread, useCoachUnreadState } from './useCoachUnread';
import { useCoachWorld } from './useCoachWorld';
import type { ConversationUnreadDoc, ConversationsPort } from './unreadStore';

afterEach(() => configureCoachData());

describe('useCoachWorld', () => {
  it('renders at once (loading, no blocking), then ready; actions update the same world', async () => {
    const port = createFixturesPort({ delayMs: 20 });
    const { result } = renderHook(() => useCoachWorld(port, { refreshEveryMs: 0 }));
    expect(result.current.loading).toBe(true);
    expect(result.current.world).toBeNull();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.loading).toBe(false);
    expect(result.current.world?.counts.needDecision).toBe(2);
    const stall = result.current.world!.signals.find((s) => s.signal.kind === 'stall')!.signal;
    let id = '';
    act(() => {
      id = result.current.dismiss(stall, 'not-useful');
    });
    expect(id).toMatch(/.+/);
    expect(result.current.world?.counts.needDecision).toBe(1);
    expect(result.current.world?.decisions[0]).toMatchObject({
      kind: 'dismiss',
      reason: 'not-useful',
    });
  });

  it('error without data exposes retry', async () => {
    let fail = true;
    const port = createFixturesPort({ failWith: () => (fail ? 'unavailable' : null) });
    const { result } = renderHook(() => useCoachWorld(port, { refreshEveryMs: 0 }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    fail = false;
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });
});

function convPort(initial: ConversationUnreadDoc[] = []) {
  let push: (d: ConversationUnreadDoc[]) => void = () => undefined;
  const p: ConversationsPort = {
    subscribe: (_u, ok) => {
      push = ok;
      ok(initial);
      return () => undefined;
    },
  };
  return { p, push: (d: ConversationUnreadDoc[]) => push(d) };
}
const d = (clientId: string, n: number): ConversationUnreadDoc => ({
  cid: clientId,
  clientId,
  trainerId: 't1',
  active: true,
  unread: { t1: n },
});

describe('useCoachUnread (single source)', () => {
  it('reads the conversation unread map; the same store feeds every badge', async () => {
    const c = convPort([d('c1', 3), d('c2', 12), d('c3', 1)]);
    configureCoachData({ conversations: c.p });
    const a = renderHook(() => useCoachUnreadState({ uid: 't1' }));
    const b = renderHook(() => useCoachUnreadState({ uid: 't1' }));
    await waitFor(() => expect(a.result.current.total).toBe(16));
    expect(b.result.current).toBe(a.result.current);
    expect(a.result.current.byClient).toEqual({ c1: 3, c2: 12, c3: 1 });
    act(() => c.push([d('c1', 0), d('c2', 12), d('c3', 1)]));
    await waitFor(() => expect(a.result.current.total).toBe(13));
    expect(b.result.current.total).toBe(13);
    a.unmount();
    b.unmount();
  });

  it('signed out: 0, no subscription', () => {
    const c = convPort([d('c1', 3)]);
    const r = renderHook(() => useCoachUnreadState({ uid: null, port: c.p }));
    expect(r.result.current.total).toBe(0);
    expect(typeof useCoachUnread).toBe('function');
  });
});
