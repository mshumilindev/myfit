import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { configureCalendarSettings, useCalendarSettings } from './calendarSettings';
import { defaultSettings } from './hours';

afterEach(() => configureCalendarSettings(null));

describe('useCalendarSettings', () => {
  it('without a configured port (fixtures) it still becomes loaded and saves in memory', async () => {
    configureCalendarSettings(null);
    const { result } = renderHook(() => useCalendarSettings());
    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => {
      await result.current.save({ ...defaultSettings(), range: '24h' });
    });
    expect(result.current.settings.range).toBe('24h');
  });
  it('a failing save rolls back and reports false', async () => {
    configureCalendarSettings({
      load: () => Promise.resolve(null),
      save: () => Promise.reject(new Error('x')),
    });
    const { result } = renderHook(() => useCalendarSettings());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    let ok = true;
    await act(async () => {
      ok = await result.current.save({ ...defaultSettings(), range: '24h' });
    });
    expect(ok).toBe(false);
    expect(result.current.settings.range).toBe(defaultSettings().range);
  });
});
