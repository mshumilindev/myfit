import { describe, expect, it } from 'vitest';
import {
  createUnavailableChatPort,
  createUnavailableClientChatPort,
  createUnavailableClientPort,
  createUnavailableLivePort,
  createUnavailableNotesPort,
  createUnavailableProgramPort,
  createUnavailableSchedulePort,
  createUnavailableSharePort,
  createUnavailableWorldPort,
} from './unavailable';
import { PortError } from './port';
import { ClientPortError } from '../client/data/types';
import { SchedulePortError } from '../schedule/port';
import { ProgramPortError } from '../program/types';

type AnyFn = (...a: never[]) => unknown;

/** Every method named in `methods` rejects with `err`'s class and the `unavailable` code. */
async function expectAllReject(port: object, methods: string[], ctor: new (c: never) => Error) {
  for (const m of methods) {
    const p = (port as Record<string, AnyFn>)[m]();
    await expect(p, m).rejects.toBeInstanceOf(ctor);
    await expect(p, m).rejects.toMatchObject({ code: 'unavailable' });
  }
}

/** A subscribe-style method reports the failure asynchronously, never inside the caller's call, and returns a no-op unsubscribe. */
async function expectFailsLater(
  call: (onError: (e: unknown) => void) => () => void,
  ctor: new (c: never) => Error,
) {
  const seen: unknown[] = [];
  const off = call((e) => seen.push(e));
  expect(seen).toEqual([]);
  await Promise.resolve();
  expect(seen).toHaveLength(1);
  expect(seen[0]).toBeInstanceOf(ctor);
  expect((seen[0] as { code: string }).code).toBe('unavailable');
  expect(off()).toBeUndefined();
}

describe('unavailable stand-in ports never invent data', () => {
  it('world: nothing cached, load/save reject unavailable, the clock is real', async () => {
    const w = createUnavailableWorldPort();
    expect(w.peek()).toBeNull();
    await expectAllReject(w, ['load', 'save'], PortError as never);
    expect(Math.abs((w.now?.() ?? 0) - Date.now())).toBeLessThan(1000);
  });

  it('coach chat: every write rejects, both subscriptions fail asynchronously', async () => {
    const c = createUnavailableChatPort();
    await expectAllReject(
      c,
      ['send', 'markRead', 'softDelete', 'undoDelete', 'commitDelete', 'clearChat', 'undoClear'],
      PortError as never,
    );
    await expectFailsLater((e) => c.subscribeThreads('t', () => undefined, e), PortError as never);
    await expectFailsLater(
      (e) => c.subscribeMessages('cid', () => undefined, e),
      PortError as never,
    );
    expect(Math.abs(c.now() - Date.now())).toBeLessThan(1000);
  });

  it('client link: no snapshot, no invite can be read or accepted, nothing can be changed', async () => {
    const c = createUnavailableClientPort();
    expect(c.peek()).toBeNull();
    await expectAllReject(
      c,
      [
        'getInvite',
        'acceptInvite',
        'declineInvite',
        'setLevel',
        'revoke',
        'restore',
        'leave',
        'accessLog',
        'ackProgram',
        'setSelfCoachDays',
      ],
      ClientPortError as never,
    );
    await expectFailsLater((e) => c.subscribe(() => undefined, e), ClientPortError as never);
    expect(Math.abs(c.now() - Date.now())).toBeLessThan(1000);
  });

  it('client chat: writes reject with the client error; the unread feed stays silent and unsubscribes cleanly', async () => {
    const c = createUnavailableClientChatPort();
    await expectAllReject(
      c,
      ['send', 'markRead', 'softDelete', 'undoDelete', 'commitDelete', 'clearChat', 'undoClear'],
      ClientPortError as never,
    );
    await expectFailsLater((e) => c.subscribe('cid', () => undefined, e), ClientPortError as never);
    const seen: number[] = [];
    const off = c.subscribeUnread('cid', (n: number) => seen.push(n));
    await Promise.resolve();
    expect(seen).toEqual([]);
    expect(off()).toBeUndefined();
    expect(Math.abs(c.now() - Date.now())).toBeLessThan(1000);
  });

  it('live, share, program, schedule and notes stand-ins use their own error classes', async () => {
    const live = createUnavailableLivePort();
    await expectFailsLater((e) => live.subscribe('c', () => undefined, e), PortError as never);
    expect(Math.abs(live.now() - Date.now())).toBeLessThan(1000);

    const share = createUnavailableSharePort();
    expect(share.peek('c1')).toBeNull();
    await expectAllReject(share, ['load'], PortError as never);

    const prog = createUnavailableProgramPort();
    expect(prog.peek('c1')).toBeNull();
    expect(prog.library('c1')).toEqual([]);
    await expectAllReject(prog, ['load', 'saveDraft', 'send', 'copyTo'], ProgramPortError as never);

    const sch = createUnavailableSchedulePort();
    expect(sch.peek()).toBeNull();
    await expectAllReject(
      sch,
      ['saveDoc', 'createRequest', 'setStatus'],
      SchedulePortError as never,
    );
    await expectFailsLater((e) => sch.subscribe(() => undefined, e), SchedulePortError as never);
    expect(Math.abs(sch.now() - Date.now())).toBeLessThan(1000);

    const notes = createUnavailableNotesPort();
    await expectAllReject(notes, ['add', 'edit', 'setVis', 'remove'], PortError as never);
    await expectFailsLater((e) => notes.subscribe('c', () => undefined, e), PortError as never);
    expect(Math.abs(notes.now() - Date.now())).toBeLessThan(1000);
  });
});
