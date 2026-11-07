import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addonsPref, resolveEnabled } from './enabledSet';
import { addonsQueuePref, queueAdd } from './queue';
import {
  installOrder,
  resetInstall,
  retryInstall,
  startInstall,
  undoInstall,
  useInstallRun,
} from './installRun';
import { act, renderHook } from '@testing-library/react';

describe('install run', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    addonsPref.reset();
    addonsQueuePref.reset();
    resetInstall();
  });
  afterEach(async () => {
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it('puts apps before their add-ons', () => {
    expect(installOrder(['injury-log', 'sleep', 'health'])).toEqual([
      'sleep',
      'health',
      'injury-log',
    ]);
  });

  it('installs the picked list in order, empties it, and reports each step', async () => {
    queueAdd(['health', 'sleep'], 'member');
    const { result } = renderHook(() => useInstallRun());
    let run = Promise.resolve();
    act(() => {
      run = startInstall('member');
    });
    expect(result.current.status).toBe('running');
    expect(result.current.ids).toEqual(['health', 'sleep']);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await run;
    expect(result.current.status).toBe('done');
    // Health comes with its modules (Injury log, Cycle, Supplements, Nicotine and alcohol), each switchable later.
    expect(resolveEnabled(addonsPref.snapshot(), 'member')).toEqual(
      new Set(['health', 'sleep', 'injury-log', 'cycle', 'supplements', 'nicotine-alcohol']),
    );
    expect(addonsQueuePref.get()).toEqual([]);
  });

  it('does nothing for an empty list and ignores a second start while running', async () => {
    await startInstall('member');
    expect(resetInstall()).toBeUndefined();
    queueAdd(['atlas'], 'member');
    const first = startInstall('member');
    void startInstall('member');
    await vi.runAllTimersAsync();
    await first;
    expect(resolveEnabled(addonsPref.snapshot(), 'member').has('atlas')).toBe(true);
  });

  it('undo turns the run off again', async () => {
    queueAdd(['atlas'], 'member');
    const run = startInstall('member');
    await vi.runAllTimersAsync();
    await run;
    undoInstall('member');
    expect(resolveEnabled(addonsPref.snapshot(), 'member').has('atlas')).toBe(false);
    expect(addonsQueuePref.get()).toEqual(['atlas']);
  });

  it('offline: items fail, an add-on fails with its app, nothing is turned on; retry works once online', async () => {
    queueAdd(['injury-log', 'sleep'], 'member');
    const net = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { result } = renderHook(() => useInstallRun());
    await act(async () => {
      const run = startInstall('member');
      await vi.runAllTimersAsync();
      await run;
    });
    expect(result.current.status).toBe('partial');
    expect(Object.values(result.current.result)).toEqual(['failed', 'failed', 'failed']);
    expect(resolveEnabled(addonsPref.snapshot(), 'member').size).toBe(0);
    expect(addonsQueuePref.get().length).toBe(3);
    net.mockReturnValue(true);
    await act(async () => {
      const run = retryInstall('member');
      await vi.runAllTimersAsync();
      await run;
    });
    expect(result.current.status).toBe('done');
    expect(resolveEnabled(addonsPref.snapshot(), 'member').has('injury-log')).toBe(true);
    expect(addonsQueuePref.get()).toEqual([]);
    net.mockRestore();
  });
});
