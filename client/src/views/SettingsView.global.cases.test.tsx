/** The global-scope row: no real flag is global today, so the flag list is extended with one (the machinery stays live). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { en } from '../i18n/en';

vi.mock('../data/flags', async (orig) => {
  const real = await orig<typeof import('../data/flags')>();
  return {
    ...real,
    FEATURE_FLAGS: [...real.FEATURE_FLAGS, { id: 'mystery', scope: 'global' }],
  };
});

import { SettingsView } from './SettingsView';

afterEach(cleanup);

describe('SettingsView with a global flag', () => {
  it('labels a flag without copy by its id and marks global scope in the subtitle', () => {
    render(<SettingsView onClose={() => undefined} />);
    expect(screen.getByRole('switch', { name: 'mystery' })).toBeTruthy();
    expect(screen.getByText(`· ${en.flagScopeGlobal}`)).toBeTruthy();
    // device flags carry no scope suffix
    expect(screen.getByText(en.flagNutritionDesc)).toBeTruthy();
  });
});
