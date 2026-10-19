import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { LOCALES, setLocale } from '../i18n';
import { resetWeekStart, setWeekStartDay } from '../weekStart';
import { DateField, DurationField, TimePickerField } from './PickerFields';

const en = () => LOCALES.en;
// Tuesday 15 September 2026 (local time): September 1st is a Tuesday.
const NOW = new Date(2026, 8, 15, 12, 0).getTime();

function DateHarness({
  initial,
  max,
  spy,
}: {
  initial: string;
  max?: string;
  spy?: (v: string) => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <>
      <DateField
        value={v}
        max={max}
        onChange={(x) => {
          spy?.(x);
          setV(x);
        }}
      />
      <output data-testid="val">{v}</output>
    </>
  );
}
function TimeHarness({ initial, spy }: { initial: string; spy?: (v: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <TimePickerField
        value={v}
        onChange={(x) => {
          spy?.(x);
          setV(x);
        }}
      />
      <output data-testid="val">{v}</output>
    </>
  );
}
function DurHarness({
  initial,
  max,
  spy,
}: {
  initial: number;
  max?: number;
  spy?: (v: number) => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <>
      <DurationField
        value={v}
        max={max}
        onChange={(x) => {
          spy?.(x);
          setV(x);
        }}
      />
      <output data-testid="val">{v}</output>
    </>
  );
}
const val = () => screen.getByTestId('val').textContent;
const dayBtns = () => [...document.querySelectorAll<HTMLButtonElement>('.cal-grid .cal-day')];
const monthDay = (n: number) =>
  dayBtns().find((b) => !b.classList.contains('muted') && b.textContent === String(n))!;
const openCal = () => fireEvent.click(screen.getByRole('button', { name: en().backfillDate }));

beforeEach(() => {
  setLocale('en');
  resetWeekStart();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetWeekStart();
});

describe('DateField', () => {
  it('shows the ISO value as dd.mm.yyyy, and an empty field for no value', () => {
    const a = render(<DateHarness initial="2026-03-07" />);
    expect((screen.getByPlaceholderText(en().datePlaceholder) as HTMLInputElement).value).toBe(
      '07.03.2026',
    );
    a.unmount();
    render(<DateHarness initial="" />);
    expect((screen.getByPlaceholderText(en().datePlaceholder) as HTMLInputElement).value).toBe('');
  });

  it.each([
    ['03.04.2026', '2026-04-03'],
    ['3.4.2026', '2026-04-03'],
    ['03-04-2026', '2026-04-03'],
    ['03/04/2026', '2026-04-03'],
    ['  29.02.2028 ', '2028-02-29'],
  ])('typing %j commits %j', (typed, iso) => {
    const spy = vi.fn();
    render(<DateHarness initial="2026-09-15" spy={spy} />);
    fireEvent.change(screen.getByPlaceholderText(en().datePlaceholder), {
      target: { value: typed },
    });
    expect(spy).toHaveBeenCalledWith(iso);
  });

  it.each([
    '29.02.2027',
    '31.04.2026',
    '00.01.2026',
    '15.13.2026',
    '15.00.2026',
    '32.01.2026',
    '1.1.26',
    'abc',
    '',
  ])('typing %j is kept as text but never commits', (typed) => {
    const spy = vi.fn();
    render(<DateHarness initial="2026-09-15" spy={spy} />);
    const input = screen.getByPlaceholderText(en().datePlaceholder) as HTMLInputElement;
    fireEvent.change(input, { target: { value: typed } });
    expect(spy).not.toHaveBeenCalled();
    expect(input.value).toBe(typed);
    expect(val()).toBe('2026-09-15');
  });

  it('opens a month dialog (Monday-first by default), toggling aria-expanded, closed on Escape', () => {
    render(<DateHarness initial="2026-09-15" />);
    const toggle = screen.getByRole('button', { name: en().backfillDate });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('September 2026')).toBeTruthy();
    expect([...document.querySelectorAll('.cal-dow span')].map((s) => s.textContent)).toEqual([
      'Mo',
      'Tu',
      'We',
      'Th',
      'Fr',
      'Sa',
      'Su',
    ]);
    const cells = dayBtns();
    expect(cells).toHaveLength(42);
    expect(cells[0].textContent).toBe('31'); // Mon 31 Aug leads the grid
    expect(cells[0].classList.contains('muted')).toBe(true);
    expect(monthDay(15).classList.contains('sel')).toBe(true);
    expect(monthDay(15).classList.contains('today')).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('honours a Sunday-first week start', () => {
    setWeekStartDay(7);
    render(<DateHarness initial="2026-09-15" />);
    openCal();
    expect([...document.querySelectorAll('.cal-dow span')].map((s) => s.textContent)[0]).toBe('Su');
    expect(dayBtns()[0].textContent).toBe('30'); // Sun 30 Aug
  });

  it('picking a day commits it and closes the dialog', () => {
    const spy = vi.fn();
    render(<DateHarness initial="2026-09-15" spy={spy} />);
    openCal();
    fireEvent.click(monthDay(3));
    expect(spy).toHaveBeenCalledWith('2026-09-03');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((screen.getByPlaceholderText(en().datePlaceholder) as HTMLInputElement).value).toBe(
      '03.09.2026',
    );
  });

  it('picking a muted day from the neighbouring month jumps to it', () => {
    render(<DateHarness initial="2026-09-15" />);
    openCal();
    fireEvent.click(dayBtns()[0]); // 31 Aug
    expect(val()).toBe('2026-08-31');
    openCal();
    expect(screen.getByText('August 2026')).toBeTruthy();
  });

  it('month arrows move the view across a year boundary without changing the value', () => {
    render(<DateHarness initial="2026-12-10" />);
    openCal();
    expect(screen.getByText('December 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en().nextAction }));
    expect(screen.getByText('January 2027')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en().previousAction }));
    fireEvent.click(screen.getByRole('button', { name: en().previousAction }));
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(val()).toBe('2026-12-10');
  });

  it('max disables later days and clicking them does nothing', () => {
    const spy = vi.fn();
    render(<DateHarness initial="2026-09-10" max="2026-09-15" spy={spy} />);
    openCal();
    expect(monthDay(15).disabled).toBe(false);
    expect(monthDay(16).disabled).toBe(true);
    fireEvent.click(monthDay(16));
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('without max nothing is disabled', () => {
    render(<DateHarness initial="2026-09-10" />);
    openCal();
    expect(dayBtns().some((b) => b.disabled)).toBe(false);
  });

  it('"Today" selects the current day and closes', () => {
    render(<DateHarness initial="2026-01-01" />);
    openCal();
    expect(screen.getByText('January 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en().today }));
    expect(val()).toBe('2026-09-15');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('an empty value opens on the current month', () => {
    render(<DateHarness initial="" />);
    openCal();
    expect(screen.getByText('September 2026')).toBeTruthy();
    expect(dayBtns().some((b) => b.classList.contains('sel'))).toBe(false);
  });

  it('closes on an outside press but not on a press inside the dialog or on the field', () => {
    render(<DateHarness initial="2026-09-15" />);
    openCal();
    const press = (el: Element) => fireEvent.pointerDown(el);
    press(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    press(screen.getByPlaceholderText(en().datePlaceholder));
    expect(screen.getByRole('dialog')).toBeTruthy();
    press(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('positions the dialog inside the viewport and follows the window size', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 900,
      right: 1100,
      top: 100,
      bottom: 140,
      width: 200,
      height: 40,
    } as DOMRect);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    render(<DateHarness initial="2026-09-15" />);
    openCal();
    const dlg = () => screen.getByRole('dialog') as HTMLElement;
    // popover is 200 wide here: clamped to 1000 - 200 - 8
    expect(dlg().style.left).toBe('792px');
    expect(dlg().style.top).toBe('146px');
    expect(dlg().style.minWidth).toBe('200px');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 });
    act(() => void window.dispatchEvent(new Event('resize')));
    expect(dlg().style.left).toBe('392px');
  });
});

describe('TimePickerField', () => {
  it('shows the value and commits typed times, normalised to HH:MM', () => {
    const spy = vi.fn();
    render(<TimeHarness initial="07:30" spy={spy} />);
    const input = screen.getByPlaceholderText(en().timePlaceholder) as HTMLInputElement;
    expect(input.value).toBe('07:30');
    for (const [typed, out] of [
      ['9:05', '09:05'],
      ['2315', '23:15'],
      ['00:00', '00:00'],
    ] as const) {
      fireEvent.change(input, { target: { value: typed } });
      expect(spy).toHaveBeenLastCalledWith(out);
    }
  });

  it.each(['24:00', '12:60', '1:5', 'noon', '123456'])('typing %j does not commit', (typed) => {
    const spy = vi.fn();
    render(<TimeHarness initial="07:30" spy={spy} />);
    fireEvent.change(screen.getByPlaceholderText(en().timePlaceholder), {
      target: { value: typed },
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('on blur it tidies a valid entry and restores the last good value for an invalid one', () => {
    render(<TimeHarness initial="07:30" />);
    const input = screen.getByPlaceholderText(en().timePlaceholder) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '945' } });
    fireEvent.blur(input);
    expect(input.value).toBe('09:45');
    fireEvent.change(input, { target: { value: '99:99' } });
    fireEvent.blur(input);
    expect(input.value).toBe('09:45');
  });

  it('the popover lists 24 hours and 12 five-minute steps, marking the current ones', () => {
    render(<TimeHarness initial="07:30" />);
    fireEvent.click(screen.getByRole('button', { name: en().backfillStart }));
    const cols = document.querySelectorAll('.time-col');
    expect(cols).toHaveLength(2);
    expect(cols[0].querySelectorAll('.time-opt')).toHaveLength(24);
    expect([...cols[1].querySelectorAll('.time-opt')].map((b) => b.textContent)).toEqual([
      '00',
      '05',
      '10',
      '15',
      '20',
      '25',
      '30',
      '35',
      '40',
      '45',
      '50',
      '55',
    ]);
    expect(cols[0].querySelector('.sel')!.textContent).toBe('07');
    expect(cols[1].querySelector('.sel')!.textContent).toBe('30');
  });

  it('choosing an hour or minute changes only that part and keeps the dialog open', () => {
    const spy = vi.fn();
    render(<TimeHarness initial="07:30" spy={spy} />);
    fireEvent.click(screen.getByRole('button', { name: en().backfillStart }));
    const cols = document.querySelectorAll('.time-col');
    fireEvent.click([...cols[0].querySelectorAll('button')].find((b) => b.textContent === '22')!);
    expect(spy).toHaveBeenLastCalledWith('22:30');
    fireEvent.click([...cols[1].querySelectorAll('button')].find((b) => b.textContent === '05')!);
    expect(spy).toHaveBeenLastCalledWith('22:05');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByPlaceholderText(en().timePlaceholder) as HTMLInputElement).value).toBe(
      '22:05',
    );
  });

  it('an empty value with a minute pick starts from hour 00', () => {
    const spy = vi.fn();
    render(<TimeHarness initial="" spy={spy} />);
    fireEvent.click(screen.getByRole('button', { name: en().backfillStart }));
    const cols = document.querySelectorAll('.time-col');
    fireEvent.click([...cols[1].querySelectorAll('button')].find((b) => b.textContent === '45')!);
    expect(spy).toHaveBeenLastCalledWith('00:45');
  });

  it('toggles and closes with Escape', () => {
    render(<TimeHarness initial="07:30" />);
    const toggle = screen.getByRole('button', { name: en().backfillStart });
    fireEvent.click(toggle);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(toggle);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a value changed from outside is reflected in the text', () => {
    const { rerender } = render(<TimePickerField value="07:30" onChange={() => undefined} />);
    rerender(<TimePickerField value="21:10" onChange={() => undefined} />);
    expect((screen.getByPlaceholderText(en().timePlaceholder) as HTMLInputElement).value).toBe(
      '21:10',
    );
  });
});

describe('DurationField', () => {
  const hours = () => screen.getByLabelText(en().hrShort) as HTMLInputElement;
  const mins = () => screen.getByLabelText(en().minShort) as HTMLInputElement;

  it('splits whole minutes into hours and minutes', () => {
    render(<DurHarness initial={135} />);
    expect(hours().value).toBe('2');
    expect(mins().value).toBe('15');
  });

  it('typing commits total minutes; empty parts count as zero', () => {
    const spy = vi.fn();
    render(<DurHarness initial={0} spy={spy} />);
    fireEvent.change(hours(), { target: { value: '1' } });
    expect(spy).toHaveBeenLastCalledWith(60);
    fireEvent.change(mins(), { target: { value: '30' } });
    expect(spy).toHaveBeenLastCalledWith(90);
    fireEvent.change(hours(), { target: { value: '' } });
    expect(spy).toHaveBeenLastCalledWith(30);
    fireEvent.change(mins(), { target: { value: '' } });
    expect(spy).toHaveBeenLastCalledWith(0);
  });

  it('strips non-digits', () => {
    const spy = vi.fn();
    render(<DurHarness initial={0} spy={spy} />);
    fireEvent.change(hours(), { target: { value: '1a-2' } });
    expect(hours().value).toBe('12');
    expect(spy).toHaveBeenLastCalledWith(720);
  });

  it('clamps minutes to 59 and hours to the maximum', () => {
    const spy = vi.fn();
    render(<DurHarness initial={0} spy={spy} />);
    fireEvent.change(mins(), { target: { value: '99' } });
    expect(spy).toHaveBeenLastCalledWith(59);
    fireEvent.change(hours(), { target: { value: '99' } });
    expect(spy).toHaveBeenLastCalledWith(1440); // 24h cap (59 min dropped by the cap)
  });

  it('honours a custom max', () => {
    const spy = vi.fn();
    render(<DurHarness initial={0} max={150} spy={spy} />);
    fireEvent.change(hours(), { target: { value: '5' } });
    fireEvent.change(mins(), { target: { value: '45' } });
    expect(spy).toHaveBeenLastCalledWith(150);
  });

  it('resyncs the parts when the value changes from outside', () => {
    const { rerender } = render(<DurationField value={60} onChange={() => undefined} />);
    rerender(<DurationField value={95} onChange={() => undefined} />);
    expect(hours().value).toBe('1');
    expect(mins().value).toBe('35');
  });
});
