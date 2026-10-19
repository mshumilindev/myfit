import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import type { Insight, TrendsResult } from '../trends';
import type { Workout } from '../types';

let result: TrendsResult = { ready: true, weeksTracked: 8, insights: [] };
vi.mock('../trends', async (orig) => ({
  ...(await orig<typeof import('../trends')>()),
  computeTrends: () => result,
}));

import { TrendsView } from './TrendsView';

const W = { id: 'w' } as Workout;
const ins = (key: string, over: Partial<Insight>): Insight => ({
  key,
  type: 'tip',
  level: 'info',
  severity: 1,
  detail: `detail ${key}`,
  ...over,
});

beforeEach(() => {
  setLocale('en');
  result = { ready: true, weeksTracked: 8, insights: [] };
});
afterEach(cleanup);

const view = () => render(<TrendsView finished={[W]} body={{ weights: [] }} />);

describe('TrendsView', () => {
  it('shows the empty state with no finished workouts', () => {
    render(<TrendsView finished={[]} body={{ weights: [] }} />);
    expect(screen.getByText('No trends yet')).toBeTruthy();
  });

  it('asks for more history while the analysis is not ready', () => {
    result = { ready: false, weeksTracked: 1, insights: [ins('a', {})] };
    view();
    expect(screen.getByText('Analysis needs a bit more history')).toBeTruthy();
    expect(document.querySelector('.analysis')).toBeNull();
  });

  it('shows "all clear" when ready with no insights', () => {
    view();
    expect(screen.getByText('All clear')).toBeTruthy();
  });

  it('sorts risks first, then by severity, and trims to a multiple of three', () => {
    result = {
      ready: true,
      weeksTracked: 8,
      insights: [
        ins('good1', { level: 'good', severity: 9 }),
        ins('info1', { level: 'info', severity: 2 }),
        ins('risk-low', { level: 'risk', severity: 1 }),
        ins('warn1', { level: 'warn', severity: 5 }),
        ins('risk-high', { level: 'risk', severity: 7 }),
      ],
    };
    view();
    const cards = [...document.querySelectorAll('.ai-card')];
    // 5 insights -> floor(5/3)*3 = 3 kept
    expect(cards.map((c) => c.querySelector('.ai-detail')!.textContent)).toEqual([
      'detail risk-high',
      'detail risk-low',
      'detail warn1',
    ]);
  });

  it('keeps at least three and at most twelve cards', () => {
    result = {
      ready: true,
      weeksTracked: 8,
      insights: [ins('a', {}), ins('b', {})],
    };
    const { unmount } = view();
    expect(document.querySelectorAll('.ai-card')).toHaveLength(2); // fewer than 3 exist: slice(0,3) of 2
    unmount();
    result = {
      ready: true,
      weeksTracked: 8,
      insights: Array.from({ length: 20 }, (_, i) => ins(`k${i}`, { severity: i })),
    };
    view();
    expect(document.querySelectorAll('.ai-card')).toHaveLength(12);
  });

  it('renders a balance card: bars scale to the larger side and the low side is flagged', () => {
    result = {
      ready: true,
      weeksTracked: 8,
      insights: [
        ins('bal', {
          type: 'balance',
          level: 'risk',
          attention: true,
          kicker: 'Push vs pull',
          headline: 'Pull is behind',
          aLabel: 'Push',
          bLabel: 'Pull',
          aVal: 20,
          bVal: 10,
          lowSide: 'b',
        }),
        ins('x1', {}),
        ins('x2', {}),
      ],
    };
    view();
    const card = document.querySelector('.ai-balance') as HTMLElement;
    expect(card.className).toContain('attention');
    expect(card.className).toContain('uicard--danger');
    expect(card.querySelector('.ai-kicker')!.textContent).toBe('Push vs pull');
    expect(card.querySelector('.ai-badge')!.textContent).toBe('Risk');
    const fills = [...card.querySelectorAll('.ai-bar-fill')] as HTMLElement[];
    expect(fills.map((f) => f.style.width)).toEqual(['100%', '50%']);
    expect(fills.map((f) => f.classList.contains('low'))).toEqual([false, true]);
  });

  it('balance card with no values does not divide by zero', () => {
    result = {
      ready: true,
      weeksTracked: 8,
      insights: [ins('bal', { type: 'balance' }), ins('x1', {}), ins('x2', {})],
    };
    view();
    const fills = [...document.querySelectorAll('.ai-balance .ai-bar-fill')] as HTMLElement[];
    expect(fills.map((f) => f.style.width)).toEqual(['0%', '0%']);
  });

  it('renders a muscle list with the worst muscle highlighted and fractions clamped', () => {
    result = {
      ready: true,
      weeksTracked: 8,
      insights: [
        ins('ml', {
          type: 'muscleList',
          muscles: [
            { label: 'Chest', frac: 1.7, worst: false },
            { label: 'Calves', frac: -0.4, worst: true },
          ],
        }),
        ins('x1', {}),
        ins('x2', {}),
      ],
    };
    view();
    const rows = [...document.querySelectorAll('.ai-row')];
    expect(rows.map((r) => r.querySelector('.ai-row-lab')!.textContent)).toEqual([
      'Chest',
      'Calves',
    ]);
    const fills = rows.map((r) => r.querySelector('.ai-bar-fill') as HTMLElement);
    expect(fills.map((f) => f.style.width)).toEqual(['100%', '0%']);
    expect(fills[1].classList.contains('worst')).toBe(true);
  });

  it('renders a muscle list even with no muscles', () => {
    result = {
      ready: true,
      weeksTracked: 8,
      insights: [ins('ml', { type: 'muscleList' }), ins('x1', {}), ins('x2', {})],
    };
    view();
    expect(document.querySelector('.ai-mlist .ai-rows')!.children).toHaveLength(0);
  });

  it('renders horizon bars relative to the biggest', () => {
    result = {
      ready: true,
      weeksTracked: 8,
      insights: [
        ins('hz', {
          type: 'horizon',
          headline: 'Volume',
          bars: [
            { label: '30d', value: '10 t', raw: 10 },
            { label: '90d', value: '40 t', raw: 40 },
          ],
        }),
        ins('x1', {}),
        ins('x2', {}),
      ],
    };
    view();
    const bars = [...document.querySelectorAll('.ai-hz-bar')] as HTMLElement[];
    expect(bars.map((b) => b.style.height)).toEqual(['25%', '100%']);
    expect([...document.querySelectorAll('.ai-hz-lab')].map((e) => e.textContent)).toEqual([
      '30d',
      '90d',
    ]);
  });

  it('renders a horizon card without bars', () => {
    result = {
      ready: true,
      weeksTracked: 8,
      insights: [ins('hz', { type: 'horizon' }), ins('x1', {}), ins('x2', {})],
    };
    view();
    expect(document.querySelectorAll('.ai-hz-col')).toHaveLength(0);
  });

  it('renders trend cards with hero, signed delta and a sparkline', () => {
    result = {
      ready: true,
      weeksTracked: 8,
      insights: [
        ins('up', {
          type: 'trend',
          level: 'good',
          hero: '82',
          heroUnit: 'kg',
          deltaPct: 5,
          spark: [1, 2, 3],
        }),
        ins('down', {
          type: 'trend',
          level: 'risk',
          hero: '70',
          deltaPct: -12,
          spark: [3, 2, 1],
        }),
        ins('flat', { type: 'trend', level: 'warn', hero: '5', deltaPct: 0, spark: [2, 2] }),
      ],
    };
    view();
    const deltas = [...document.querySelectorAll('.ai-delta')];
    expect(deltas.map((d) => [d.textContent, d.className])).toEqual([
      ['−12%', 'ai-delta neg'],
      ['+0%', 'ai-delta pos'],
      ['+5%', 'ai-delta pos'],
    ]);
    const strokes = [...document.querySelectorAll('.ai-spark polyline')].map((p) =>
      p.getAttribute('stroke'),
    );
    expect(strokes).toEqual(['var(--color-danger)', '#e8933f', 'var(--color-ok)']);
    // first point of a rising series sits at the bottom, last at the top
    const pts = document.querySelector('.ai-trend.lvl-good polyline')!.getAttribute('points')!;
    expect(pts.split(' ')[0]).toBe('2.0,31.0');
    expect(pts.split(' ')[2]).toBe('148.0,3.0');
  });

  it('skips the hero, the delta and a too-short sparkline when absent', () => {
    result = {
      ready: true,
      weeksTracked: 8,
      insights: [ins('t', { type: 'trend', spark: [4] }), ins('x1', {}), ins('x2', {})],
    };
    view();
    expect(document.querySelector('.ai-hero')).toBeNull();
    expect(document.querySelector('.ai-spark')).toBeNull();
  });

  it('uses the accent stroke for an info-level sparkline and hides a null delta', () => {
    result = {
      ready: true,
      weeksTracked: 8,
      insights: [
        ins('t', { type: 'trend', hero: '3', deltaPct: null, spark: [1, 5] }),
        ins('x1', {}),
        ins('x2', {}),
      ],
    };
    view();
    expect(document.querySelector('.ai-spark polyline')!.getAttribute('stroke')).toBe(
      'var(--color-accent)',
    );
    expect(document.querySelector('.ai-delta')).toBeNull();
  });

  it('renders stat cards with unit and delta', () => {
    result = {
      ready: true,
      weeksTracked: 8,
      insights: [
        ins('st', { type: 'stat', hero: '12', heroUnit: 'sessions', deltaPct: -3 }),
        ins('x1', {}),
        ins('x2', {}),
      ],
    };
    view();
    const st = document.querySelector('.ai-stat')!;
    expect(st.querySelector('.ai-stat-unit')!.textContent).toBe('sessions');
    expect(st.querySelector('.ai-delta')!.textContent).toBe('−3%');
  });

  it('renders tip cards with icon and an action link only when both text and href exist', () => {
    result = {
      ready: true,
      weeksTracked: 8,
      insights: [
        ins('tip1', {
          headline: 'Sleep more',
          icon: 'moon',
          action: 'Open sleep',
          actionHref: '#/sleep',
        }),
        ins('tip2', { headline: 'No href', action: 'Dangling' }),
        ins('tip3', { headline: 'Plain' }),
      ],
    };
    view();
    const link = screen.getByRole('link', { name: 'Open sleep' });
    expect(link.getAttribute('href')).toBe('#/sleep');
    expect(screen.queryByText('Dangling')).toBeNull();
    expect(document.querySelectorAll('.ai-tip-icon')).toHaveLength(1);
  });

  it('shows the lead line above the grid', () => {
    result = {
      ready: true,
      weeksTracked: 8,
      insights: [ins('a', {}), ins('b', {}), ins('c', {})],
    };
    view();
    expect(
      screen.getByText('What your training needs — the most lacking thing first.'),
    ).toBeTruthy();
  });
});
