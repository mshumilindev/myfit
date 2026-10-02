/** The three Lifestyle hubs (Nicotine, Alcohol, Supplements) keep one row order and one summary rule. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AlcoholCalcView } from './alcohol/AlcoholCalcView';
import { AlcoholHubView } from './alcohol/AlcoholHubView';
import { NicotineCalcView } from './nicotine/NicotineCalcView';
import { NicotineHubView } from './nicotine/NicotineHubView';
import { SupplementCalcView } from './supplements/SupplementCalcView';
import { SupplementHubView } from './supplements/SupplementHubView';
import { setLocale } from '../../i18n';
import { newAlcoholEntry } from '../../alcohol';
import { newNicotineProduct } from '../../nicotine';
import { newSupplementEntry } from '../../supplements';
import {
  deleteAlcoholData,
  deleteNicotineData,
  deleteSupplementData,
  saveAlcoholEntry,
  saveNicotineProduct,
  saveSupplementEntry,
  setAlcoholUsualDays,
} from '../../store';

const nop = () => undefined;
/** The row labels of the first list, top to bottom. */
const labels = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('.uirow .uirow-l')).map((e) => e.textContent);

beforeEach(() => {
  setLocale('en');
  deleteNicotineData();
  deleteAlcoholData();
  deleteSupplementData();
});
afterEach(cleanup);

describe('Lifestyle hubs: one order', () => {
  it('What I use/drink/take, schedule row, Ask me on Today, Use in calculations, extras', () => {
    expect(labels(render(<NicotineHubView onOpen={nop} onBack={nop} />).container)).toEqual([
      'What I use',
      'Use in calculations',
    ]);
    cleanup();
    expect(labels(render(<AlcoholHubView onOpen={nop} onBack={nop} />).container)).toEqual([
      'What I drink',
      'Usual days',
      'Ask me on Today',
      'Use in calculations',
      'Region and units',
    ]);
    cleanup();
    expect(labels(render(<SupplementHubView onOpen={nop} onBack={nop} />).container)).toEqual([
      'What I take',
      'Schedule',
      'Ask me on Today',
      'Use in calculations',
    ]);
  });

  it('the Schedule row is a chevron row like Usual days and opens the list', () => {
    const seen: string[] = [];
    render(<SupplementHubView onOpen={(s) => seen.push(s)} onBack={nop} />);
    screen.getByRole('button', { name: /^Schedule/ }).click();
    expect(seen).toEqual(['products']);
  });

  it('summaries share one rule: at most two names, then "N more"', () => {
    for (const k of ['vape', 'cigarettes', 'pouches'] as const)
      saveNicotineProduct({ ...newNicotineProduct(k, `n-${k}`), amount: 5 });
    for (const id of ['beerRegular', 'wineRed', 'spWhisky'] as const)
      saveAlcoholEntry({ ...newAlcoholEntry(id, `a-${id}`, 500), servingsPerWeek: 3 });
    for (const id of ['creatine', 'whey', 'caffeine'] as const)
      saveSupplementEntry(newSupplementEntry(id, `s-${id}`, 5));
    setAlcoholUsualDays([4]);
    for (const ui of [
      <NicotineHubView key="n" onOpen={nop} onBack={nop} />,
      <AlcoholHubView key="a" onOpen={nop} onBack={nop} />,
      <SupplementHubView key="s" onOpen={nop} onBack={nop} />,
    ]) {
      const { container, unmount } = render(ui);
      const sub = container.querySelector('.uirow .uirow-s')!.textContent!;
      expect(sub).toMatch(/^[^+]+ \+ [^+]+ \+ 1 more · /);
      unmount();
    }
  });
});

describe('"Use in calculations": one section order', () => {
  /** Header texts, in order, then whether a disclaimer Notice closes the page. */
  const headers = (c: HTMLElement) =>
    Array.from(c.querySelectorAll('.uigl-h')).map((e) => e.textContent);

  it('master, research group, experimental group, then the disclaimer', () => {
    const nic = render(<NicotineCalcView onBack={nop} />).container;
    expect(headers(nic)).toEqual([
      'Based on research (weak)',
      'Experimental — no research behind it yet',
    ]);
    expect(nic.textContent).toMatch(/Nicotine and smoking can affect sleep/);
    cleanup();
    const alc = render(<AlcoholCalcView onBack={nop} />).container;
    expect(headers(alc)).toEqual([
      'Based on research (weak)',
      'Experimental — no research behind it yet',
    ]);
    expect(alc.textContent).toMatch(/Alcohol has no proven safe level/);
    cleanup();
    const sup = render(<SupplementCalcView onBack={nop} />).container;
    expect(headers(sup)[0]).toBe('Based on research');
    expect(screen.getByRole('switch', { name: 'Use supplements in my numbers' })).toBeTruthy();
    expect(sup.textContent).toMatch(/Supplement effects are small/);
  });
});
