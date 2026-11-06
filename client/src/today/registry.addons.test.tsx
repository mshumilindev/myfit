import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addonsPref } from '../addons/enabledSet';
import { MASTERY_WIDGET_IDS, SLEEP_WIDGET_IDS, useWidgetAvailable, widgetById } from './registry';

const role = vi.hoisted(() => ({ value: 'member' as string }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getRole: () => role.value,
}));
beforeEach(() => {
  addonsPref.reset();
  role.value = 'member';
});
afterEach(() => addonsPref.reset());

const avail = (id: string) => {
  const { result } = renderHook(() => useWidgetAvailable());
  return result.current(widgetById(id)!);
};

describe('Today widgets follow the Mastery add-on (SPO-518)', () => {
  it('every id in the Mastery set is a real widget', () => {
    for (const id of MASTERY_WIDGET_IDS) expect(widgetById(id), id).toBeDefined();
  });
  it('a member without Mastery loses the Apex widgets but keeps streak', () => {
    expect(avail('apex-rank')).toBe(false);
    expect(avail('apex-mastery')).toBe(false);
    expect(avail('streak')).toBe(true);
  });
  it('installing Mastery brings them back', () => {
    addonsPref.set(['mastery']);
    expect(avail('apex-rank')).toBe(true);
  });
  it('a trainer is offered Mastery too: no Apex widgets until it is installed', () => {
    role.value = 'trainer';
    expect(avail('apex-rank')).toBe(false);
    addonsPref.set(['mastery']);
    expect(avail('apex-rank')).toBe(true);
  });
});

describe('Sleep widgets follow the Sleep add-on (SPO-518)', () => {
  it('every id in the Sleep set is a real widget', () => {
    for (const id of SLEEP_WIDGET_IDS) expect(widgetById(id), id).toBeDefined();
  });
  it('hidden without Sleep for every role, back once installed', () => {
    expect(avail('sleep')).toBe(false);
    expect(avail('sleep-debt')).toBe(false);
    addonsPref.set(['sleep']);
    expect(avail('sleep')).toBe(true);
    addonsPref.reset();
    role.value = 'trainer';
    expect(avail('sleep')).toBe(false);
    addonsPref.set(['sleep']);
    expect(avail('sleep')).toBe(true);
  });
});

describe('Atlas widgets follow the Atlas add-on (SPO-518)', () => {
  it('a member without Atlas has none of the Atlas group, with it they are back', () => {
    expect(avail('ask-atlas')).toBe(false);
    expect(avail('atlas-insight')).toBe(false);
    addonsPref.set(['atlas']);
    expect(avail('ask-atlas')).toBe(true);
  });
});
