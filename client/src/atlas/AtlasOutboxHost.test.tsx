// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreState } from '../store';

const sync = vi.fn<(m: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
const plan = vi.fn<(a: { atlasOn: boolean }) => unknown[]>().mockReturnValue([{ id: 'm1' }]);
vi.mock('./schedule', () => ({ syncOutbox: (m: unknown[]) => sync(m) }));
vi.mock('./outboxPlan', () => ({ planAtlasMessages: (a: { atlasOn: boolean }) => plan(a) }));
vi.mock('./notes', () => ({
  useAtlasNotes: () => ({ temper: 'warm' }),
  useAtlasFmt: () => ({}),
}));
const push = vi.fn(() => 'on');
vi.mock('../push', () => ({ pushState: () => push() }));

import { AtlasOutboxHost } from './AtlasOutboxHost';
import { AtlasOutboxLazy } from './AtlasOutboxLazy';

const props = {
  authed: true,
  store: {} as StoreState,
  locale: 'en' as const,
  t: { atlasName: 'Atlas', atlasPushReview: 'Review' },
};

beforeEach(() => {
  vi.useFakeTimers();
  sync.mockClear();
  plan.mockClear();
  push.mockReturnValue('on');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AtlasOutboxHost', () => {
  it('plans Atlas pushes with Atlas on and sends them to the outbox after a moment', async () => {
    render(<AtlasOutboxHost {...props} />);
    expect(sync).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(plan.mock.calls[0]![0].atlasOn).toBe(true);
    expect(sync).toHaveBeenCalledWith([{ id: 'm1' }]);
  });
  it('plans nothing when signed out or push is off', async () => {
    render(<AtlasOutboxHost {...props} authed={false} />);
    push.mockReturnValue('off');
    render(<AtlasOutboxHost {...props} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(sync).not.toHaveBeenCalled();
  });
  it('the lazy wrapper loads and mounts the host', async () => {
    vi.useRealTimers();
    render(<AtlasOutboxLazy {...props} authed={false} />);
    // the host renders nothing; the wrapper must not throw or leave a fallback behind
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.queryByText(/./)).toBeNull();
  });
});
