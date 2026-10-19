import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Calendar, CalendarLegend, fmtCalendarMonth } from './Calendar';
import { dayKeyOf, timestampOfDay } from './calendarDays';
import { setLocale } from '../../i18n';

const D = (m: number, d: number, y = 2026) => dayKeyOf(y, m - 1, d);
const TODAY = D(9, 16); // Wednesday
const lab = (d: number) => {
  const t = new Date(timestampOfDay(d));
  return `d ${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`;
};
const day = (m: number, d: number, y = 2026) =>
  screen.getByLabelText(lab(D(m, d, y))) as HTMLButtonElement;

beforeEach(() => setLocale('en'));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function cal(props: Partial<React.ComponentProps<typeof Calendar>> = {}) {
  const onSelect = vi.fn();
  render(<Calendar today={TODAY} weekStart={1} dayLabel={lab} onSelect={onSelect} {...props} />);
  return onSelect;
}
const key = (el: HTMLElement, k: string) => fireEvent.keyDown(el, { key: k });

describe('Calendar · keyboard', () => {
  it('uses a roving tabindex that starts on the selected day', () => {
    cal({ value: D(9, 10) });
    expect(day(9, 10).tabIndex).toBe(0);
    expect(day(9, 11).tabIndex).toBe(-1);
  });

  it('starts on today without a selection', () => {
    cal();
    expect(day(9, 16).tabIndex).toBe(0);
  });

  it('arrows move by a day and a week and move DOM focus', () => {
    cal({ value: D(9, 10) });
    key(day(9, 10), 'ArrowRight');
    expect(document.activeElement).toBe(day(9, 11));
    key(day(9, 11), 'ArrowDown');
    expect(document.activeElement).toBe(day(9, 18));
    key(day(9, 18), 'ArrowLeft');
    expect(document.activeElement).toBe(day(9, 17));
    key(day(9, 17), 'ArrowUp');
    expect(document.activeElement).toBe(day(9, 10));
    expect(day(9, 10).tabIndex).toBe(0);
  });

  it('Home / End go to the ends of the week (Monday start)', () => {
    cal({ value: D(9, 16) }); // Wednesday
    key(day(9, 16), 'Home');
    expect(document.activeElement).toBe(day(9, 14));
    key(day(9, 14), 'End');
    expect(document.activeElement).toBe(day(9, 20));
  });

  it('Home / End respect a Sunday week start', () => {
    cal({ value: D(9, 16), weekStart: 7 });
    key(day(9, 16), 'Home');
    expect(document.activeElement).toBe(day(9, 13));
    key(day(9, 13), 'End');
    expect(document.activeElement).toBe(day(9, 19));
  });

  it('PageDown/PageUp page by month and clamp to the month length', () => {
    cal({ value: D(1, 31) });
    key(day(1, 31), 'PageDown');
    expect(screen.getByRole('heading', { name: 'February 2026' })).toBeTruthy();
    expect(document.activeElement).toBe(day(2, 28));
    key(day(2, 28), 'PageUp');
    expect(screen.getByRole('heading', { name: 'January 2026' })).toBeTruthy();
    expect(document.activeElement).toBe(day(1, 28));
  });

  it('crossing a month edge with the arrows pages the view', () => {
    cal({ value: D(9, 30) });
    key(day(9, 30), 'ArrowRight');
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeTruthy();
    expect(document.activeElement).toBe(day(10, 1));
    key(day(10, 1), 'ArrowLeft');
    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeTruthy();
    expect(document.activeElement).toBe(day(9, 30));
  });

  it('skips disabled days in the direction of travel', () => {
    cal({ value: D(9, 10), isDisabled: (d) => d === D(9, 11) || d === D(9, 12) });
    key(day(9, 10), 'ArrowRight');
    expect(document.activeElement).toBe(day(9, 13));
    key(day(9, 13), 'ArrowLeft');
    expect(document.activeElement).toBe(day(9, 10));
  });

  it('does not move past max or min', () => {
    cal({ value: D(9, 20), max: D(9, 20), min: D(9, 10) });
    key(day(9, 20), 'ArrowRight');
    expect(document.activeElement).not.toBe(day(9, 21));
    expect(day(9, 21).disabled).toBe(true);
    // everything beyond is disabled -> the move is abandoned, selection stays focusable
    expect(day(9, 20).tabIndex).toBe(0);
  });

  it('ignores unrelated keys without preventing them', () => {
    cal({ value: D(9, 10) });
    const ev = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    day(9, 10).dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    const arrow = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    day(9, 10).dispatchEvent(arrow);
    expect(arrow.defaultPrevented).toBe(true);
  });

  it('clicking selects and makes that day the roving stop', () => {
    const onSelect = cal({ value: D(9, 10) });
    fireEvent.click(day(9, 22));
    expect(onSelect).toHaveBeenCalledWith(D(9, 22));
    expect(day(9, 22).tabIndex).toBe(0);
  });
});

describe('Calendar · navigation', () => {
  it('pages months with the header buttons and restores the roving stop', () => {
    cal({ value: D(9, 10) });
    fireEvent.click(screen.getByLabelText('Next month'));
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Previous month'));
    fireEvent.click(screen.getByLabelText('Previous month'));
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeTruthy();
  });

  it('blocks Previous at min and Next at max', () => {
    cal({ value: D(9, 10), min: D(9, 1), max: D(9, 30) });
    expect((screen.getByLabelText('Previous month') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Next month') as HTMLButtonElement).disabled).toBe(true);
  });

  it('allows paging when min/max lie further out', () => {
    cal({ value: D(9, 10), min: D(7, 1), max: D(11, 30) });
    expect((screen.getByLabelText('Previous month') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText('Next month') as HTMLButtonElement).disabled).toBe(false);
  });

  it('uses custom nav labels and the calendar label', () => {
    cal({ prevLabel: 'Earlier', nextLabel: 'Later', label: 'Pick a day' });
    expect(screen.getByLabelText('Earlier')).toBeTruthy();
    expect(screen.getByLabelText('Later')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Pick a day' })).toBeTruthy();
  });

  it('follows a selection that moves outside the visible month', () => {
    const { rerender } = render(
      <Calendar
        today={TODAY}
        weekStart={1}
        dayLabel={lab}
        value={D(9, 10)}
        onSelect={() => undefined}
      />,
    );
    rerender(
      <Calendar
        today={TODAY}
        weekStart={1}
        dayLabel={lab}
        value={D(12, 3)}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeTruthy();
    // a selection inside the view does not page
    rerender(
      <Calendar
        today={TODAY}
        weekStart={1}
        dayLabel={lab}
        value={D(12, 9)}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeTruthy();
  });

  it('opens on initialDay when given', () => {
    cal({ initialDay: D(3, 5), value: null });
    expect(screen.getByRole('heading', { name: 'March 2026' })).toBeTruthy();
  });

  it('formats the month title per locale', () => {
    expect(fmtCalendarMonth(D(9, 1), 'en')).toBe('September 2026');
    expect(fmtCalendarMonth(D(9, 1), 'pl')).toMatch(/^Wrzesień 2026/);
    expect(fmtCalendarMonth(D(9, 1), 'uk')).toMatch(/^Вересень 2026/);
  });
});

describe('Calendar · range & slots', () => {
  it('range mode opens on the end of a closed range and marks the band edges', () => {
    cal({ mode: 'range', range: { start: D(8, 30), end: D(9, 3) } });
    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeTruthy();
    const cell = (m: number, d: number) => day(m, d).closest('.uical-cell')!;
    expect(cell(9, 3).className).toContain('is-solid');
    expect(cell(9, 2).className).toContain('is-band');
    expect(cell(9, 4).className).not.toContain('is-band');
  });

  it('infers range mode from the range prop', () => {
    cal({ range: { start: D(9, 10), end: D(9, 12) } });
    expect(day(9, 11).closest('.uical-cell')!.className).toContain('is-band');
  });

  it('shows the presets above and the footer below, and caps markers at three', () => {
    cal({
      presets: <span>PRESETS</span>,
      footer: <span>FOOTER</span>,
      markers: (d) => (d === D(9, 5) ? ['accent', 'rest', 'ok', 'danger'] : undefined),
    });
    expect(screen.getByText('PRESETS').parentElement!.className).toBe('uical-presets');
    expect(screen.getByText('FOOTER').parentElement!.className).toBe('uical-footer');
    expect(day(9, 5).querySelectorAll('.uical-dots i')).toHaveLength(3);
  });

  it('renders no presets/footer wrappers when not given', () => {
    cal();
    expect(document.querySelector('.uical-presets')).toBeNull();
    expect(document.querySelector('.uical-footer')).toBeNull();
  });

  it('uses the localized full date as the day label by default', () => {
    render(<Calendar today={TODAY} weekStart={1} onSelect={() => undefined} />);
    expect(screen.getByLabelText('Wednesday, September 16')).toBeTruthy();
  });
});

describe('Calendar · two months', () => {
  let roCb: () => void = () => undefined;
  function stubWidth(w: number) {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          roCb = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => w,
    });
  }
  afterEach(() => {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  });

  it('shows two months side by side when wide, ending on the focus month', () => {
    stubWidth(700);
    cal({ months: 2, value: D(9, 10) });
    expect(screen.getAllByRole('grid')).toHaveLength(2);
    const titles = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(titles).toEqual(['August 2026', 'September 2026']);
    // only the first has Previous, only the last has Next
    expect(screen.getAllByLabelText('Previous month')).toHaveLength(1);
    expect(screen.getAllByLabelText('Next month')).toHaveLength(1);
  });

  it('collapses to one month when the container is narrower than 480px, and reacts to resizes', () => {
    stubWidth(400);
    cal({ months: 2, value: D(9, 10) });
    expect(screen.getAllByRole('grid')).toHaveLength(1);
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 800,
    });
    act(() => roCb());
    expect(screen.getAllByRole('grid')).toHaveLength(2);
  });

  it('keyboard paging before the first visible month shifts the pair', () => {
    stubWidth(700);
    cal({ months: 2, value: D(8, 1) });
    key(day(8, 1), 'ArrowLeft');
    expect(document.activeElement).toBe(day(7, 31));
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'July 2026',
      'August 2026',
    ]);
  });
});

describe('CalendarLegend', () => {
  it('lists a swatch and label per item and is hidden from assistive tech', () => {
    const { container } = render(
      <CalendarLegend
        items={[
          { tone: 'accent', label: 'Workout' },
          { tone: 'rest', label: 'Rest' },
        ]}
      />,
    );
    const root = container.firstElementChild!;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect([...root.children].map((c) => c.textContent)).toEqual(['Workout', 'Rest']);
  });
});
