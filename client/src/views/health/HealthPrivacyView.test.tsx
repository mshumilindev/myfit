import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HealthPrivacyView } from './HealthPrivacyView';
import { HealthView } from '../HealthView';
import { setLocale } from '../../i18n';
import type { Shell } from '../../App';
import {
  __getStateForTests,
  deleteAlcoholData,
  deleteNicotineData,
  saveNicotineProduct,
  setConditionsShare,
  setNicotineSharing,
} from '../../store';
import { newNicotineProduct } from '../../nicotine';
import { addonsPref } from '../../addons/enabledSet';

beforeEach(() => {
  addonsPref.set([
    'health',
    'injury-log',
    'cycle',
    'supplements',
    'nicotine',
    'alcohol',
    'conditions',
    'rest',
    'unwell',
    'sleep',
  ]);
  setLocale('en');
  deleteNicotineData();
  deleteAlcoholData();
  setConditionsShare('off');
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

const settings = () => __getStateForTests().nicotine.settings;
const shellMock = () =>
  ({
    openOverlay: vi.fn(),
    replaceOverlay: vi.fn(),
    goTab: vi.fn(),
    snack: vi.fn(),
  }) as unknown as Shell;

describe('HealthPrivacyView', () => {
  const rowOf = (name: string) =>
    [...document.querySelectorAll<HTMLElement>('button.uirow')].find((b) =>
      b.querySelector('.uirow-l')?.textContent?.includes(name),
    ) as HTMLElement;
  /** The sharing list is a lazy chunk: wait for its rows. */
  const ready = () => screen.findByRole('button', { name: /^Nicotine,/ });

  it('has the Privacy and sharing title and the universal encryption note as the footer', () => {
    render(<HealthPrivacyView onBack={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Privacy and sharing' })).toBeTruthy();
    expect(
      screen.getByText(
        'Everything you enter in Health is encrypted on your device and in the cloud. It only adjusts your plans and suggestions.',
      ),
    ).toBeTruthy();
  });

  it('shows the shared "Your privacy" block (Consents, documents, What Spotter knows about you)', () => {
    render(<HealthPrivacyView onBack={() => undefined} />);
    expect(screen.getByText('Consents')).toBeTruthy();
    expect(screen.getByText('Privacy Policy')).toBeTruthy();
    expect(screen.getByText('Terms of Use')).toBeTruthy();
    expect(screen.getByText('What Spotter knows about you')).toBeTruthy();
  });

  it('the summary says nothing is shared when everything is off', async () => {
    render(<HealthPrivacyView onBack={() => undefined} />);
    await ready();
    expect(screen.getByText('What your coach would see')).toBeTruthy();
    expect(screen.getByText('Your coach sees nothing.')).toBeTruthy();
    expect(screen.queryByText('Nothing else.')).toBeNull();
  });

  it('the one summary lists categories by level, built from the live state', async () => {
    setConditionsShare('effects');
    setNicotineSharing('full');
    const { container } = render(<HealthPrivacyView onBack={() => undefined} />);
    await ready();
    const lines = [...container.querySelectorAll('.uicard .ut-w6')].map((e) => e.textContent);
    expect(lines).toEqual(['Effects only: Long-term conditions.', 'Full: Nicotine.']);
    expect(
      screen.getByText('Nothing else. Private notes about you are not part of this.'),
    ).toBeTruthy();
    setNicotineSharing('effects');
    cleanup();
    const again = render(<HealthPrivacyView onBack={() => undefined} />);
    await ready();
    expect(
      [...again.container.querySelectorAll('.uicard .ut-w6')].map((e) => e.textContent),
    ).toEqual(['Effects only: Long-term conditions and Nicotine.']);
    setNicotineSharing('off');
  });

  it('rows show the current level; the old "settings below" and override notes are gone', async () => {
    setConditionsShare('effects');
    render(<HealthPrivacyView onBack={() => undefined} />);
    await ready();
    const cond = rowOf('Long-term conditions');
    expect(cond.textContent).toContain('Effects only');
    expect(cond.textContent).not.toContain('override');
    expect(screen.queryByText('Each condition can override this on its own page.')).toBeNull();
    expect(rowOf('Nicotine').textContent).toContain('Off');
  });

  it('the conditions row remains available with a legacy disabled flag', async () => {
    localStorage.setItem('gym.flags', JSON.stringify({ conditions: false }));
    render(<HealthPrivacyView onBack={() => undefined} />);
    await ready();
    expect(screen.getByRole('button', { name: /^Long-term conditions,/ })).toBeTruthy();
  });

  it('a category opens a sheet; choosing a level applies at once and Done closes it', async () => {
    render(<HealthPrivacyView onBack={() => undefined} />);
    await ready();
    fireEvent.click(rowOf('Nicotine'));
    const group = screen.getByRole('group', { name: 'Sharing level' });
    expect(within(group).getByText('Off').closest('button')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(within(group).getByText('Products and your usual amounts.')).toBeTruthy();
    fireEvent.click(within(group).getByText('Effects only'));
    expect(settings().sharing).toBe('effects');
    fireEvent.click(within(group).getByText('Full'));
    expect(settings().sharing).toBe('full');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('group', { name: 'Sharing level' })).toBeNull();
    expect(rowOf('Nicotine').textContent).toContain('Full');
    setNicotineSharing('off');
  });

  it('the conditions sheet sets the conditions default', async () => {
    render(<HealthPrivacyView onBack={() => undefined} />);
    await ready();
    fireEvent.click(rowOf('Long-term conditions'));
    const group = screen.getByRole('group', { name: 'Sharing level' });
    fireEvent.click(within(group).getByText('Full'));
    expect(__getStateForTests().conditionsShare).toBe('full');
    expect(
      screen.getAllByText('Your coach sees the condition and its severity.').length,
    ).toBeGreaterThan(0);
  });

  it('delete asks first (danger), cancel keeps data, confirm wipes it', () => {
    saveNicotineProduct(newNicotineProduct('vape', 'nic-vape'));
    setNicotineSharing('full');
    render(<HealthPrivacyView onBack={() => undefined} />);
    fireEvent.click(screen.getByText('Delete nicotine data'));
    expect(screen.getByText('Delete all nicotine data?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(settings().sharing).toBe('full');
    expect(__getStateForTests().nicotine.products).toHaveLength(1);
    fireEvent.click(screen.getByText('Delete nicotine data'));
    const btns = screen.getAllByRole('button', { name: 'Delete nicotine data' });
    fireEvent.click(btns[btns.length - 1]);
    expect(settings().sharing).toBe('off');
    expect(__getStateForTests().nicotine.products).toHaveLength(0);
  });
});

describe('Health overview', () => {
  it('has no Privacy group any more: no share-default control, no conditions footer, no privacy row', () => {
    render(<HealthView shell={shellMock()} onClose={() => undefined} />);
    expect(screen.queryByText('Share with my coach by default')).toBeNull();
    expect(screen.queryByText(/Private and encrypted\. Adjusts your plans/)).toBeNull();
    const heads = [...document.querySelectorAll('.uigl-h')].map((e) => e.textContent);
    expect(heads).not.toContain('Privacy');
    expect(screen.queryByText('Privacy and sharing')).toBeNull();
  });

  it('the privacy screen is its own page with a heading and a back', () => {
    const onBack = vi.fn();
    render(<HealthPrivacyView onBack={onBack} />);
    expect(screen.getByRole('heading', { name: 'Privacy and sharing' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
