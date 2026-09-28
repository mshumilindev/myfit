import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Calendar } from './Calendar';
import { dayKeyOf, dayOfTimestamp, timestampOfDay } from './calendarDays';
import { setLocale } from '../../i18n';

const D = (m: number, d: number) => dayKeyOf(2026, m - 1, d);
const TODAY = D(9, 26);
const label = (d: number) =>
  `day ${new Date(timestampOfDay(d)).getMonth() + 1}/${new Date(timestampOfDay(d)).getDate()}`;

beforeEach(() => setLocale('en'));
afterEach(cleanup);

describe('calendarDays', () => {
  it('round-trips local dates through day keys', () => {
    const ts = new Date(2026, 2, 29, 23, 30).getTime(); // around a DST change
    expect(timestampOfDay(dayOfTimestamp(ts))).toBe(new Date(2026, 2, 29).getTime());
  });
});

describe('Calendar', () => {
  it('is an ARIA grid with weekday column headers in the configured order', () => {
    render(<Calendar value={D(9, 25)} today={TODAY} weekStart={7} onSelect={() => undefined} />);
    const grid = screen.getByRole('grid');
    const heads = within(grid).getAllByRole('columnheader');
    expect(heads).toHaveLength(7);
    expect(heads[0].getAttribute('aria-label')).toBe('Sunday');
    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeTruthy();
  });

  it('single mode: selection, today, max-disabled days, markers', () => {
    const onSelect = vi.fn();
    render(
      <Calendar
        value={D(9, 25)}
        today={TODAY}
        max={TODAY}
        dayLabel={label}
        markers={(d) => (d === D(9, 14) ? ['accent', 'rest'] : undefined)}
        onSelect={onSelect}
      />,
    );
    const sel = screen.getByLabelText('day 9/25');
    expect(sel.closest('[role="gridcell"]')?.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('day 9/26').getAttribute('aria-current')).toBe('date');
    expect((screen.getByLabelText('day 9/27') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText('day 9/14').querySelectorAll('.uical-dots i')).toHaveLength(2);
    fireEvent.click(screen.getByLabelText('day 9/20'));
    expect(onSelect).toHaveBeenCalledWith(D(9, 20));
    // No month after the max.
    expect((screen.getByLabelText('Next month') as HTMLButtonElement).disabled).toBe(true);
  });

  it('range mode: band, rounded caps, skipped days and an open end', () => {
    render(
      <Calendar
        mode="range"
        range={{ start: D(9, 24), end: TODAY, open: true }}
        today={TODAY}
        dayLabel={label}
        isSkipped={(d) => d === D(9, 25)}
        onSelect={() => undefined}
      />,
    );
    const cell = (d: number) => screen.getByLabelText(label(d)).closest('.uical-cell')!;
    expect(cell(D(9, 24)).className).toContain('is-solid');
    expect(cell(D(9, 25)).className).toContain('is-skipped');
    expect(cell(D(9, 25)).getAttribute('aria-selected')).toBe('false');
    expect(cell(D(9, 26)).className).toContain('is-open');
    expect(cell(D(9, 23)).getAttribute('aria-selected')).toBe('false');
  });

  it('keyboard: roving focus, skips disabled days, pages across months', () => {
    render(
      <Calendar
        value={D(9, 30)}
        today={TODAY}
        dayLabel={label}
        isDisabled={(d) => d === D(10, 1)}
        onSelect={() => undefined}
      />,
    );
    const start = screen.getByLabelText('day 9/30');
    expect(start.getAttribute('tabindex')).toBe('0');
    start.focus();
    fireEvent.keyDown(start, { key: 'ArrowRight' });
    // 1 Oct is disabled → focus lands on 2 Oct, and the view moved to October.
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeTruthy();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('day 10/2');
    fireEvent.keyDown(document.activeElement!, { key: 'PageUp' });
    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeTruthy();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('day 9/2');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('day 9/9');
  });

  it('two months side by side, presets and footer slots', () => {
    render(
      <Calendar
        value={D(9, 25)}
        today={TODAY}
        months={2}
        presets={<button type="button">{'Yesterday'}</button>}
        footer={<span>{'legend'}</span>}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getAllByRole('grid')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeTruthy();
    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(screen.getByText('legend')).toBeTruthy();
  });

  it('follows a selection that moves outside the visible month (a preset)', () => {
    const { rerender } = render(
      <Calendar value={D(9, 25)} today={TODAY} onSelect={() => undefined} />,
    );
    rerender(<Calendar value={D(8, 3)} today={TODAY} onSelect={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeTruthy();
  });
});
