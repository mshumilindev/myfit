import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  MonthGrid,
  MonthGridLegend,
  MonthMarkerGlyph,
  monthGridDays,
  type MonthGridDay,
} from './MonthGrid';
import { dayKeyOf, ymdOf } from './calendarDays';
import { setLocale } from '../../i18n';

const D = (m: number, d: number) => dayKeyOf(2026, m - 1, d);
const MONTH = D(9, 15);
const TODAY = D(9, 16);

beforeEach(() => setLocale('en'));
afterEach(cleanup);

const dayBtn = (d: number) => document.querySelector(`[data-day="${d}"]`) as HTMLButtonElement;

describe('monthGridDays', () => {
  it('returns whole weeks including neighbour days, starting on the week start', () => {
    const mon = monthGridDays(MONTH, 1);
    expect(mon.length % 7).toBe(0);
    expect(mon).toContain(D(9, 1));
    expect(mon).toContain(D(9, 30));
    // Sept 1 2026 is a Tuesday: Monday-first grid starts on Aug 31
    expect(mon[0]).toBe(D(8, 31));
    const sun = monthGridDays(MONTH, 7);
    expect(sun[0]).toBe(D(8, 30));
    expect(ymdOf(sun[0]).m).not.toBe(ymdOf(MONTH).m);
  });
});

describe('MonthGrid', () => {
  it('is an ARIA grid with seven weekday headers in week-start order', () => {
    render(
      <MonthGrid month={MONTH} day={() => undefined} today={TODAY} weekStart={1} label="Sept" />,
    );
    const grid = screen.getByRole('grid', { name: 'Sept' });
    const heads = within(grid).getAllByRole('columnheader');
    expect(heads).toHaveLength(7);
    expect(heads[0].textContent).toContain('Monday');
    expect(within(grid).getAllByRole('gridcell').length % 7).toBe(0);
  });

  it('week start Sunday puts Sunday first', () => {
    render(<MonthGrid month={MONTH} day={() => undefined} today={TODAY} weekStart={7} />);
    expect(screen.getAllByRole('columnheader')[0].textContent).toContain('Sunday');
  });

  it('marks today with aria-current, the selection with aria-selected and is-sel', () => {
    render(
      <MonthGrid
        month={MONTH}
        day={() => undefined}
        today={TODAY}
        selected={D(9, 20)}
        weekStart={1}
      />,
    );
    expect(dayBtn(TODAY).getAttribute('aria-current')).toBe('date');
    expect(dayBtn(TODAY).className).toContain('is-today');
    expect(dayBtn(D(9, 20)).className).toContain('is-sel');
    expect(dayBtn(D(9, 20)).closest('[role="gridcell"]')?.getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(dayBtn(D(9, 21)).closest('[role="gridcell"]')?.getAttribute('aria-selected')).toBe(
      'false',
    );
  });

  it('dims neighbour-month days and marks future days without a plan', () => {
    render(<MonthGrid month={MONTH} day={() => undefined} today={TODAY} weekStart={1} />);
    expect(dayBtn(D(8, 31)).className).toContain('is-out');
    expect(dayBtn(D(9, 10)).className).not.toContain('is-out');
    expect(dayBtn(D(9, 20)).className).toContain('is-future');
    expect(dayBtn(D(9, 10)).className).not.toContain('is-future');
  });

  it('tint and plan encode into classes and suppress is-future', () => {
    const info: Record<number, MonthGridDay> = {
      [D(9, 20)]: { tint: 'illness' },
      [D(9, 21)]: { plan: 'train' },
      [D(9, 22)]: { plan: 'rest' },
    };
    render(<MonthGrid month={MONTH} day={(d) => info[d]} today={TODAY} weekStart={1} />);
    expect(dayBtn(D(9, 20)).className).toContain('is-tint');
    expect(dayBtn(D(9, 20)).className).toContain('uit--illness');
    expect(dayBtn(D(9, 20)).className).not.toContain('is-future');
    expect(dayBtn(D(9, 21)).className).toContain('is-plan-train');
    expect(dayBtn(D(9, 22)).className).toContain('is-plan-rest');
  });

  it('appends the day label to the accessible date', () => {
    render(
      <MonthGrid
        month={MONTH}
        day={(d) => (d === D(9, 10) ? { label: 'Push day' } : undefined)}
        today={TODAY}
        weekStart={1}
      />,
    );
    expect(dayBtn(D(9, 10)).getAttribute('aria-label')).toMatch(
      /Thursday, September 10, Push day$/,
    );
    expect(dayBtn(D(9, 11)).getAttribute('aria-label')).not.toContain('Push day');
  });

  it('click selects; arrow keys select by day and week', () => {
    const onSelect = vi.fn();
    render(
      <MonthGrid
        month={MONTH}
        day={() => undefined}
        today={TODAY}
        selected={D(9, 10)}
        onSelect={onSelect}
        weekStart={1}
      />,
    );
    fireEvent.click(dayBtn(D(9, 12)));
    expect(onSelect).toHaveBeenLastCalledWith(D(9, 12));
    fireEvent.keyDown(dayBtn(D(9, 10)), { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenLastCalledWith(D(9, 11));
    fireEvent.keyDown(dayBtn(D(9, 10)), { key: 'ArrowLeft' });
    expect(onSelect).toHaveBeenLastCalledWith(D(9, 9));
    fireEvent.keyDown(dayBtn(D(9, 10)), { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenLastCalledWith(D(9, 17));
    fireEvent.keyDown(dayBtn(D(9, 10)), { key: 'ArrowUp' });
    expect(onSelect).toHaveBeenLastCalledWith(D(9, 3));
    onSelect.mockClear();
    fireEvent.keyDown(dayBtn(D(9, 10)), { key: 'a' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('roving tabindex: selected day, else today, else the first of the month', () => {
    const a = render(
      <MonthGrid
        month={MONTH}
        day={() => undefined}
        today={TODAY}
        selected={D(9, 20)}
        weekStart={1}
      />,
    );
    expect(dayBtn(D(9, 20)).tabIndex).toBe(0);
    expect(dayBtn(TODAY).tabIndex).toBe(-1);
    a.unmount();
    const b = render(<MonthGrid month={MONTH} day={() => undefined} today={TODAY} weekStart={1} />);
    expect(dayBtn(TODAY).tabIndex).toBe(0);
    b.unmount();
    render(<MonthGrid month={MONTH} day={() => undefined} today={D(1, 1)} weekStart={1} />);
    expect(dayBtn(D(9, 1)).tabIndex).toBe(0);
  });

  it('sm size draws markers and no chips; lg draws chips, notes, meta, pr and the today tag', () => {
    const info: MonthGridDay = {
      markers: ['workout', 'pr'],
      chips: [{ label: 'Push', tone: 'accent', planned: true }],
      notes: [{ label: 'Rest', tone: 'rest' }, { label: '81.4 kg' }],
      meta: '7h',
      pr: true,
    };
    const sm = render(
      <MonthGrid
        month={MONTH}
        day={(d) => (d === TODAY ? info : undefined)}
        today={TODAY}
        weekStart={1}
        size="sm"
        todayLabel="TODAY"
      />,
    );
    expect(sm.container.querySelectorAll('.uimg-mk')).toHaveLength(2);
    expect(sm.container.querySelector('.uimg-chip')).toBeNull();
    expect(sm.container.querySelector('.uimg-todaytag')).toBeNull();
    expect((sm.container.firstChild as HTMLElement).className).toContain('uimg--sm');
    sm.unmount();
    const lg = render(
      <MonthGrid
        month={MONTH}
        day={(d) => (d === TODAY ? info : undefined)}
        today={TODAY}
        weekStart={1}
        size="lg"
        todayLabel="TODAY"
      />,
    );
    expect((lg.container.firstChild as HTMLElement).className).toContain('uimg--lg');
    expect(lg.container.querySelector('.uimg-marks')).toBeNull();
    const chip = lg.container.querySelector('.uimg-chip') as HTMLElement;
    expect(chip.textContent).toBe('Push');
    expect(chip.className).toContain('uit--accent');
    expect(chip.className).toContain('is-planned');
    const notes = lg.container.querySelectorAll('.uimg-note');
    expect(notes).toHaveLength(2);
    expect(notes[0].className).toContain('is-toned');
    expect(notes[1].className).not.toContain('is-toned');
    expect(lg.container.querySelector('.uimg-meta')?.textContent).toContain('7h');
    expect(lg.container.querySelector('.uimg-mk--pr')).not.toBeNull();
    expect(screen.getByText('TODAY')).toBeTruthy();
  });

  it('lg prefixes the month name on a leading neighbour-month day', () => {
    render(<MonthGrid month={MONTH} day={() => undefined} today={TODAY} weekStart={1} size="lg" />);
    expect(dayBtn(D(8, 31)).querySelector('.uimg-num')?.textContent).toBe('Aug 31');
    expect(dayBtn(D(9, 2)).querySelector('.uimg-num')?.textContent).toBe('2');
  });
});

describe('MonthMarkerGlyph and MonthGridLegend', () => {
  it('pr is a star, others are empty typed glyphs, all decorative', () => {
    const { container } = render(
      <>
        <MonthMarkerGlyph kind="pr" />
        <MonthMarkerGlyph kind="sleep" />
      </>,
    );
    const [pr, sleep] = Array.from(container.querySelectorAll('i'));
    expect(pr.textContent).toBe('★');
    expect(pr.className).toContain('uimg-mk--pr');
    expect(sleep.className).toContain('uimg-mk--sleep');
    expect(sleep.getAttribute('aria-hidden')).toBe('true');
  });

  it('legend is decorative and draws markers, tint swatches and the plan outline', () => {
    const { container } = render(
      <MonthGridLegend
        items={[
          { kind: 'workout', label: 'Workout' },
          { kind: 'tint', tone: 'injury', label: 'Injury' },
          { kind: 'plan', label: 'Planned' },
        ]}
      />,
    );
    expect((container.firstChild as HTMLElement).getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.uimg-mk--workout')).not.toBeNull();
    expect(container.querySelector('.uimg-sw.uit--injury')).not.toBeNull();
    expect(container.querySelector('.uimg-sw.is-plan')).not.toBeNull();
    expect(container.textContent).toContain('Planned');
  });
});
