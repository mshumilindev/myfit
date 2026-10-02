import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AlcoholCalcView } from './AlcoholCalcView';
import { AlcoholDaysView } from './AlcoholDaysView';
import { AlcoholHubView } from './AlcoholHubView';
import { AlcoholProductsView } from './AlcoholProductsView';
import { AlcoholHealthRow, AlcoholOnboardingRow } from './AlcoholSection';
import { GroupedList } from '../../../components/ui/GroupedList';
import { setLocale } from '../../../i18n';
import { en } from '../../../i18n/en';
import { et } from '../../../i18n/et';
import { lt } from '../../../i18n/lt';
import { pl } from '../../../i18n/pl';
import { uk } from '../../../i18n/uk';
import { ALCOHOL_SURFACES, isExperimentalSurface, newAlcoholEntry } from '../../../alcohol';
import { ALCOHOL_CATEGORIES, ALCOHOL_ITEMS } from '../../../alcoholCatalog';
import {
  __getStateForTests,
  deleteAlcoholData,
  saveAlcoholEntry,
  setAlcoholCheckinsOn,
  setAlcoholRegionOverride,
  setAlcoholSurface,
  setAlcoholUsualDays,
  setAlcoholUseInCalculations,
} from '../../../store';
import { ALC_ICON, alcEntryId } from './text';

beforeEach(() => {
  setLocale('en');
  deleteAlcoholData();
  setAlcoholRegionOverride('eu');
});
afterEach(cleanup);

const alc = () => __getStateForTests().alcohol;
const entries = () => alc().entries;
const row = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const save = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
const group = (name: string) => within(screen.getByRole('group', { name }));
const pressed = (el: HTMLElement) => el.closest('button')?.getAttribute('aria-pressed');
const seed = (itemId: Parameters<typeof newAlcoholEntry>[0], patch = {}) =>
  saveAlcoholEntry({ ...newAlcoholEntry(itemId, alcEntryId(itemId)), ...patch });

describe('AlcoholProductsView (What I drink)', () => {
  it('lists the 8 categories with their hints, the reference row and the standard-drink footer', () => {
    render(<AlcoholProductsView onBack={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'What I drink' })).toBeTruthy();
    expect(screen.getByText(/Not listed\? Pick the closest match\./)).toBeTruthy();
    for (const c of ALCOHOL_CATEGORIES) expect(row(en.alcCat[c])).toBeTruthy();
    expect(screen.getByText('Apple and pear cider')).toBeTruthy();
    expect(document.querySelectorAll('.uirow-check')).toHaveLength(0);
    expect(screen.getByText(/A standard drink is 10 g of pure alcohol\./)).toBeTruthy();
    expect(screen.getByText(/Drinks marked “from time to time”/)).toBeTruthy();
    expect(within(row('Weekly reference')).getByText('EU · Weak evidence')).toBeTruthy();
    expect(within(row('Weekly reference')).getByText('≈ 100 g')).toBeTruthy();
    expect(screen.queryByText(/standard drinks a week/)).toBeNull();
  });

  it('Done leaves the page', () => {
    let back = 0;
    render(<AlcoholProductsView onBack={() => (back += 1)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(back).toBe(1);
  });

  it('tapping a category only opens the sheet with defaults; nothing is stored until Save', () => {
    render(<AlcoholProductsView onBack={() => undefined} />);
    fireEvent.click(row('Beer'));
    expect(entries()).toHaveLength(0);
    expect(pressed(screen.getByRole('button', { name: 'Regular beer · 5%' }))).toBe('true');
    expect(
      pressed(within(screen.getByRole('group', { name: 'Serving size' })).getByText('0.5 L')),
    ).toBe('true');
    expect(
      (screen.getByRole('textbox', { name: 'About how many a week' }) as HTMLInputElement).value,
    ).toBe('3');
    expect(screen.getByText('5% ABV')).toBeTruthy();
    expect(screen.getByText('20 g · 2 drinks')).toBeTruthy();
    expect(screen.getByText('≈ 59 g a week')).toBeTruthy();
    expect(save().disabled).toBe(false);
    expect(screen.queryByText('Remove this drink')).toBeNull();
    fireEvent.click(screen.getByLabelText('Cancel'));
    expect(entries()).toHaveLength(0);
    fireEvent.click(row('Beer'));
    fireEvent.click(save());
    expect(entries()).toEqual([
      expect.objectContaining({
        id: 'alc-beerRegular',
        itemId: 'beerRegular',
        servingMl: 500,
        servingsPerWeek: 3,
        active: true,
      }),
    ]);
    expect(within(row('Beer')).getByText('Regular beer 5% · 0.5 L × 3 a week')).toBeTruthy();
    expect(row('Beer').querySelector('.uirow-check')).toBeTruthy();
    expect(screen.getByText('5.9 standard drinks a week')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('a saved type: Save stays disabled until something changes, and again when changed back', () => {
    seed('beerRegular');
    render(<AlcoholProductsView onBack={() => undefined} />);
    fireEvent.click(row('Beer'));
    expect(save().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(save().disabled).toBe(false);
    expect(screen.getByText('≈ 79 g a week')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '−' }));
    expect(save().disabled).toBe(true);
    fireEvent.click(group('Serving size').getByText('0.33 L'));
    expect(save().disabled).toBe(false);
    fireEvent.click(group('Serving size').getByText('0.5 L'));
    expect(save().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(save());
    expect(entries()[0].servingsPerWeek).toBe(4);
  });

  it('several types of one category: a chip focuses a type, a saved one carries a check', () => {
    seed('beerRegular');
    render(<AlcoholProductsView onBack={() => undefined} />);
    fireEvent.click(row('Beer'));
    const chips = within(screen.getByRole('group', { name: 'Type' }));
    expect(chips.getAllByRole('button')).toHaveLength(4);
    expect(
      chips.getByRole('button', { name: /Regular beer/ }).querySelector('.ui-icon'),
    ).toBeTruthy();
    expect(chips.getByRole('button', { name: /Craft/ }).querySelector('.ui-icon')).toBeNull();
    // Browsing to an unsaved type makes Save available; going back to the saved one clears it.
    fireEvent.click(chips.getByRole('button', { name: /Strong beer/ }));
    expect(save().disabled).toBe(false);
    fireEvent.click(chips.getByRole('button', { name: /Regular beer/ }));
    expect(save().disabled).toBe(true);
    fireEvent.click(chips.getByRole('button', { name: /Craft/ }));
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(save());
    expect(entries().map((e) => [e.itemId, e.servingsPerWeek])).toEqual([
      ['beerRegular', 3],
      ['beerCraft', 4],
    ]);
    expect(within(row('Beer')).getByText(/^2 types · ≈ \d+ g a week$/)).toBeTruthy();
  });

  it('several drinks at once: the total names them, biggest first', () => {
    seed('beerRegular');
    seed('spWhisky');
    render(<AlcoholProductsView onBack={() => undefined} />);
    expect(screen.getByText('Beer + Whisky')).toBeTruthy();
    expect(within(row('Spirits')).getByText('Whisky 40% · 40 ml × 3 a week')).toBeTruthy();
    expect(document.querySelectorAll('.uirow-check')).toHaveLength(2);
  });

  it('From time to time blocks everything except the choice of drink', () => {
    seed('wineRed');
    render(<AlcoholProductsView onBack={() => undefined} />);
    fireEvent.click(row('Wine'));
    expect(screen.getByRole('group', { name: 'Serving size' })).toBeTruthy();
    fireEvent.click(group('How often').getByText('From time to time'));
    expect(screen.queryByRole('group', { name: 'Serving size' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'About how many a week' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Type' })).toBeTruthy();
    expect(screen.getByText(/Counted as a small background amount/)).toBeTruthy();
    expect(screen.getByText('≈ 15 g a week')).toBeTruthy();
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    expect(entries()[0]).toMatchObject({ itemId: 'wineRed', occasional: true });
    expect(within(row('Wine')).getByText('Red wine 13% · from time to time')).toBeTruthy();
    // Back to most weeks: the old amount is still there; saving that clears the flag.
    fireEvent.click(row('Wine'));
    expect(pressed(group('How often').getByText('From time to time'))).toBe('true');
    fireEvent.click(group('How often').getByText('Most weeks'));
    expect(
      (screen.getByRole('textbox', { name: 'About how many a week' }) as HTMLInputElement).value,
    ).toBe('3');
    fireEvent.click(save());
    expect('occasional' in entries()[0]).toBe(false);
  });

  it('Remove (saved types only) asks first; cancel keeps it, confirm removes it', () => {
    seed('spGin');
    render(<AlcoholProductsView onBack={() => undefined} />);
    fireEvent.click(row('Spirits'));
    fireEvent.click(screen.getByText('Remove this drink'));
    expect(screen.getByText('Remove this drink?')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' }).at(-1) as HTMLElement);
    expect(entries()).toHaveLength(1);
    fireEvent.click(screen.getByText('Remove this drink'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(entries()).toHaveLength(0);
  });

  it('US measures: ounces, a 14 g standard drink', () => {
    setAlcoholRegionOverride('us');
    render(<AlcoholProductsView onBack={() => undefined} />);
    expect(screen.getByText(/A standard drink is 14 g of pure alcohol\./)).toBeTruthy();
    fireEvent.click(row('Beer'));
    const sizes = group('Serving size');
    expect(sizes.getByText('12 oz')).toBeTruthy();
    expect(pressed(sizes.getByText('16 oz'))).toBe('true');
  });

  it('UK measures: pints, units of 8 g', () => {
    setAlcoholRegionOverride('uk');
    seed('beerRegular', { servingMl: 568 });
    render(<AlcoholProductsView onBack={() => undefined} />);
    expect(screen.getByText(/One unit is 8 g of pure alcohol\./)).toBeTruthy();
    expect(within(row('Beer')).getByText('Regular beer 5% · 1 pint × 3 a week')).toBeTruthy();
    fireEvent.click(row('Beer'));
    const sizes = group('Serving size');
    expect(sizes.getByText('½ pint')).toBeTruthy();
    expect(sizes.getByText('440 ml')).toBeTruthy();
    expect(pressed(sizes.getByText('1 pint'))).toBe('true');
    expect(save().disabled).toBe(true);
  });

  it('a saved serving that is not a preset of the region stays selectable', () => {
    seed('beerRegular', { servingMl: 568 });
    render(<AlcoholProductsView onBack={() => undefined} />);
    fireEvent.click(row('Beer'));
    expect(pressed(group('Serving size').getByText('0.57 L'))).toBe('true');
    expect(save().disabled).toBe(true);
  });

  it('the reference row opens a sheet with the figure, its source and confidence', () => {
    render(<AlcoholProductsView onBack={() => undefined} />);
    fireEvent.click(row('Weekly reference'));
    expect(screen.getByText('Low-risk weekly reference')).toBeTruthy();
    expect(screen.getByText(/It is not a target, a limit or a diagnosis/)).toBeTruthy();
    expect(screen.getByText('Weak evidence')).toBeTruthy();
    expect(screen.getByText(/No single EU figure/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Done' }).at(-1) as HTMLElement);
    expect(screen.queryByText('Low-risk weekly reference')).toBeNull();
    setAlcoholRegionOverride('ca');
    cleanup();
    render(<AlcoholProductsView onBack={() => undefined} />);
    expect(within(row('Weekly reference')).getByText('Canada · Moderate evidence')).toBeTruthy();
    expect(within(row('Weekly reference')).getByText('≈ 27 g')).toBeTruthy();
  });
});

describe('AlcoholHubView "Ask me on Today"', () => {
  const sw = () => screen.getByRole('switch', { name: 'Ask me on Today' }) as HTMLInputElement;
  const hub = () => render(<AlcoholHubView onOpen={() => undefined} onBack={() => undefined} />);

  it('without usual days: off, disabled, with the hint', () => {
    hub();
    expect(sw().checked).toBe(false);
    expect(sw().disabled).toBe(true);
    expect(screen.getByText('Choose your usual days first')).toBeTruthy();
    expect(alc().settings.checkinsOn).toBe(false);
  });

  it('with usual days: off by default, switches on and off', () => {
    setAlcoholUsualDays([4]);
    hub();
    expect(sw().disabled).toBe(false);
    expect(sw().checked).toBe(false);
    expect(screen.getByText('One question on the days you usually drink')).toBeTruthy();
    fireEvent.click(sw());
    expect(alc().settings.checkinsOn).toBe(true);
    fireEvent.click(sw());
    expect(alc().settings.checkinsOn).toBe(false);
  });

  it('clearing the usual days shows the switch off even if it was stored on', () => {
    setAlcoholUsualDays([4]);
    setAlcoholCheckinsOn(true);
    setAlcoholUsualDays([]);
    hub();
    expect(sw().checked).toBe(false);
    expect(sw().disabled).toBe(true);
  });
});

describe('AlcoholHubView', () => {
  it('four rows, each opens its page; the region row opens the picker', () => {
    const seen: string[] = [];
    render(<AlcoholHubView onOpen={(s) => seen.push(s)} onBack={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Alcohol' })).toBeTruthy();
    expect(screen.getByText('On')).toBeTruthy();
    expect(screen.getByText('Not set')).toBeTruthy();
    fireEvent.click(screen.getByText('What I drink'));
    fireEvent.click(screen.getByText('Usual days'));
    fireEvent.click(screen.getByText('Use in calculations'));
    expect(seen).toEqual(['products', 'days', 'calc']);
    expect(screen.queryByText('Privacy and sharing')).toBeNull();
  });

  it('the region picker: Auto, EU, US, UK, Australia, Canada; a choice applies at once', () => {
    render(<AlcoholHubView onOpen={() => undefined} onBack={() => undefined} />);
    fireEvent.click(screen.getByText('Region and units'));
    const options = within(screen.getByRole('group', { name: 'Region and units' }));
    expect(options.getAllByRole('button')).toHaveLength(6);
    expect(options.getByText('1 unit = 8 g · pints and ml')).toBeTruthy();
    expect(options.getByText('1 drink = 14 g · fl oz')).toBeTruthy();
    fireEvent.click(options.getByText('United Kingdom'));
    expect(alc().settings.regionOverride).toBe('uk');
    fireEvent.click(options.getByText('Auto'));
    expect(alc().settings.regionOverride).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('group', { name: 'Region and units' })).toBeNull();
  });

  it('shows the summary under What I drink and the chosen region', () => {
    seed('beerRegular');
    render(<AlcoholHubView onOpen={() => undefined} onBack={() => undefined} />);
    expect(screen.getByText('Beer · ≈ 59 g a week')).toBeTruthy();
    expect(screen.getByText('EU')).toBeTruthy();
  });
});

describe('AlcoholDaysView (Usual days)', () => {
  it('seven weekday chips, several at once; Save is dirty-checked; the hub shows the days', () => {
    const view = render(<AlcoholDaysView onBack={() => undefined} />);
    const days = group('Usually drink on');
    expect(days.getAllByRole('button')).toHaveLength(7);
    expect(
      screen.getByText(/Ask me on Today.+asks on Today after those days whether you drank/),
    ).toBeTruthy();
    expect(save().disabled).toBe(true);
    fireEvent.click(days.getByText('Sat'));
    fireEvent.click(days.getByText('Fri'));
    expect(save().disabled).toBe(false);
    fireEvent.click(days.getByText('Mon'));
    fireEvent.click(days.getByText('Mon'));
    fireEvent.click(save());
    expect(alc().settings.usualDays).toEqual([4, 5]);
    view.unmount();
    render(<AlcoholDaysView onBack={() => undefined} />);
    expect(pressed(group('Usually drink on').getByText('Fri'))).toBe('true');
    expect(save().disabled).toBe(true);
    fireEvent.click(group('Usually drink on').getByText('Fri'));
    fireEvent.click(group('Usually drink on').getByText('Sat'));
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    expect(alc().settings.usualDays).toEqual([]);
  });

  it('the hub lists the chosen days', () => {
    const days = render(<AlcoholDaysView onBack={() => undefined} />);
    fireEvent.click(group('Usually drink on').getByText('Fri'));
    fireEvent.click(group('Usually drink on').getByText('Sat'));
    fireEvent.click(save());
    days.unmount();
    render(<AlcoholHubView onOpen={() => undefined} onBack={() => undefined} />);
    expect(screen.getByText('Fri, Sat')).toBeTruthy();
  });
});

describe('AlcoholCalcView (Use in calculations)', () => {
  const sw = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

  it('master on; research group on, experimental group off; the disclaimer is shown', () => {
    render(<AlcoholCalcView onBack={() => undefined} />);
    expect(sw('Use alcohol in my numbers').checked).toBe(true);
    expect(screen.getAllByRole('switch')).toHaveLength(ALCOHOL_SURFACES.length + 1);
    expect(screen.getByText('Based on research (weak)')).toBeTruthy();
    expect(screen.getByText('Experimental — no research behind it yet')).toBeTruthy();
    expect(screen.getByText(/The estimates are guesses/)).toBeTruthy();
    expect(
      screen.getByText(
        'Estimates are based on population studies of alcohol, sleep and heart rate. Individual response varies. This is not medical advice. Alcohol has no proven safe level for health; see your national guidance.',
      ),
    ).toBeTruthy();
    for (const name of ['Recovery and readiness', 'Sleep', 'Trends', 'After a workout'])
      expect(sw(name).checked).toBe(true);
    for (const name of ['Fatigue and deload', 'Progression steps'])
      expect(sw(name).checked).toBe(false);
    for (const k of ALCOHOL_SURFACES)
      expect(alc().settings.surfaces[k]).toBe(!isExperimentalSurface(k));
  });

  it('switches apply immediately; a master off dims the rest', () => {
    render(<AlcoholCalcView onBack={() => undefined} />);
    fireEvent.click(sw('Sleep'));
    expect(alc().settings.surfaces.sleep).toBe(false);
    fireEvent.click(sw('Progression steps'));
    expect(alc().settings.surfaces.progression).toBe(true);
    fireEvent.click(sw('Use alcohol in my numbers'));
    expect(alc().settings.useInCalculations).toBe(false);
    expect(sw('Trends').disabled).toBe(true);
    setAlcoholUseInCalculations(true);
    setAlcoholSurface('sleep', true);
    setAlcoholSurface('progression', false);
  });

  it('Done leaves the page', () => {
    let back = 0;
    render(<AlcoholCalcView onBack={() => (back += 1)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(back).toBe(1);
  });
});

describe('Alcohol entry points', () => {
  it('Health row: empty hint, then the summary; opens the hub', () => {
    let opened = 0;
    const view = render(
      <GroupedList>
        <AlcoholHealthRow onOpen={() => (opened += 1)} />
      </GroupedList>,
    );
    expect(screen.getByText('Alcohol')).toBeTruthy();
    expect(screen.getByText('What you drink, to adjust your numbers')).toBeTruthy();
    view.unmount();
    seed('beerRegular');
    seed('spWhisky');
    render(
      <GroupedList>
        <AlcoholHealthRow onOpen={() => (opened += 1)} />
      </GroupedList>,
    );
    fireEvent.click(screen.getByText('Beer + Whisky · ≈ 97 g a week'));
    expect(opened).toBe(1);
  });

  it('onboarding row is optional and opens What I drink', () => {
    let opened = 0;
    render(<AlcoholOnboardingRow onOpen={() => (opened += 1)} />);
    expect(screen.getByText('Optional')).toBeTruthy();
    fireEvent.click(screen.getByText('Alcohol'));
    expect(opened).toBe(1);
  });
});

describe('translations', () => {
  const dicts = { en, uk, pl, lt, et };
  it('every locale names every catalog category, drink and weekday, with a distinct icon per category', () => {
    for (const [id, d] of Object.entries(dicts)) {
      for (const c of ALCOHOL_CATEGORIES) {
        expect(d.alcCat[c], `${id}.alcCat.${c}`).toBeTruthy();
        expect(d.alcCatShort[c], `${id}.alcCatShort.${c}`).toBeTruthy();
        expect(d.alcCatHint[c], `${id}.alcCatHint.${c}`).toBeTruthy();
      }
      for (const i of ALCOHOL_ITEMS) expect(d.alcItem[i.id], `${id}.alcItem.${i.id}`).toBeTruthy();
      expect(d.alcDays, id).toHaveLength(7);
      expect(Object.keys(d.alcItem), id).toHaveLength(ALCOHOL_ITEMS.length);
    }
    expect(new Set(Object.values(ALC_ICON)).size).toBe(ALCOHOL_CATEGORIES.length);
  });

  it('the unit words and templates render in every locale (no leftover placeholders)', () => {
    for (const [id, d] of Object.entries(dicts)) {
      const out = [
        d.alcRowOne('X', '5%', d.alcPint, 3),
        d.alcRowSome('X', '5%'),
        d.alcRowMany(2, 60),
        d.alcStdFoot('unit', 8),
        d.alcStdFoot('drink', 14),
        d.alcDrinksAWeek(5.9, 'unit'),
        d.alcRegionSub('drink', 13.45, d.alcMeasure.metric),
        d.alcRefHigher(196),
        d.alcRefLine,
        d.alcRemoveBody('X'),
        d.alcAbv('5'),
        d.alcDrinks(2, 'drink'),
        d.alcGramsAWeek(59),
      ].join(' | ');
      expect(out, id).not.toMatch(/undefined|NaN|\$\{/);
      expect(d.alcoholDisclaimer.length, id).toBeGreaterThan(80);
    }
  });
});
