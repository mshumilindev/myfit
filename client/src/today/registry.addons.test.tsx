import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addonsPref } from '../addons/enabledSet';
import { MASTERY_WIDGET_IDS, useWidgetAvailable, widgetById } from './registry';

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
  it('a member without Mastery loses rank and level widgets but keeps streak', () => {
    expect(avail('apex-rank')).toBe(false);
    expect(avail('apex-mastery')).toBe(false);
    expect(avail('streak')).toBe(true);
  });
  it('installing Mastery brings them back', () => {
    addonsPref.set(['mastery']);
    expect(avail('apex-rank')).toBe(true);
  });
  it('a trainer keeps them (the store does not offer Mastery to trainers)', () => {
    role.value = 'trainer';
    expect(avail('apex-rank')).toBe(true);
  });
});
