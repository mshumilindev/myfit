import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { addonsPref } from '../../addons/enabledSet';
import { LOCALES, setLocale } from '../../i18n';
import { GymTabBar } from './GymChrome';

vi.mock('../../api', async (orig) => ({
  ...(await orig<typeof import('../../api')>()),
  getRole: () => 'member',
}));

const t = LOCALES.en;
const items = [
  { id: 'today', label: 'Today', icon: 'house', active: true },
  { id: 'overview', label: 'Overview', icon: 'chart-bar' },
  { id: 'gyms', label: 'Gyms', icon: 'barbell' },
];
const bar = (onPrivacy = vi.fn()) =>
  render(
    <GymTabBar
      items={items}
      hidden={[]}
      mastery={false}
      onMastery={() => undefined}
      onPrivacy={onPrivacy}
      onSelect={() => undefined}
      fab={{ ariaLabel: 'Start', onClick: () => undefined }}
    />,
  );

beforeEach(() => addonsPref.reset());
afterEach(cleanup);

describe('GymTabBar: More is always the last tab', () => {
  it('has More even when nothing collapsed, and it lists Privacy and sharing', () => {
    const onPrivacy = vi.fn();
    bar(onPrivacy);
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    fireEvent.click(screen.getByText(t.hlPrivRow));
    expect(onPrivacy).toHaveBeenCalledTimes(1);
  });

  it('lists Mastery in More only once it is installed', () => {
    bar();
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.queryByText(t.masteryTitle)).toBeNull();
    cleanup();
    addonsPref.set(['mastery']);
    bar();
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.getByText(t.masteryTitle)).toBeTruthy();
  });

  it('lists Language in More and switching it changes the locale', () => {
    bar();
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    fireEvent.click(screen.getByText(t.language));
    fireEvent.click(screen.getByText(LOCALES.uk.locale));
    expect(document.documentElement.lang).toBe('uk');
    setLocale('en');
  });
});
