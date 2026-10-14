import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { conversationsFromChat } from './chat/chatStore';
import { createFixturesChatPort } from './chat/__fixtures__/fixtures';
import { sumUnread, useCoachUnreadState } from './unread';

describe('coach unread (single source)', () => {
  it('sums per-client counts, ignoring junk', () => {
    expect(sumUnread({})).toBe(0);
    expect(sumUnread({ a: 3, b: 0, c: 20 })).toBe(23);
    expect(sumUnread({ a: -4, b: Number.NaN, c: 2.9 })).toBe(2);
  });

  it('is the sum of the chat conversations (no second counter): 3 + 12 + 1 = 16', async () => {
    const port = createFixturesChatPort();
    const { result } = renderHook(() =>
      useCoachUnreadState({ port: conversationsFromChat(port), uid: 'trainer' }),
    );
    await waitFor(() => expect(result.current.total).toBe(16));
    expect(result.current.byClient).toEqual({ c1: 3, c2: 12, c3: 1 });
  });

  it('shows nothing until signed in (no uid, no badge)', () => {
    const { result } = renderHook(() =>
      useCoachUnreadState({ port: conversationsFromChat(createFixturesChatPort()), uid: null }),
    );
    expect(result.current.total).toBe(0);
  });
});
