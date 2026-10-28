import { describe, expect, it } from 'vitest';
import { sweepWithdrawn, withdrawHistory, type RetentionPorts } from './chatRetention';
import { RETENTION_DAYS, retentionExpired, stateFromWire, type AtlasState } from './chatSyncCore';

const DAY = 86_400_000;
function rig(st: AtlasState | Error, now = 10 * DAY) {
  const log = { wipes: 0, puts: [] as AtlasState[] };
  const ports: RetentionPorts = {
    readState: async () => {
      if (st instanceof Error) throw st;
      return st;
    },
    putState: async (x) => void log.puts.push(x),
    deleteAll: async () => void log.wipes++,
    now: () => now,
  };
  return { log, ports };
}

describe('withdrawing the Atlas chat consent (SPO-392)', () => {
  it('"delete now" deletes the copy and leaves no withdrawal mark; the clear-history mark is kept', async () => {
    const { log, ports } = rig({ clearedAt: 5, withdrawnAt: null });
    await withdrawHistory(ports, 'now');
    expect(log.wipes).toBe(1);
    expect(log.puts).toEqual([{ clearedAt: 5, withdrawnAt: null }]);
  });
  it('"keep" deletes nothing and records when', async () => {
    const { log, ports } = rig({ clearedAt: 5, withdrawnAt: null }, 1234);
    await withdrawHistory(ports, 'keep');
    expect(log.wipes).toBe(0);
    expect(log.puts).toEqual([{ clearedAt: 5, withdrawnAt: 1234 }]);
  });
  it('a state that cannot be read yet fails the withdrawal instead of overwriting it with empty', async () => {
    const { log, ports } = rig(new Error('atlas-state-locked'));
    await expect(withdrawHistory(ports, 'keep')).rejects.toThrow();
    expect(log.puts).toEqual([]);
  });
  it('the sweep deletes only after the kept time, and only then', async () => {
    const at = 1000;
    const early = rig({ clearedAt: 0, withdrawnAt: at }, at + (RETENTION_DAYS - 1) * DAY);
    expect(await sweepWithdrawn(early.ports)).toBe('kept');
    expect(early.log.wipes).toBe(0);
    const late = rig({ clearedAt: 3, withdrawnAt: at }, at + RETENTION_DAYS * DAY);
    expect(await sweepWithdrawn(late.ports)).toBe('deleted');
    expect(late.log.wipes).toBe(1);
    expect(late.log.puts).toEqual([{ clearedAt: 3, withdrawnAt: null }]);
  });
  it('the sweep does nothing when nothing was withdrawn, or the state cannot be read', async () => {
    const none = rig({ clearedAt: 0, withdrawnAt: null });
    expect(await sweepWithdrawn(none.ports)).toBe('none');
    const locked = rig(new Error('x'));
    expect(await sweepWithdrawn(locked.ports)).toBe('none');
    expect(locked.log.wipes + none.log.wipes).toBe(0);
  });
  it('a stamp in the future (wrong clock) is not expired; garbage reads as empty', () => {
    expect(retentionExpired(10 * DAY, 5 * DAY)).toBe(false);
    expect(stateFromWire('x')).toEqual({ clearedAt: 0, withdrawnAt: null });
    expect(stateFromWire({ clearedAt: -3, withdrawnAt: 'a' })).toEqual({
      clearedAt: 0,
      withdrawnAt: null,
    });
  });
});
