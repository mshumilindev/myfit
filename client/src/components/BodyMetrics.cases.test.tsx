import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LOCALES, setLocale } from '../i18n';
import type { BodyMetrics } from '../types';

const addWeight = vi.fn();
const editWeight = vi.fn();
const removeWeight = vi.fn();
const updateBodyMetrics = vi.fn();
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  addWeight: (...a: unknown[]) => addWeight(...a),
  editWeight: (...a: unknown[]) => editWeight(...a),
  removeWeight: (...a: unknown[]) => removeWeight(...a),
  updateBodyMetrics: (...a: unknown[]) => updateBodyMetrics(...a),
}));

import { BodyMetricsSection, ProfileCompletionGate, WeightSheet } from './BodyMetrics';

const en = () => LOCALES.en;
const NOW = new Date(2026, 8, 15, 12, 0).getTime(); // Tue 15 Sep 2026, local
const ts = (d: number, h = 8, m = 30) => new Date(2026, 8, d, h, m).getTime();
const w = (id: string, at: number, weight: number) => ({ id, at, weight });
const bm = (over: Partial<BodyMetrics> = {}): BodyMetrics => ({ weights: [], ...over });
const three = [w('a', ts(1), 80), w('b', ts(8), 82), w('c', ts(15), 81.5)];

const section = (data: BodyMetrics, readOnly = false, extra: Record<string, unknown> = {}) =>
  render(<BodyMetricsSection data={data} readOnly={readOnly} {...extra} />);
const sheet = () => document.querySelector('.bm-sheet') as HTMLElement;
const decimalIn = () => sheet().querySelector('input[inputmode=decimal]') as HTMLInputElement;
const saveBtn = () => within(sheet()).getByRole('button', { name: en().save }) as HTMLButtonElement;

beforeEach(() => {
  setLocale('en');
  [addWeight, editWeight, removeWeight, updateBodyMetrics].forEach((m) => m.mockReset());
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('BodyMetricsSection · hero & stats', () => {
  it('without entries shows the empty state and an Add button', () => {
    section(bm());
    expect(screen.getByText(en().bmNoEntries)).toBeTruthy();
    expect(screen.getByText(en().bmNoEntriesBody)).toBeTruthy();
    expect(document.querySelector('.bm-hero')).toBeNull();
    expect(document.querySelector('.bm-entries')).toBeNull();
    expect(document.querySelector('.bm-trend')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en().bmAddWeight }));
    expect(sheet()).toBeTruthy();
  });

  it('read-only empty state offers no Add button', () => {
    section(bm(), true);
    expect(screen.queryByRole('button', { name: en().bmAddWeight })).toBeNull();
  });

  it('shows the latest weigh-in, the change since the first and the gap to goal', () => {
    section(bm({ weights: three, goalWeightKg: 78 }));
    expect(document.querySelector('.bm-hero-weight')!.textContent).toBe('81.5 kg');
    expect(document.querySelector('.bm-hero-when')!.textContent).toMatch(/Sep 15/);
    const delta = document.querySelector('.bm-delta')!;
    expect(delta.textContent).toBe('+1.5 kg');
    expect(delta.classList.contains('up')).toBe(true);
    expect(document.querySelector('.bm-togoal')!.textContent).toBe(en().bmToGoal('3.5 kg'));
  });

  it('weight lost shows a minus sign and the "down" style', () => {
    section(bm({ weights: [w('a', ts(1), 90), w('b', ts(8), 85)] }));
    const delta = document.querySelector('.bm-delta')!;
    expect(delta.textContent).toBe('−5 kg');
    expect(delta.classList.contains('down')).toBe(true);
    expect(document.querySelector('.bm-togoal')).toBeNull(); // no goal set
  });

  it('no delta when the weight is unchanged, and "at goal" within 50 g', () => {
    section(bm({ weights: [w('a', ts(1), 80), w('b', ts(8), 80)], goalWeightKg: 80.04 }));
    expect(document.querySelector('.bm-delta')).toBeNull();
    expect(document.querySelector('.bm-togoal')!.textContent).toBe(en().bmAtGoal);
  });

  it('a gap of 300 g is still a gap, not "at goal"', () => {
    section(bm({ weights: [w('a', ts(1), 80)], goalWeightKg: 80.3 }));
    expect(document.querySelector('.bm-togoal')!.textContent).toBe(en().bmToGoal('0.3 kg'));
  });

  it('a goal below the latest weight and above it both read as a gap', () => {
    section(bm({ weights: [w('a', ts(1), 70)], goalWeightKg: 75 }));
    expect(document.querySelector('.bm-togoal')!.textContent).toBe(en().bmToGoal('5 kg'));
  });

  it('the latest is the newest by time, regardless of array order', () => {
    section(bm({ weights: [w('c', ts(15), 81.5), w('a', ts(1), 80)] }));
    expect(document.querySelector('.bm-hero-weight')!.textContent).toBe('81.5 kg');
  });

  it('the Add button in the hero opens the add sheet', () => {
    section(bm({ weights: three }));
    fireEvent.click(screen.getByRole('button', { name: en().bmAddWeight }));
    expect(within(sheet()).getByRole('heading', { name: en().bmAddWeight })).toBeTruthy();
  });

  it('read-only hides every edit control and shows the role badge', () => {
    section(bm({ weights: three, heightCm: 180, sex: 'male' }), true, {
      roleTag: 'Trainer · view',
    });
    expect(screen.getByText('Trainer · view')).toBeTruthy();
    expect(screen.queryByRole('button', { name: en().bmAddWeight })).toBeNull();
    expect(screen.queryByRole('button', { name: en().bmEditWeight })).toBeNull();
    expect(document.querySelector('.bm-metric input')).toBeNull();
    expect(document.querySelector('.bm-metric-val')!.textContent).toBe('180');
    expect((document.querySelector('input[type=date]') as HTMLInputElement).disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: en().sexFemale }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('read-only falls back to the default badge text, and can hide the badge', () => {
    const a = section(bm(), true);
    expect(screen.getByText(en().bmReadOnly)).toBeTruthy();
    a.unmount();
    section(bm(), true, { showReadOnlyBadge: false });
    expect(screen.queryByText(en().bmReadOnly)).toBeNull();
  });

  it('shows dashes for unset values in read-only mode', () => {
    section(bm(), true);
    const vals = [...document.querySelectorAll('.bm-metric-val')].map((v) => v.textContent);
    expect(vals.every((v) => v === '—')).toBe(true);
  });
});

describe('BodyMetricsSection · BMI', () => {
  it.each([
    [55, '17.0', 'bmBandUnder'],
    [60, '18.5', 'bmBandNormal'],
    [80, '24.7', 'bmBandNormal'],
    [81, '25.0', 'bmBandOver'],
    [96, '29.6', 'bmBandOver'],
    [97, '29.9', 'bmBandOver'],
    [98, '30.2', 'bmBandObese'],
  ] as const)('180 cm at %s kg is BMI %s', (kg, shown, band) => {
    section(bm({ heightCm: 180, weights: [w('a', ts(1), kg)] }));
    expect(document.querySelector('.bm-bmi .bm-metric-val')!.textContent).toBe(shown);
    expect(document.querySelector('.bm-bmi-band')!.textContent).toBe(en()[band]);
  });

  it('is a dash without height or weight', () => {
    const a = section(bm({ weights: three }));
    expect(document.querySelector('.bm-bmi .bm-metric-val')!.textContent).toBe('—');
    expect(document.querySelector('.bm-bmi-band')).toBeNull();
    a.unmount();
    section(bm({ heightCm: 180 }));
    expect(document.querySelector('.bm-bmi .bm-metric-val')!.textContent).toBe('—');
  });
});

describe('BodyMetricsSection · metric inputs', () => {
  const heightInput = () => document.querySelectorAll('.bm-metric input')[0] as HTMLInputElement;

  it('commits a number on blur, accepting a decimal comma', () => {
    section(bm({ heightCm: 180 }));
    expect(heightInput().value).toBe('180');
    fireEvent.change(heightInput(), { target: { value: '181,5' } });
    expect(updateBodyMetrics).not.toHaveBeenCalled(); // only on blur
    fireEvent.blur(heightInput());
    expect(updateBodyMetrics).toHaveBeenCalledWith({ heightCm: 181.5 });
  });

  it.each(['', 'abc'])('clearing or garbage (%j) commits null', (typed) => {
    section(bm({ heightCm: 180 }));
    fireEvent.change(heightInput(), { target: { value: typed } });
    fireEvent.blur(heightInput());
    expect(updateBodyMetrics).toHaveBeenCalledWith({ heightCm: null });
  });

  it('each composition field writes to its own key', () => {
    section(bm());
    const inputs = [...document.querySelectorAll('.bm-comp-grid input')] as HTMLInputElement[];
    expect(inputs).toHaveLength(6);
    const keys = ['bodyFatPct', 'muscleKg', 'goalWeightKg', 'waistCm', 'chestCm', 'hipCm'];
    inputs.forEach((inp, i) => {
      fireEvent.change(inp, { target: { value: String(10 + i) } });
      fireEvent.blur(inp);
      expect(updateBodyMetrics).toHaveBeenLastCalledWith({ [keys[i]]: 10 + i });
    });
  });
});

describe('BodyMetricsSection · about you', () => {
  it('choosing a sex updates the profile', () => {
    section(bm({ sex: 'male' }));
    fireEvent.click(screen.getByRole('button', { name: en().sexFemale }));
    expect(updateBodyMetrics).toHaveBeenCalledWith({ sex: 'female' });
  });

  it('the date of birth is written, or null when cleared', () => {
    section(bm({ dob: '1990-05-01' }));
    const input = document.querySelector('input[type=date]') as HTMLInputElement;
    expect(input.value).toBe('1990-05-01');
    fireEvent.change(input, { target: { value: '1991-02-03' } });
    expect(updateBodyMetrics).toHaveBeenLastCalledWith({ dob: '1991-02-03' });
    fireEvent.change(input, { target: { value: '' } });
    expect(updateBodyMetrics).toHaveBeenLastCalledWith({ dob: null });
  });

  it.each([
    ['1990-09-15', '36 yrs'], // birthday today
    ['1990-09-16', '35 yrs'], // birthday tomorrow
    ['1990-08-31', '36 yrs'],
    ['1990-10-01', '35 yrs'], // later month
  ])('age for a birthday of %s is %s', (dob, label) => {
    section(bm({ dob }));
    expect(document.querySelector('.bm-age')!.textContent).toBe(label);
  });

  it.each([['not-a-date'], ['2030-01-01'], ['1890-01-01'], [null]])('no age for %j', (dob) => {
    section(bm({ dob }));
    expect(document.querySelector('.bm-age')).toBeNull();
  });
});

describe('BodyMetricsSection · trend & entries', () => {
  it('needs two entries for the chart; shows the goal line only with a goal', () => {
    const a = section(bm({ weights: [w('a', ts(1), 80)] }));
    expect(document.querySelector('.bm-chart')).toBeNull();
    a.unmount();
    const b = section(bm({ weights: three }));
    expect(document.querySelector('.bm-chart')).toBeTruthy();
    expect(document.querySelector('.bm-chart-goal')).toBeNull();
    expect(document.querySelectorAll('.bm-chart-dot')).toHaveLength(3);
    expect(document.querySelector('.bm-trend-sub')!.textContent).toBe(en().bmLastN(3));
    b.unmount();
    section(bm({ weights: three, goalWeightKg: 78 }));
    expect(document.querySelector('.bm-chart-goal')).toBeTruthy();
    expect(document.querySelector('.bm-trend-foot')!.textContent).toContain(en().bmGoalKg('78 kg'));
  });

  it('charts only the last 8 entries', () => {
    const many = Array.from({ length: 12 }, (_, i) => w(`m${i}`, ts(1 + i), 80 + i));
    section(bm({ weights: many }));
    expect(document.querySelectorAll('.bm-chart-dot')).toHaveLength(8);
    expect(document.querySelector('.bm-trend-sub')!.textContent).toBe(en().bmLastN(8));
    expect(document.querySelectorAll('.bm-entry')).toHaveLength(12); // the list shows all
  });

  it('a flat series does not break the chart (zero span)', () => {
    section(bm({ weights: [w('a', ts(1), 80), w('b', ts(2), 80)] }));
    const cy = [...document.querySelectorAll('.bm-chart-dot')].map((c) => c.getAttribute('cy'));
    expect(cy.every((v) => Number.isFinite(Number(v)))).toBe(true);
  });

  it('lists entries newest first with the change from the previous one', () => {
    section(bm({ weights: three }));
    const rows = [...document.querySelectorAll('.bm-entry')];
    expect(rows.map((r) => r.querySelector('.bm-entry-w')!.textContent)).toEqual([
      '81.5 kg',
      '82 kg',
      '80 kg',
    ]);
    expect(rows.map((r) => r.querySelector('.bm-entry-d')!.textContent)).toEqual([
      '−0.5 kg',
      '+2 kg',
      '—',
    ]);
    expect(rows[0].querySelector('.bm-entry-d')!.classList.contains('down')).toBe(true);
    expect(rows[1].querySelector('.bm-entry-d')!.classList.contains('up')).toBe(true);
    expect(rows[2].querySelector('.bm-entry-d')!.classList.contains('muted')).toBe(true);
  });

  it('an unchanged weight shows a dash, not +0', () => {
    section(bm({ weights: [w('a', ts(1), 80), w('b', ts(2), 80)] }));
    expect(document.querySelectorAll('.bm-entry-d')[0].textContent).toBe('—');
  });

  it('Edit opens the sheet pre-filled with that entry', () => {
    section(bm({ weights: three }));
    fireEvent.click(screen.getAllByRole('button', { name: en().bmEditWeight })[1]); // the 82 kg row
    expect(within(sheet()).getByRole('heading', { name: en().bmEditWeight })).toBeTruthy();
    expect(decimalIn().value).toBe('82');
    expect(
      (sheet().querySelector('input[placeholder="dd.mm.yyyy"]') as HTMLInputElement).value,
    ).toBe('08.09.2026');
    expect((sheet().querySelector('input[placeholder="hh:mm"]') as HTMLInputElement).value).toBe(
      '08:30',
    );
  });
});

describe('WeightSheet', () => {
  it('adding: defaults to now, Save is disabled until a positive number is typed', () => {
    const onClose = vi.fn();
    render(<WeightSheet state={{ kind: 'add' }} onClose={onClose} />);
    expect(
      (sheet().querySelector('input[placeholder="dd.mm.yyyy"]') as HTMLInputElement).value,
    ).toBe('15.09.2026');
    expect((sheet().querySelector('input[placeholder="hh:mm"]') as HTMLInputElement).value).toBe(
      '12:00',
    );
    for (const bad of ['', '0', '-3', 'abc']) {
      fireEvent.change(decimalIn(), { target: { value: bad } });
      expect(saveBtn().disabled).toBe(true);
    }
    fireEvent.click(saveBtn());
    expect(addWeight).not.toHaveBeenCalled();
    fireEvent.change(decimalIn(), { target: { value: '81,5' } });
    expect(saveBtn().disabled).toBe(false);
    fireEvent.click(saveBtn());
    expect(addWeight).toHaveBeenCalledWith(81.5, NOW);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(within(sheet()).queryByRole('button', { name: en().bmRemove })).toBeNull();
  });

  it('adding with an edited date and time stores that moment', () => {
    render(<WeightSheet state={{ kind: 'add' }} onClose={() => undefined} />);
    fireEvent.change(decimalIn(), { target: { value: '79' } });
    fireEvent.change(sheet().querySelector('input[placeholder="dd.mm.yyyy"]')!, {
      target: { value: '01.09.2026' },
    });
    fireEvent.change(sheet().querySelector('input[placeholder="hh:mm"]')!, {
      target: { value: '06:45' },
    });
    fireEvent.click(saveBtn());
    expect(addWeight).toHaveBeenCalledWith(79, ts(1, 6, 45));
  });

  it('editing saves under the same id, keeping the original time by default', () => {
    const onClose = vi.fn();
    render(<WeightSheet state={{ kind: 'edit', entry: w('b', ts(8), 82) }} onClose={onClose} />);
    fireEvent.change(decimalIn(), { target: { value: '81.2' } });
    fireEvent.click(saveBtn());
    expect(editWeight).toHaveBeenCalledWith('b', 81.2, ts(8));
    expect(addWeight).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('editing offers Remove, which deletes the entry and closes', () => {
    const onClose = vi.fn();
    render(<WeightSheet state={{ kind: 'edit', entry: w('b', ts(8), 82) }} onClose={onClose} />);
    fireEvent.click(within(sheet()).getByRole('button', { name: en().bmRemove }));
    expect(removeWeight).toHaveBeenCalledWith('b');
    expect(onClose).toHaveBeenCalled();
  });

  it('saving from the section closes the sheet', () => {
    section(bm({ weights: three }));
    fireEvent.click(screen.getAllByRole('button', { name: en().bmEditWeight })[0]);
    fireEvent.click(saveBtn());
    expect(editWeight).toHaveBeenCalledWith('c', 81.5, ts(15));
    expect(document.querySelector('.bm-sheet')).toBeNull();
  });
});

describe('ProfileCompletionGate', () => {
  const inputs = () => [...document.querySelectorAll('.body-gate input')] as HTMLInputElement[];
  const done = () => screen.getByRole('button', { name: en().bmGateDone }) as HTMLButtonElement;

  it('is calm setup copy with Done disabled until height and weight are valid', () => {
    render(<ProfileCompletionGate />);
    expect(screen.getByRole('heading', { name: en().bmGateTitle })).toBeTruthy();
    expect(screen.getByText(en().bmGateNote)).toBeTruthy();
    expect(done().disabled).toBe(true);
    fireEvent.change(inputs()[0], { target: { value: '178' } });
    expect(done().disabled).toBe(true);
    fireEvent.change(inputs()[1], { target: { value: '0' } });
    expect(done().disabled).toBe(true);
    fireEvent.change(inputs()[1], { target: { value: 'x' } });
    expect(done().disabled).toBe(true);
    fireEvent.change(inputs()[1], { target: { value: '84,5' } });
    expect(done().disabled).toBe(false);
  });

  it('a non-positive height keeps Done disabled', () => {
    render(<ProfileCompletionGate />);
    fireEvent.change(inputs()[0], { target: { value: '-5' } });
    fireEvent.change(inputs()[1], { target: { value: '80' } });
    expect(done().disabled).toBe(true);
  });

  it('Done saves the height and the first weigh-in at the current moment', () => {
    render(<ProfileCompletionGate />);
    fireEvent.change(inputs()[0], { target: { value: '178' } });
    fireEvent.change(inputs()[1], { target: { value: '84.5' } });
    fireEvent.click(done());
    expect(updateBodyMetrics).toHaveBeenCalledWith({ heightCm: 178 });
    expect(addWeight).toHaveBeenCalledWith(84.5, NOW);
  });
});
