import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HealthPrivacyView } from './HealthPrivacyView';
import { HealthView } from '../HealthView';
import { setFlag } from '../../data/flags';
import { setLocale } from '../../i18n';
import type { Shell } from '../../App';
import {
  __getStateForTests,
  deleteAlcoholData,
  deleteNicotineData,
  saveNicotineProduct,
  setAlcoholSharing,
  setConditionsShare,
  setNicotineSharing,
  setSupplementSharing,
} from '../../store';
import { newNicotineProduct } from '../../nicotine';

beforeEach(() => {
  setLocale('en');
  setFlag('conditions', true);
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

  it('has the Privacy and sharing title and the universal encryption note as the footer', () => {
    render(<HealthPrivacyView onBack={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Privacy and sharing' })).toBeTruthy();
    expect(
      screen.getByText(
        'Everything you enter in Health is encrypted on your device and in the cloud. It only adjusts your plans and suggestions.',
      ),
    ).toBeTruthy();
  });

  it('the summary says nothing is shared when everything is off', () => {
    render(<HealthPrivacyView onBack={() => undefined} />);
    expect(screen.getByText('What your coach would see')).toBeTruthy();
    expect(screen.getByText('Your coach sees nothing.')).toBeTruthy();
    expect(screen.queryByText('Nothing else.')).toBeNull();
  });

  it('the summary lists categories by level, built from the live state', () => {
    setConditionsShare('effects');
    setNicotineSharing('full');
    const { container } = render(<HealthPrivacyView onBack={() => undefined} />);
    const lines = [...container.querySelectorAll('.uicard .ut-w6')].map((e) => e.textContent);
    expect(lines).toEqual([
      'Training effects only: Long-term conditions.',
      'Full details: Nicotine.',
    ]);
    expect(screen.getByText('Nothing else.')).toBeTruthy();
    setNicotineSharing('effects');
    cleanup();
    const again = render(<HealthPrivacyView onBack={() => undefined} />);
    expect(
      [...again.container.querySelectorAll('.uicard .ut-w6')].map((e) => e.textContent),
    ).toEqual(['Training effects only: Long-term conditions and Nicotine.']);
    setNicotineSharing('off');
  });

  it('rows show the current level; the conditions row carries the override note', () => {
    setConditionsShare('effects');
    render(<HealthPrivacyView onBack={() => undefined} />);
    const cond = rowOf('Long-term conditions');
    expect(cond.textContent).toContain('Effects only');
    expect(cond.textContent).not.toContain('override');
    expect(screen.getByText('Each condition can override this on its own page.')).toBeTruthy();
    expect(rowOf('Nicotine').textContent).toContain('Off');
  });

  it('the conditions row is hidden when the conditions flag is off', () => {
    setFlag('conditions', false);
    render(<HealthPrivacyView onBack={() => undefined} />);
    expect(screen.queryByText('Long-term conditions')).toBeNull();
    expect(screen.getByText('Nicotine')).toBeTruthy();
    setFlag('conditions', true);
  });

  it('a category opens a sheet; choosing a level applies at once and Done closes it', () => {
    render(<HealthPrivacyView onBack={() => undefined} />);
    fireEvent.click(rowOf('Nicotine'));
    const group = screen.getByRole('group', { name: 'Coach sharing' });
    expect(within(group).getByText('Off').closest('button')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(within(group).getByText('Products and your usual amounts.')).toBeTruthy();
    fireEvent.click(within(group).getByText('Effects only'));
    expect(settings().sharing).toBe('effects');
    fireEvent.click(within(group).getByText('Full'));
    expect(settings().sharing).toBe('full');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('group', { name: 'Coach sharing' })).toBeNull();
    expect(rowOf('Nicotine').textContent).toContain('Full');
    setNicotineSharing('off');
  });

  it('the conditions sheet sets the conditions default', () => {
    render(<HealthPrivacyView onBack={() => undefined} />);
    fireEvent.click(rowOf('Long-term conditions'));
    const group = screen.getByRole('group', { name: 'Coach sharing' });
    fireEvent.click(within(group).getByText('Full'));
    expect(__getStateForTests().conditionsShare).toBe('full');
    expect(screen.getByText('Your coach sees the condition and its severity.')).toBeTruthy();
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
  it('has a Privacy group at the bottom with a coach summary; no share-default control or conditions footer', () => {
    const shell = shellMock();
    render(<HealthView shell={shell} onClose={() => undefined} />);
    expect(screen.queryByText('Share with my coach by default')).toBeNull();
    expect(screen.queryByText(/Private and encrypted\. Adjusts your plans/)).toBeNull();
    const heads = [...document.querySelectorAll('.uigl-h')].map((e) => e.textContent);
    expect(heads[heads.length - 1]).toBe('Privacy');
    expect(screen.getByText('Coach: Off')).toBeTruthy();
    fireEvent.click(screen.getByText('Privacy and sharing'));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'health', priv: true });
  });

  it('the summary follows the levels, and says mixed when the categories differ', () => {
    setConditionsShare('effects');
    setNicotineSharing('effects');
    setAlcoholSharing('effects');
    setSupplementSharing('effects');
    const a = render(<HealthView shell={shellMock()} onClose={() => undefined} />);
    expect(screen.getByText('Coach: Effects only')).toBeTruthy();
    a.unmount();
    setNicotineSharing('full');
    render(<HealthView shell={shellMock()} onClose={() => undefined} />);
    expect(screen.getByText('Coach: mixed')).toBeTruthy();
    setConditionsShare('off');
    setNicotineSharing('off');
    setAlcoholSharing('off');
    setSupplementSharing('off');
  });

  it('the priv route renders the privacy screen instead of the overview', () => {
    render(<HealthView shell={shellMock()} priv onClose={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Privacy and sharing' })).toBeTruthy();
    expect(screen.queryByText('Log the past')).toBeNull();
  });
});
