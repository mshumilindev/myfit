import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixturesClientPort } from './__fixtures__/fixtures';
import { createClientStore } from './store';
import { ClientPortError } from './types';
import type { ClientCoachPort } from './port';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('client store', () => {
  it('has a snapshot at once and follows the port', () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    const store = createClientStore(port);
    store.retain();
    expect(store.getState().status).toBe('ready');
    store.release();
  });

  it('setLevel is optimistic and rolls back when the port fails', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    const store = createClientStore(port);
    store.retain();
    const before = store.getState().snapshot!.link.grants.sleep;
    const next = before === 'full' ? 'off' : 'full';
    const ok = store.setLevel('sleep', next);
    expect(store.getState().snapshot!.link.grants.sleep).toBe(next);
    await expect(ok).resolves.toBe(true);

    port.setLevel = () => Promise.reject(new ClientPortError('offline'));
    await expect(store.setLevel('sleep', before)).resolves.toBe(false);
    expect(store.getState().snapshot!.link.grants.sleep).toBe(next);
    expect(store.getState().failure).toBe('save');
    store.clearFailure();
    expect(store.getState().failure).toBeNull();
    store.release();
  });

  it('revoke opens an 8 s Undo window, undo restores the grants, the window closes by itself', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    const store = createClientStore(port);
    store.retain();
    const grants = store.getState().snapshot!.link.grants;
    await store.revoke();
    expect(port.state().link.state).toBe('revoked');
    expect(store.getState().undo).not.toBeNull();
    await store.undoRevoke();
    expect(port.state().link.state).toBe('active');
    expect(port.state().link.grants).toEqual(grants);
    expect(store.getState().undo).toBeNull();

    await store.revoke();
    vi.advanceTimersByTime(8100);
    expect(store.getState().undo).toBeNull();
    expect(port.state().link.state).toBe('revoked');
    store.release();
  });

  it('a failing revoke or leave says so and changes nothing', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    const store = createClientStore(port);
    port.revoke = () => Promise.reject(new ClientPortError('offline'));
    port.leave = () => Promise.reject(new ClientPortError('offline'));
    await expect(store.revoke()).resolves.toBe(false);
    expect(store.getState().failure).toBe('revoke');
    await expect(store.leave()).resolves.toBe(false);
    expect(store.getState().failure).toBe('leave');
    expect(port.state().link.state).toBe('active');
  });
});

describe('fixtures port', () => {
  it('accept writes grants and waits for the trainer app; declined and expired invites throw', async () => {
    const port = createFixturesClientPort();
    expect(port.state().link.state).toBe('none');
    await expect(port.acceptInvite('expired1', port.state().link.grants)).rejects.toBeInstanceOf(
      ClientPortError,
    );
    expect(port.state().link.state).toBe('none');
    await port.acceptInvite('ok1', { ...port.state().link.grants, sleep: 'effects' });
    expect(port.state().link.state).toBe('waiting');
    expect(port.state().link.grants.sleep).toBe('effects');
    port.turnSharingOn();
    expect(port.state().link.state).toBe('active');
    expect(port.state().program).not.toBeNull();
  });
  it('offline fails every call', async () => {
    const port = createFixturesClientPort({ fail: 'offline' });
    await expect(port.getInvite('x')).rejects.toBeInstanceOf(ClientPortError);
    await expect(port.accessLog()).rejects.toBeInstanceOf(ClientPortError);
  });
});

describe('first load is bounded', () => {
  it('no snapshot in time -> error / timeout (never an endless loading); a failing listener carries its class', async () => {
    vi.useFakeTimers();
    const port = {
      peek: () => null,
      subscribe: vi.fn(() => () => undefined),
    } as unknown as ClientCoachPort;
    const s = createClientStore(port, 8000, 100);
    s.retain();
    expect(s.getState().status).toBe('loading');
    await vi.advanceTimersByTimeAsync(150);
    expect(s.getState()).toMatchObject({ status: 'error', problem: 'timeout' });
    vi.useRealTimers();
    let fail: (e: unknown) => void = () => undefined;
    const port2 = {
      peek: () => null,
      subscribe: (_on: unknown, onError: (e: unknown) => void) => {
        fail = onError;
        return () => undefined;
      },
    } as unknown as ClientCoachPort;
    const s2 = createClientStore(port2);
    s2.retain();
    fail({ status: 403 });
    expect(s2.getState()).toMatchObject({ status: 'error', problem: 'denied' });
  });
});
