import { describe, expect, it } from 'vitest';
import { IDLE, type CallState } from './callMachine';
import { callLogFor, encodeCallLog, parseCallLog } from './callLog';

const ended = (p: Partial<CallState>): CallState => ({
  ...IDLE,
  phase: 'ended',
  role: 'caller',
  kind: 'video',
  ...p,
});

describe('callLogFor', () => {
  it('a call that took place logs its length, whoever hung up', () => {
    const e = callLogFor(ended({ endReason: 'hangup', connectedAt: 1000, endedAt: 73_400 }));
    expect(e).toEqual({ v: 1, k: 'done', video: true, sec: 72 });
  });
  it('declined and no answer', () => {
    expect(callLogFor(ended({ endReason: 'declined' }))?.k).toBe('declined');
    expect(callLogFor(ended({ endReason: 'missed' }))?.k).toBe('noanswer');
  });
  it('a connection that broke after connecting is "dropped"', () => {
    expect(callLogFor(ended({ endReason: 'failed', connectedAt: 1, endedAt: 9001 }))).toMatchObject(
      {
        k: 'dropped',
        sec: 9,
      },
    );
    expect(callLogFor(ended({ endReason: 'failed' }))).toBeNull();
  });
  it.each([
    'unavailable',
    'busy',
    'offline',
    'permission-denied',
    'no-device',
    'disabled',
  ] as const)('%s leaves nothing in the chat', (r) =>
    expect(callLogFor(ended({ endReason: r }))).toBeNull(),
  );
  it('only the caller writes, only an ended call counts', () => {
    expect(callLogFor(ended({ role: 'callee', endReason: 'missed' }))).toBeNull();
    expect(callLogFor({ ...IDLE, phase: 'active', role: 'caller' })).toBeNull();
  });
});

describe('parseCallLog', () => {
  it('round-trips and rejects anything else', () => {
    const e = { v: 1 as const, k: 'done' as const, video: false, sec: 61 };
    expect(parseCallLog(encodeCallLog(e))).toEqual(e);
    for (const bad of [
      undefined,
      '',
      'x',
      '{}',
      '{"v":2}',
      '{"v":1,"k":"zzz","video":true,"sec":1}',
    ]) {
      expect(parseCallLog(bad)).toBeNull();
    }
  });
});
