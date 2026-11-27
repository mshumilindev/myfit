import { beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn();

import { reportClientError } from './errorReport';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('reportClientError (SPO-639 G2)', () => {
  beforeEach(() => {
    call.mockReset();
    call.mockImplementation(() => Promise.resolve());
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });
  it('sends kind, message and stack without any user identifiers', async () => {
    reportClientError('error', new Error('boom'), 10000000, call);
    await flush();
    await flush();
    expect(call).toHaveBeenCalledTimes(1);
    const payload = (call.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(Object.keys(payload).sort()).toEqual([
      'build',
      'kind',
      'locale',
      'message',
      'online',
      'stack',
    ]);
  });
  it('sends at most one report per kind per minute', async () => {
    reportClientError('error', new Error('a'), 20000000, call);
    reportClientError('error', new Error('b'), 20030000, call);
    reportClientError('render', new Error('c'), 20030000, call);
    await flush();
    expect(call).toHaveBeenCalledTimes(2);
  });
  it('drops reports while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    reportClientError('error', new Error('x'), 30000000, call);
    await flush();
    expect(call).not.toHaveBeenCalled();
  });
  it('never throws on odd input', () => {
    expect(() => reportClientError('error', undefined, 40000000, call)).not.toThrow();
  });
});
