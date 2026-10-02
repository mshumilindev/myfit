/** Alcohol on the Health privacy screen and in the Health overview. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HealthPrivacyView } from './HealthPrivacyView';
import { HealthView } from '../HealthView';
import { setFlag } from '../../data/flags';
import { setLocale } from '../../i18n';
import type { Shell } from '../../App';
import { newAlcoholEntry } from '../../alcohol';
import {
  __getStateForTests,
  deleteAlcoholData,
  deleteNicotineData,
  saveAlcoholEntry,
  saveNicotineProduct,
  setAlcoholSharing,
  setConditionsShare,
  setNicotineSharing,
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

const alc = () => __getStateForTests().alcohol;
const shellMock = () =>
  ({
    openOverlay: vi.fn(),
    replaceOverlay: vi.fn(),
    goTab: vi.fn(),
    snack: vi.fn(),
  }) as unknown as Shell;
const rowOf = (name: string) =>
  [...document.querySelectorAll<HTMLElement>('button.uirow')].find(
    (b) => b.querySelector('.uirow-l')?.textContent === name,
  ) as HTMLElement;
const lines = (c: HTMLElement) =>
  [...c.querySelectorAll('.uicard .ut-w6')].map((e) => e.textContent);

describe('HealthPrivacyView: Alcohol', () => {
  it('has an Alcohol row (Off by default) and a "Delete alcohol data" row', () => {
    render(<HealthPrivacyView onBack={() => undefined} />);
    expect(rowOf('Alcohol').textContent).toContain('Off');
    expect(screen.getByText('Delete nicotine data')).toBeTruthy();
    expect(screen.getByText('Delete alcohol data')).toBeTruthy();
  });

  it('the sheet offers Off and Effects only, no Full; a choice applies at once', () => {
    render(<HealthPrivacyView onBack={() => undefined} />);
    fireEvent.click(rowOf('Alcohol'));
    const group = within(screen.getByRole('group', { name: 'Coach sharing' }));
    expect(group.getAllByRole('button')).toHaveLength(2);
    expect(group.queryByText('Full')).toBeNull();
    expect(
      group.getByText('“Sleep need +10 min, readiness −4%.” No drinks or amounts.'),
    ).toBeTruthy();
    fireEvent.click(group.getByText('Effects only'));
    expect(alc().settings.sharing).toBe('effects');
    fireEvent.click(group.getByText('Off'));
    expect(alc().settings.sharing).toBe('off');
    setAlcoholSharing('effects');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(rowOf('Alcohol').textContent).toContain('Effects only');
  });

  it('the summary card includes alcohol, built from the live state', () => {
    setConditionsShare('effects');
    setAlcoholSharing('effects');
    const a = render(<HealthPrivacyView onBack={() => undefined} />);
    expect(lines(a.container)).toEqual([
      'Training effects only: Long-term conditions and Alcohol.',
    ]);
    a.unmount();
    setConditionsShare('off');
    setNicotineSharing('full');
    const b = render(<HealthPrivacyView onBack={() => undefined} />);
    expect(lines(b.container)).toEqual([
      'Training effects only: Alcohol.',
      'Full details: Nicotine.',
    ]);
    b.unmount();
    setNicotineSharing('off');
    setAlcoholSharing('off');
    const c = render(<HealthPrivacyView onBack={() => undefined} />);
    expect(screen.getByText('Your coach sees nothing.')).toBeTruthy();
    c.unmount();
  });

  it('delete alcohol asks first (danger), cancel keeps data, confirm wipes it; nicotine stays', () => {
    saveAlcoholEntry(newAlcoholEntry('beerRegular', 'alc-beerRegular'));
    setAlcoholSharing('effects');
    saveNicotineProduct(newNicotineProduct('vape', 'nic-vape'));
    render(<HealthPrivacyView onBack={() => undefined} />);
    fireEvent.click(screen.getByText('Delete alcohol data'));
    expect(screen.getByText('Delete all alcohol data?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(alc().entries).toHaveLength(1);
    expect(alc().settings.sharing).toBe('effects');
    fireEvent.click(screen.getByText('Delete alcohol data'));
    const btns = screen.getAllByRole('button', { name: 'Delete alcohol data' });
    fireEvent.click(btns[btns.length - 1]);
    expect(alc().entries).toHaveLength(0);
    expect(alc().settings.sharing).toBe('off');
    expect(__getStateForTests().nicotine.products).toHaveLength(1);
  });
});

describe('Health overview: Alcohol', () => {
  it('Lifestyle shows Alcohol under Nicotine with the summary, and opens the hub', () => {
    saveAlcoholEntry(newAlcoholEntry('beerRegular', 'alc-beerRegular'));
    const shell = shellMock();
    render(<HealthView shell={shell} onClose={() => undefined} />);
    const heads = [...document.querySelectorAll('.uigl-h')].map((e) => e.textContent);
    expect(heads).toContain('Lifestyle');
    const group = screen.getByText('Lifestyle').closest('section') as HTMLElement;
    const labels = [...group.querySelectorAll('.uirow-l')].map((e) => e.textContent);
    expect(labels).toEqual(['Nicotine', 'Alcohol', 'Supplements']);
    fireEvent.click(within(group).getByText('Beer · ≈ 59 g a week'));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'health', alc: 'hub' });
  });

  it('the privacy summary row says mixed when alcohol differs from the rest', () => {
    const a = render(<HealthView shell={shellMock()} onClose={() => undefined} />);
    expect(screen.getByText('Coach: Off')).toBeTruthy();
    a.unmount();
    setAlcoholSharing('effects');
    render(<HealthView shell={shellMock()} onClose={() => undefined} />);
    expect(screen.getByText('Coach: mixed')).toBeTruthy();
  });
});
