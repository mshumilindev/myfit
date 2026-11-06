import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addonsPref, resolveEnabled } from './enabledSet';
import { addonsQueuePref, queueAdd } from './queue';
import { installOrder, resetInstall, startInstall, undoInstall, useInstallRun } from './installRun';
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
    queueAdd(['injury-log', 'sleep'], 'member');
    const { result } = renderHook(() => useInstallRun());
    let run = Promise.resolve();
    act(() => {
      run = startInstall('member');
    });
    expect(result.current.status).toBe('running');
    expect(result.current.ids).toEqual(['health', 'sleep', 'injury-log']);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await run;
    expect(result.current.status).toBe('done');
    expect(resolveEnabled(addonsPref.snapshot(), 'member')).toEqual(
      new Set(['health', 'sleep', 'injury-log']),
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
});
