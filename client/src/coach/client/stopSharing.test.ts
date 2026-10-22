import { describe, expect, it, vi } from 'vitest';
import { restoreLocals, stopAllSharing, type LocalLevels } from './stopSharing';
import { rememberStop, takePendingStop } from './stopUndo';

const locals: LocalLevels = {
  conditions: 'full',
  nicotine: 'off',
  alcohol: 'effects',
  supplements: 'effects',
};

describe('stopAllSharing', () => {
  it('zeroes the raw level of ALL four local settings BEFORE the grants are revoked, remembers the visible ones', async () => {
    const order: string[] = [];
    const forget = vi.fn((id: string) => order.push(`${id}:off`));
    const revoke = vi.fn(async () => {
      order.push('revoke');
      return true;
    });
    const r = await stopAllSharing({ locals, forget, revoke });
    // nicotine reads Off here (hidden: its feature may be off) but its raw level is zeroed all the same
    expect(order).toEqual([
      'conditions:off',
      'nicotine:off',
      'alcohol:off',
      'supplements:off',
      'revoke',
    ]);
    expect(r).toEqual({
      ok: true,
      previous: { conditions: 'full', alcohol: 'effects', supplements: 'effects' },
    });
  });

  it('a failing revoke never turns a local level back on, and says it failed', async () => {
    const forget = vi.fn();
    const r = await stopAllSharing({ locals, forget, revoke: async () => false });
    expect(r.ok).toBe(false);
    expect(forget).toHaveBeenCalledTimes(4);
  });

  it('with nothing visible to stop it still revokes and still forgets the hidden raw levels', async () => {
    const revoke = vi.fn(async () => true);
    const forget = vi.fn();
    const r = await stopAllSharing({
      locals: { conditions: 'off', nicotine: 'off', alcohol: 'off', supplements: 'off' },
      forget,
      revoke,
    });
    expect(forget).toHaveBeenCalledTimes(4);
    expect(revoke).toHaveBeenCalledOnce();
    expect(r.previous).toEqual({});
  });

  it('restoreLocals writes back exactly what was turned off', () => {
    const write = vi.fn();
    restoreLocals({ conditions: 'full', alcohol: 'effects' }, write);
    expect(write.mock.calls).toEqual([
      ['conditions', 'full'],
      ['alcohol', 'effects'],
    ]);
  });

  it('restoreLocals skips a setting that is not allowed now (consent switched off meanwhile)', () => {
    const write = vi.fn();
    restoreLocals({ conditions: 'full', alcohol: 'effects' }, write, (id) => id !== 'alcohol');
    expect(write.mock.calls).toEqual([['conditions', 'full']]);
  });
});

describe('the pending Undo store', () => {
  it('survives between calls (a remounted screen takes it), once', () => {
    rememberStop('u1', { nicotine: 'full' }, 8000, 1000);
    expect(takePendingStop('u1', 2000)).toEqual({ nicotine: 'full' });
    expect(takePendingStop('u1', 2000)).toEqual({});
  });
  it('expires, and belongs to one account', () => {
    rememberStop('u1', { nicotine: 'full' }, 8000, 1000);
    expect(takePendingStop('u1', 9000)).toEqual({});
    rememberStop('u1', { nicotine: 'full' }, 8000, 1000);
    expect(takePendingStop('u2', 2000)).toEqual({});
  });
  it('nothing to remember clears an older entry', () => {
    rememberStop('u1', { nicotine: 'full' }, 8000, 1000);
    rememberStop('u1', {}, 8000, 1000);
    expect(takePendingStop('u1', 1500)).toEqual({});
  });
});
