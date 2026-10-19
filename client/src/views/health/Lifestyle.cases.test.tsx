import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import {
  addCondition,
  deleteAlcoholData,
  resetLocalData,
  setAlcoholRegionOverride,
  setNicotineUseInCalculations,
} from '../../store';
import { AlcoholScreens } from './alcohol/AlcoholScreens';
import { AlcoholReferenceSheet } from './alcohol/AlcoholReferenceSheet';
import { NicotineScreens } from './nicotine/NicotineScreens';
import { SupplementScreens } from './supplements/SupplementScreens';
import { decimalsOf, effectsAtFullRamp, numText, useSupplementText } from './supplements/text';
import { ConditionsShield, useActiveConditions } from './ConditionsShield';
import {
  defaultSupplementSettings,
  newSupplementEntry,
  supplementEffectsTypical,
} from '../../supplements';
import { supplementContext } from '../../supplementsApply';
import { supplementItem } from '../../supplementCatalog';

beforeEach(() => {
  setLocale('en');
  resetLocalData();
  deleteAlcoholData();
});
afterEach(cleanup);

describe('lifestyle route switches', () => {
  it('Alcohol: hub, what I drink, usual days and calculations each open their own page and go back', () => {
    const onBack = vi.fn();
    const onOpen = vi.fn();
    const mount = (screenName: 'hub' | 'products' | 'days' | 'calc') =>
      render(<AlcoholScreens screen={screenName} onOpen={onOpen} onBack={onBack} />);
    mount('hub');
    expect(screen.getByText(en.alcTitle)).toBeTruthy();
    fireEvent.click(screen.getByText(en.alcHubUse));
    fireEvent.click(screen.getByText(en.alcHubDays));
    fireEvent.click(screen.getByText(en.nicHubCalc));
    expect(onOpen.mock.calls).toEqual([['products'], ['days'], ['calc']]);
    cleanup();
    mount('products');
    expect(screen.getByText(en.alcHubUse)).toBeTruthy();
    expect(screen.queryByText(en.alcTitle)).toBeNull();
    cleanup();
    mount('days');
    expect(screen.getByText(en.alcDaysIntro)).toBeTruthy();
    cleanup();
    mount('calc');
    expect(screen.getByText(en.nicCalcTitle)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('Nicotine: hub shows whether calculations are on; the other pages open from it', () => {
    const onOpen = vi.fn();
    render(<NicotineScreens screen="hub" onOpen={onOpen} onBack={() => undefined} />);
    expect(screen.getByText(en.nicHubOn)).toBeTruthy();
    act(() => setNicotineUseInCalculations(false));
    expect(screen.getByText(en.nicHubOff)).toBeTruthy();
    fireEvent.click(screen.getByText(en.nicHubUse));
    fireEvent.click(screen.getByText(en.nicHubCalc));
    expect(onOpen.mock.calls).toEqual([['products'], ['calc']]);
    cleanup();
    render(<NicotineScreens screen="products" onOpen={onOpen} onBack={() => undefined} />);
    expect(screen.getByText(en.nicHubUse)).toBeTruthy();
    expect(screen.queryByText(en.nicTitle)).toBeNull();
    cleanup();
    render(<NicotineScreens screen="calc" onOpen={onOpen} onBack={() => undefined} />);
    expect(screen.getByText(en.nicCalcTitle)).toBeTruthy();
  });

  it('Supplements: hub rows open the products and calculation pages', () => {
    const onOpen = vi.fn();
    render(<SupplementScreens screen="hub" onOpen={onOpen} onBack={() => undefined} />);
    expect(screen.getByText(en.supTitle)).toBeTruthy();
    fireEvent.click(screen.getByText(en.supHubUse));
    fireEvent.click(screen.getByText(en.supHubSchedule));
    fireEvent.click(screen.getByText(en.nicHubCalc));
    expect(onOpen.mock.calls).toEqual([['products'], ['products'], ['calc']]);
    cleanup();
    render(<SupplementScreens screen="products" onOpen={onOpen} onBack={() => undefined} />);
    expect(screen.getByText(en.supHubUse)).toBeTruthy();
    cleanup();
    render(<SupplementScreens screen="calc" onOpen={onOpen} onBack={() => undefined} />);
    expect(screen.getByText(en.supCalcTitle)).toBeTruthy();
  });

  it('the supplements page opens the evidence sheet, which closes with Escape, and "Done" goes back', async () => {
    const onBack = vi.fn();
    render(<SupplementScreens screen="products" onOpen={() => undefined} onBack={onBack} />);
    fireEvent.click(screen.getByText(en.supEvidenceRow));
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: en.done }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('AlcoholReferenceSheet', () => {
  it('the US reference also names the higher figure some guidance allows', () => {
    setAlcoholRegionOverride('us');
    render(<AlcoholReferenceSheet onClose={() => undefined} />);
    expect(screen.getByText(en.alcRefHigher(196))).toBeTruthy();
  });

  it('a region without a higher figure leaves that line out', () => {
    setAlcoholRegionOverride('eu');
    render(<AlcoholReferenceSheet onClose={() => undefined} />);
    expect(screen.getByText(en.alcRefTitle)).toBeTruthy();
    expect(screen.queryByText(/Some guidance allows/)).toBeNull();
  });
});

describe('ConditionsShield', () => {
  it('is hidden with no active condition and counts the active ones', () => {
    const open = vi.fn();
    const { container } = render(<ConditionsShield onOpen={open} />);
    expect(container.textContent).toBe('');
    act(() => void addCondition({ key: 'asthma', severity: 1, share: 'off' }));
    cleanup();
    render(<ConditionsShield onOpen={open} />);
    fireEvent.click(screen.getByRole('button', { name: en.cndTodayTitle(1) }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('the rail variant is a rail item with the same label', () => {
    act(() => void addCondition({ key: 'asthma', severity: 1, share: 'off' }));
    render(<ConditionsShield variant="rail" onOpen={() => undefined} />);
    expect(document.querySelector('[aria-label="' + en.cndTodayTitle(1) + '"]')).not.toBeNull();
    expect(renderHook(() => useActiveConditions()).result.current).toBe(1);
  });

  it('a condition that has already ended is not counted, and with only ended ones the shield is hidden', () => {
    const past = Date.now() - 86_400_000;
    act(
      () =>
        void addCondition({
          key: 'asthma',
          severity: 1,
          share: 'off',
          startedAt: past - 86_400_000,
          endsAt: past,
        }),
    );
    expect(renderHook(() => useActiveConditions()).result.current).toBe(0);
    const { container } = render(<ConditionsShield onOpen={() => undefined} />);
    expect(container.textContent).toBe('');
    act(() => void addCondition({ key: 'asthma', severity: 2, share: 'off' }));
    expect(renderHook(() => useActiveConditions()).result.current).toBe(1);
  });
});

describe('supplement text helpers', () => {
  const { result } = renderHook(() => useSupplementText());
  const x = () => result.current;

  it('number text drops trailing zeros and rounds to two places', () => {
    expect(numText(5)).toBe('5');
    expect(numText(1.5)).toBe('1.5');
    expect(numText(0.125)).toBe('0.13');
  });

  it('decimals come from the step and the presets', () => {
    expect(decimalsOf({ step: 1, presets: [3, 5] } as never)).toBe(0);
    expect(decimalsOf({ step: 0.5, presets: [1, 2] } as never)).toBe(1);
    expect(decimalsOf({ step: 1, presets: [0.25] } as never)).toBe(2);
  });

  it('typical text is one dose when the range is a point, a span otherwise, per kg when relative', () => {
    expect(x().typicalText({ typical: [5, 5], unit: 'g' } as never)).toBe(en.supDose.g('5'));
    expect(x().typicalText({ typical: [3, 5], unit: 'g' } as never)).toBe(`3–5 ${en.supUnit.g}`);
    expect(x().typicalText({ typical: [0, 0], typicalPerKg: [0.2, 0.3], unit: 'g' } as never)).toBe(
      `0.2–0.3 ${en.supUnit.g} ${en.supPerKg}`,
    );
    expect(x().typicalText({ typical: [0, 0], typicalPerKg: [0.1, 0.1], unit: 'g' } as never)).toBe(
      `${en.supDose.g('0.1')} ${en.supPerKg}`,
    );
  });

  it('an entry reads "dose · timing", or "training days" when it is scheduled that way', () => {
    const e = newSupplementEntry('creatine', 'a');
    expect(x().entryText(e)).toBe(
      `${x().doseText(e.dose, supplementItem('creatine').unit)} · ${en.supTiming[e.timing]}`,
    );
    expect(x().entryText({ ...e, schedule: 'trainingDays' })).toContain(
      en.supSchedule.trainingDays,
    );
  });

  it('group sub-line: nothing, the doses of up to two, a count for more', () => {
    const list = ['creatine', 'whey', 'caffeine'].map((id, i) =>
      newSupplementEntry(id as never, `e${i}`),
    );
    expect(x().groupSub([])).toBeNull();
    expect(x().groupSub(list.slice(0, 1))).toContain(en.supItemShort.creatine);
    expect(x().groupSub(list.slice(0, 2))).toContain(' · ');
    expect(x().groupSub(list)).toBe(en.supCount(3));
  });

  it('names summary shows two names and "+ N more", skipping inactive and repeated ones', () => {
    const e = (id: string, i: number) => newSupplementEntry(id as never, `e${i}`);
    const list = [
      e('creatine', 0),
      e('whey', 1),
      e('caffeine', 2),
      e('creatine', 3),
      { ...e('hmb', 4), active: false },
    ];
    expect(x().summaryNames(list.slice(0, 2))).toBe(
      `${en.supItemShort.creatine} + ${en.supItemShort.whey}`,
    );
    expect(x().summaryNames(list)).toBe(
      `${en.supItemShort.creatine} + ${en.supItemShort.whey} + ${en.supMore(1)}`,
    );
    expect(x().summaryNames([])).toBe('');
    expect(x().summary([])).toBeNull();
  });

  it('effect values: percent for strength, kg, RPE, minutes and grams, with the sign of the effect', () => {
    expect(x().fxValue('creatineStrength', { low: 0, high: 0.08 })).toBe('+0–8 %');
    expect(x().fxValue('creatineStrength', { low: 0.03, high: 0.03 })).toBe('+3 %');
    expect(x().fxValue('creatineBodyweightKg', { low: 0.5, high: 1.5 })).toBe(
      `+0.5–1.5 ${en.supKg}`,
    );
    expect(x().fxValue('caffeineRpe', { low: -0.5, high: -0.2 })).toBe('−0.2–0.5 RPE');
    expect(x().fxValue('caffeineSleepMin', { low: -10.4, high: -5.2 })).toBe(`−5–10 ${en.supMin}`);
    expect(x().fxValue('proteinGrams', { low: 10, high: 20 })).toBe(`+10–20 ${en.supUnit.g}`);
  });

  it('the full-ramp readout of creatine is a strength range; of an item without effects it is null or empty', () => {
    const fx = effectsAtFullRamp(newSupplementEntry('creatine', 'c'));
    expect(fx).not.toBeNull();
    expect(fx!.creatineStrength.high).toBeGreaterThan(0);
    // fully ramped means more than the first week gives
    const week = supplementEffectsTypical(
      {
        entries: [
          {
            ...newSupplementEntry('creatine', 'c'),
            active: true,
            startedAt: Date.now() - 7 * 86_400_000,
          },
        ],
        checkins: {},
        settings: defaultSupplementSettings(),
      },
      Date.now(),
      supplementContext(Date.now()),
    );
    expect(fx!.creatineStrength.high).toBeGreaterThan(week!.creatineStrength.high);
  });
});
