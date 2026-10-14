import { renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCoachBackendStatus } from './backend';
import { setCoachBackendMode } from '../__fixtures__/register';
import { configureCoachData, getChatPort, getWorldPort } from './config';
import { configureClientCoach, getClientChatPort, getClientPort } from '../client/data/config';

vi.mock('./firestore/bootstrap', () => ({
  acquireBackend: vi.fn(async () => {
    throw new Error('install failed');
  }),
}));

afterEach(() => {
  window.localStorage.removeItem('spotter.clientCoach');
  setCoachBackendMode(null);
  configureCoachData();
  configureClientCoach();
});

describe('real backend selected: never silently the sample data', () => {
  it('the default ports are "unavailable", not the fixtures (world, chat, client link, client chat)', async () => {
    setCoachBackendMode('firestore');
    expect(getWorldPort().peek()).toBeNull();
    await expect(
      getWorldPort().load({ signal: new AbortController().signal }),
    ).rejects.toMatchObject({
      code: 'unavailable',
    });
    const onErr = vi.fn();
    getChatPort().subscribeThreads('t', vi.fn(), onErr);
    await waitFor(() => expect(onErr).toHaveBeenCalled());
    expect(getClientPort().peek()).toBeNull();
    const clientErr = vi.fn();
    const on = vi.fn();
    getClientPort().subscribe(on, clientErr);
    await waitFor(() => expect(clientErr).toHaveBeenCalled());
    expect(on).not.toHaveBeenCalled(); // no demo trainer is ever delivered
    await expect(getClientPort().leave()).rejects.toMatchObject({ code: 'unavailable' });
    const chatErr = vi.fn();
    getClientChatPort().subscribe('cid', vi.fn(), chatErr);
    await waitFor(() => expect(chatErr).toHaveBeenCalled());
  });

  it('fixtures mode still serves the demo world (explicit demo build, Storybook)', async () => {
    setCoachBackendMode('fixtures');
    window.localStorage.setItem('spotter.clientCoach', 'active');
    const snap = await new Promise<{ link: { state: string } }>((res) => {
      getClientPort().subscribe(res as never, () => undefined);
    });
    expect(snap.link.state).not.toBe('none');
  });

  it('a backend that fails to install is "failed" (error with Retry), never "ready" on the sample ports', async () => {
    setCoachBackendMode('firestore');
    const { result } = renderHook(() =>
      useCoachBackendStatus('client', true, { id: 'u1', name: '' }),
    );
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('failed'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('failed'));
  });

  it('without the real backend the status is ready at once and nothing loads', () => {
    setCoachBackendMode('fixtures');
    const { result } = renderHook(() =>
      useCoachBackendStatus('client', true, { id: 'u1', name: '' }),
    );
    expect(result.current.status).toBe('ready');
  });
});
