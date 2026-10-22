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

  it('a snapshot that lands later (it waits for the vault key) is shown at once, unless the live answer was first', async () => {
    const base = createFixturesClientPort({ scenario: 'active' });
    const snap = base.state();
    let held: typeof snap | null = null;
    let release: () => void = () => undefined;
    let live: (s: typeof snap) => void = () => undefined;
    const port: ClientCoachPort = {
      ...base,
      peek: () => held,
      hydrate: () =>
        new Promise<void>((r) => {
          release = () => {
            held = snap;
            r();
          };
        }),
      subscribe: (on) => {
        live = on;
        return () => undefined;
      },
    };
    const store = createClientStore(port);
    store.retain();
    expect(store.getState()).toMatchObject({ status: 'loading', snapshot: null });
    release();
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getState()).toMatchObject({ status: 'ready' });
    expect(store.getState().snapshot).toBe(snap);
    store.release();

    // live first: the late snapshot never replaces it
    const fresh = { ...snap, asOf: snap.asOf + 1 };
    held = null;
    const store2 = createClientStore(port);
    store2.retain();
    live(fresh);
    release();
    await Promise.resolve();
    await Promise.resolve();
    expect(store2.getState().snapshot).toBe(fresh);
    store2.release();
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

  it('the Undo window survives the last screen releasing the store, and still closes by itself', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    const store = createClientStore(port);
    store.retain();
    await store.revoke();
    store.release(); // the Stop screen unmounts inside the window
    expect(store.getState().undo).not.toBeNull();
    store.retain(); // and mounts again
    await store.undoRevoke();
    expect(port.state().link.state).toBe('active');
    await store.revoke();
    store.release();
    vi.advanceTimersByTime(8100);
    expect(store.getState().undo).toBeNull();
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

describe('durable revoke and Undo guards (B4, B5)', () => {
  const rec = () => ({ pending: vi.fn(), settled: vi.fn(), cancel: vi.fn() });

  it('the revoke is recorded before it is sent, settled on success only, and Retry (revoke again) can finish it', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    const r = rec();
    const order: string[] = [];
    r.pending.mockImplementation(() => order.push('pending'));
    const real = port.revoke.bind(port);
    port.revoke = () => {
      order.push('send');
      return Promise.reject(new ClientPortError('offline'));
    };
    const store = createClientStore(port, undefined, undefined, { revokeRecord: r });
    store.retain();
    await expect(store.revoke()).resolves.toBe(false);
    expect(order).toEqual(['pending', 'send']);
    expect(r.settled).not.toHaveBeenCalled();
    expect(store.getState().failure).toBe('revoke');
    port.revoke = real;
    await expect(store.revoke()).resolves.toBe(true); // what the Snackbar's Retry runs
    expect(r.settled).toHaveBeenCalledTimes(1);
    expect(port.state().link.state).toBe('revoked');
    store.release();
  });

  it('a newer level choice and Undo cancel a waiting revoke', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    const r = rec();
    const store = createClientStore(port, undefined, undefined, { revokeRecord: r });
    store.retain();
    await store.setLevel('sleep', 'effects');
    expect(r.cancel).toHaveBeenCalledTimes(1);
    await store.revoke();
    await store.undoRevoke();
    expect(r.cancel).toHaveBeenCalledTimes(2);
    store.release();
  });

  it('Undo keeps injury and nutrition off when their consent is off now, and leaves grants changed meanwhile alone', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    const store = createClientStore(port, undefined, undefined, {
      grantAllowed: (c) => c !== 'injury' && c !== 'nutrition',
    });
    store.retain();
    const before = port.state().link.grants;
    await store.revoke();
    await store.setLevel('sleep', 'effects'); // the person changed one grant inside the window
    const restore = vi.spyOn(port, 'restore');
    await store.undoRevoke();
    const sent = restore.mock.calls[0][0];
    expect(sent.injury).toBe('off');
    expect(sent.nutrition).toBe('off');
    expect(sent.sleep).toBe('effects');
    expect(sent.totals).toBe(before.totals);
    store.release();
  });
});
