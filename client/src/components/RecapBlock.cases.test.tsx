import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import type { Recap, RecapEntry, RecapRef } from '../recaps';

let entries: RecapEntry[] = [];
let recap: Partial<Recap> = {};
vi.mock('../recaps', async (orig) => ({
  ...(await orig<typeof import('../recaps')>()),
  availableRecaps: () => entries,
  buildRecap: () => recap,
}));
vi.mock('./Muscle', async (orig) => ({
  ...(await orig<typeof import('./Muscle')>()),
  FocusBodyMap: () => <span data-testid="bodymap" />,
}));

import { AllRecapsSheet, RecapBlock } from './RecapBlock';

const ref = (kind: RecapRef['kind'], year: number, index: number): RecapRef => ({
  id:
    kind === 'month' ? `${year}-M${index}` : kind === 'quarter' ? `${year}-Q${index}` : `${year}-Y`,
  kind,
  year,
  index,
  start: 0,
  end: 1,
});
const entry = (r: RecapRef, status: RecapEntry['status'], sessions: number): RecapEntry => ({
  ref: r,
  status,
  sessions,
});

beforeEach(() => {
  setLocale('en');
  entries = [];
  recap = {
    volumeKg: 12400,
    sessions: 14,
    prCount: 3,
    headline: 'steady',
    volumeIsPeak: false,
    growMuscles: [],
  };
});
afterEach(cleanup);

describe('RecapBlock', () => {
  it('renders nothing when there is nothing to show', () => {
    entries = [entry(ref('month', 2026, 8), 'building', 0)];
    const { container } = render(<RecapBlock onOpen={() => undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the ready month as a hero with totals and plays it as a story', () => {
    entries = [entry(ref('month', 2026, 8), 'ready', 14)];
    const onOpen = vi.fn();
    render(<RecapBlock onOpen={onOpen} />);
    expect(screen.getByText('September 2026')).toBeTruthy();
    expect(screen.getByText('A steady month.')).toBeTruthy();
    const stats = document.querySelector('.rc-hero-stats')!;
    expect(stats.textContent).toContain('12t');
    expect(stats.textContent).toContain('14');
    expect(stats.textContent).toContain('3');
    fireEvent.click(screen.getByRole('button', { name: /Play your September/ }));
    expect(onOpen).toHaveBeenLastCalledWith('2026-M8', true);
    fireEvent.click(screen.getByRole('button', { name: 'or read the full recap' }));
    expect(onOpen).toHaveBeenLastCalledWith('2026-M8', false);
  });

  it.each([
    ['highestVolume', 'Your highest-volume month yet.'],
    ['consistency', 'Consistency was the story this month.'],
    ['records', 'A month of new records.'],
    ['comeback', 'Your strongest month in a while.'],
    ['firstPeriod', 'Your first month on Spotter.'],
    ['steady', 'A steady month.'],
  ] as const)('headline %s', (headline, text) => {
    recap = { ...recap, headline };
    entries = [entry(ref('month', 2026, 8), 'ready', 14)];
    render(<RecapBlock onOpen={() => undefined} />);
    expect(screen.getByText(text)).toBeTruthy();
  });

  it('shows an unlock progress card for a thin current month', () => {
    entries = [
      entry(ref('month', 2026, 8), 'building', 2),
      entry(ref('month', 2026, 7), 'ready', 9),
    ];
    // pending first, but a ready month exists -> hero wins
    render(<RecapBlock onOpen={() => undefined} />);
    expect(document.querySelector('.rc-hero--pending')).toBeNull();
    cleanup();
    entries = [entry(ref('month', 2026, 8), 'building', 2)];
    render(<RecapBlock onOpen={() => undefined} />);
    const card = document.querySelector('.rc-hero--pending')!;
    expect(card.textContent).toContain('2 / 6');
    expect((card.querySelector('.rc-rank i') as HTMLElement).style.width).toBe(`${(2 / 6) * 100}%`);
    expect(card.textContent).toContain('September 2026');
  });

  it('caps the unlock bar at 100%', () => {
    entries = [entry(ref('month', 2026, 8), 'building', 9)];
    render(<RecapBlock onOpen={() => undefined} />);
    expect((document.querySelector('.rc-rank i') as HTMLElement).style.width).toBe('100%');
  });

  it('adds the latest ready quarter and the year as compact rows (year dimmed while building)', () => {
    const onOpen = vi.fn();
    entries = [
      entry(ref('month', 2026, 8), 'ready', 14),
      entry(ref('quarter', 2026, 2), 'ready', 30),
      entry(ref('quarter', 2026, 1), 'ready', 20),
      entry(ref('year', 2026, 0), 'building', 40),
    ];
    render(<RecapBlock onOpen={onOpen} />);
    expect(screen.getByText('Q2 2026')).toBeTruthy();
    expect(screen.queryByText('Q1 2026')).toBeNull();
    expect(screen.getByText('Building — 40 sessions so far')).toBeTruthy();
    fireEvent.click(screen.getByText('Q2 2026'));
    expect(onOpen).toHaveBeenCalledWith('2026-Q2', true);
    onOpen.mockClear();
    fireEvent.click(screen.getByText('2026')); // building year: not clickable
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('shows a ready year as playable', () => {
    const onOpen = vi.fn();
    entries = [
      entry(ref('month', 2026, 8), 'ready', 14),
      entry(ref('year', 2025, 0), 'ready', 100),
    ];
    render(<RecapBlock onOpen={onOpen} />);
    fireEvent.click(screen.getByText('2025'));
    expect(onOpen).toHaveBeenCalledWith('2025-Y', true);
    expect(screen.getByText(/100 sessions · 12 t/)).toBeTruthy();
  });

  it('offers "See all" only with more than one entry and opens the sheet', () => {
    entries = [entry(ref('month', 2026, 8), 'ready', 14)];
    const { unmount } = render(<RecapBlock onOpen={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'See all' })).toBeNull();
    unmount();
    entries = [
      entry(ref('month', 2026, 8), 'ready', 14),
      entry(ref('month', 2026, 7), 'ready', 10),
    ];
    render(<RecapBlock onOpen={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'See all' }));
    expect(document.querySelector('.rc-sheet')).toBeTruthy();
  });

  it('shows a block with only a non-ready month that has sessions via the hero card', () => {
    entries = [entry(ref('month', 2026, 8), 'building', 1)];
    render(<RecapBlock onOpen={() => undefined} />);
    expect(screen.getByText('1 / 6')).toBeTruthy();
  });
});

describe('AllRecapsSheet', () => {
  it('lists months (max 3 cards), quarters and years, with peak-month accent', () => {
    recap = { ...recap, volumeIsPeak: true, growMuscles: ['chest'] as never };
    entries = [
      entry(ref('month', 2026, 8), 'ready', 14),
      entry(ref('month', 2026, 7), 'building', 2),
      entry(ref('month', 2026, 6), 'ready', 12),
      entry(ref('month', 2026, 5), 'ready', 12),
      entry(ref('quarter', 2026, 2), 'ready', 30),
      entry(ref('quarter', 2026, 1), 'building', 3),
      entry(ref('year', 2026, 0), 'ready', 99),
    ];
    const onOpen = vi.fn();
    render(<AllRecapsSheet onClose={() => undefined} onOpen={onOpen} />);
    expect(screen.getByText('Monthly')).toBeTruthy();
    expect(screen.getByText('Quarterly')).toBeTruthy();
    expect(screen.getByText('Yearly')).toBeTruthy();
    const cards = document.querySelectorAll('.rc-month-card');
    expect(cards).toHaveLength(3);
    expect(cards[0].className).toContain('accent');
    expect(cards[0].textContent).toContain('12 t · 3 PR');
    expect(cards[1].textContent).toContain('Building — 2 sessions so far');
    fireEvent.click(cards[0]);
    expect(onOpen).toHaveBeenCalledWith('2026-M8', true);
    onOpen.mockClear();
    fireEvent.click(cards[1]); // building -> inert
    expect(onOpen).not.toHaveBeenCalled();
    const sheet = document.querySelector('.rc-sheet') as HTMLElement;
    fireEvent.click(within(sheet).getByText('Q2 2026'));
    expect(onOpen).toHaveBeenCalledWith('2026-Q2', true);
    onOpen.mockClear();
    fireEvent.click(within(sheet).getByText('Q1 2026'));
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByText('2026'));
    expect(onOpen).toHaveBeenCalledWith('2026-Y', true);
  });

  it('omits empty shelves', () => {
    entries = [entry(ref('year', 2026, 0), 'ready', 99)];
    render(<AllRecapsSheet onClose={() => undefined} onOpen={() => undefined} />);
    expect(screen.queryByText('Monthly')).toBeNull();
    expect(screen.queryByText('Quarterly')).toBeNull();
    expect(screen.getByText('Yearly')).toBeTruthy();
  });

  it('keeps non-peak months neutral', () => {
    entries = [entry(ref('month', 2026, 8), 'ready', 14)];
    render(<AllRecapsSheet onClose={() => undefined} onOpen={() => undefined} />);
    expect(document.querySelector('.rc-month-card')!.className).not.toContain('uicard--accent');
  });
});
