import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ChatChart } from './ChatChart';

afterEach(cleanup);

const D = (d: number) => Date.UTC(2026, 8, d, 12);

describe('ChatChart', () => {
  it('renders nothing for fewer than two points', () => {
    const { container } = render(
      <ChatChart chart={{ title: 'W', unit: 'kg', points: [{ at: D(1), v: 80 }] }} locale="en" />,
    );
    expect(container.firstChild).toBeNull();
    const e = render(<ChatChart chart={{ title: 'W', unit: 'kg', points: [] }} locale="en" />);
    expect(e.container.firstChild).toBeNull();
  });

  it('shows the title, first → last value with unit and a labelled figure', () => {
    render(
      <ChatChart
        chart={{
          title: 'Weight',
          unit: 'kg',
          points: [
            { at: D(1), v: 82.44 },
            { at: D(8), v: 80 },
            { at: D(15), v: 79.26 },
          ],
        }}
        locale="en"
      />,
    );
    expect(screen.getByText('Weight')).toBeTruthy();
    expect(screen.getByText('82.4 kg → 79.3 kg')).toBeTruthy();
    expect(screen.getByLabelText('Weight: 82.4 kg → 79.3 kg')).toBeTruthy();
  });

  it('formats numbers and dates by locale and omits the unit when empty', () => {
    const { container } = render(
      <ChatChart
        chart={{
          title: 'Reps',
          unit: '',
          points: [
            { at: D(1), v: 1234.5 },
            { at: D(3), v: 2000 },
          ],
        }}
        locale="pl"
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('→');
    expect(text).not.toContain('undefined');
    // pl month abbreviation for September
    expect(container.querySelector('.atl-chart-axis')!.textContent).toMatch(/wrz/);
  });

  it('draws one dot per point, the last one larger, and a closed area path', () => {
    const { container } = render(
      <ChatChart
        chart={{
          title: 'T',
          unit: 'x',
          points: [
            { at: D(1), v: 1 },
            { at: D(2), v: 5 },
            { at: D(3), v: 3 },
          ],
        }}
        locale="en"
      />,
    );
    const dots = [...container.querySelectorAll('circle')];
    expect(dots.map((c) => c.getAttribute('r'))).toEqual(['1.8', '1.8', '3.2']);
    // min value sits on the bottom (y = H - pad = 58), max on the top (y = pad = 6)
    expect(dots[0].getAttribute('cy')).toBe('58');
    expect(dots[1].getAttribute('cy')).toBe('6');
    expect(container.querySelector('.atl-chart-area')!.getAttribute('d')).toMatch(/Z$/);
    expect(container.querySelector('.atl-chart-line')!.getAttribute('d')).toMatch(/^M6\.0,58\.0 L/);
  });

  it('draws a flat series mid-height and survives identical timestamps', () => {
    const { container } = render(
      <ChatChart
        chart={{
          title: 'Flat',
          unit: '',
          points: [
            { at: D(1), v: 7 },
            { at: D(1) + 1, v: 7 },
          ],
        }}
        locale="en"
      />,
    );
    const ys = [...container.querySelectorAll('circle')].map((c) => c.getAttribute('cy'));
    expect(ys).toEqual(['32', '32']);
    expect(container.innerHTML).not.toContain('NaN');
  });
});
