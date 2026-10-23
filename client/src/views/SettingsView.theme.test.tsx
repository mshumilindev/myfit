import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';

const setTheme = vi.fn();
vi.mock('../themes', () => ({
  THEMES: [
    { id: 'glass', name: 'Brass Glass' },
    { id: 'slate', name: 'Slate' },
  ],
  setTheme: (id: string) => setTheme(id),
  useTheme: () => 'glass',
}));

import { SettingsView } from './SettingsView';

beforeEach(() => {
  localStorage.clear();
  setLocale('en');
  setTheme.mockClear();
});
afterEach(cleanup);

describe('SettingsView theme picker (shown when there is more than one theme)', () => {
  it('lists every theme under the translated header and switches on tap', () => {
    render(<SettingsView onClose={() => undefined} />);
    expect(screen.getByText(en.settingsThemeLabel)).toBeTruthy();
    expect(screen.getByText('Brass Glass')).toBeTruthy();
    fireEvent.click(screen.getByText('Slate'));
    expect(setTheme).toHaveBeenCalledWith('slate');
  });
});
