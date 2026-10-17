import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EvidenceChart, type EvidenceTable } from './EvidenceChart';

afterEach(cleanup);

const points = [
  { label: 'w1', value: 100 },
  { label: 'w2', value: 110 },
  { label: 'w3', value: 120 },
];
const base = {
  points,
  xStart: '3 weeks ago',
  xEnd: 'This week',
  unit: 'e1RM, kg',
  ariaLabel: 'Going up',
};
const table: EvidenceTable = {
  caption: 'Numbers',
  head: ['Week', 'kg'],
  rows: [
    ['w1', '100'],
    ['w2', '110'],
  ],
};

describe('EvidenceChart', () => {
  it('draws an svg image with the spoken summary, labels and unit', () => {
    render(<EvidenceChart {...base} />);
    expect(screen.getByRole('img', { name: 'Going up' })).toBeTruthy();
    expect(screen.getByText('3 weeks ago')).toBeTruthy();
    expect(screen.getByText('This week')).toBeTruthy();
    expect(screen.getByText('e1RM, kg').tagName).toBe('FIGCAPTION');
  });

  it('y ticks are the min and max; the path starts at the lowest point', () => {
    const { container } = render(<EvidenceChart {...base} />);
    const ticks = container.querySelectorAll('.uievc-y span');
    expect(ticks[0].textContent).toBe('120');
    expect(ticks[1].textContent).toBe('100');
    expect(container.querySelector('.uievc-line')?.getAttribute('d')).toBe(
      'M0.00 100.00 L50.00 50.00 L100.00 0.00',
    );
  });

  it('marks the last point at the right edge', () => {
    const { container } = render(<EvidenceChart {...base} />);
    const last = container.querySelector('.uievc-last') as HTMLElement;
    expect(last.style.left).toBe('100%');
    expect(last.style.top).toBe('0%');
  });

  it('tone maps to a class; default is neutral', () => {
    const { container, rerender } = render(<EvidenceChart {...base} />);
    expect(container.querySelector('figure')?.className).toContain('uievc--neutral');
    rerender(<EvidenceChart {...base} tone="flag" className="x" />);
    const cn = container.querySelector('figure')?.className as string;
    expect(cn).toContain('uievc--flag');
    expect(cn).toContain('x');
  });

  it('plan draws a dashed reference line and extends the y range', () => {
    const { container, rerender } = render(<EvidenceChart {...base} />);
    expect(container.querySelector('.uievc-plan')).toBeNull();
    rerender(<EvidenceChart {...base} plan={130} />);
    expect(container.querySelector('.uievc-plan')).not.toBeNull();
    expect(container.querySelector('.uievc-y span')?.textContent).toBe('130');
  });

  it('height sets the plot height', () => {
    const { container } = render(<EvidenceChart {...base} height={140} />);
    expect((container.querySelector('.uievc-plot') as HTMLElement).style.height).toBe('140px');
  });

  it('table is always in the DOM, hidden unless tableVisible, and described by the svg', () => {
    const { container, rerender } = render(<EvidenceChart {...base} table={table} />);
    const wrap = () => container.querySelector('.uievc-table') as HTMLElement;
    expect(wrap().className).toContain('visually-hidden');
    expect(screen.getByRole('table', { name: 'Numbers', hidden: true })).toBeTruthy();
    expect(container.querySelector('svg')?.getAttribute('aria-describedby')).toBe(wrap().id);
    rerender(<EvidenceChart {...base} table={table} tableVisible />);
    expect(wrap().className).not.toContain('visually-hidden');
  });

  it('no table means no aria-describedby', () => {
    const { container } = render(<EvidenceChart {...base} />);
    expect(container.querySelector('svg')?.getAttribute('aria-describedby')).toBeNull();
  });

  it('renders the empty slot instead of a chart when empty is given or points < 2', () => {
    const { container, rerender } = render(<EvidenceChart {...base} empty="Not enough data" />);
    expect(screen.getByText('Not enough data')).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();
    rerender(<EvidenceChart {...base} points={[points[0]]} />);
    expect(container.querySelector('.uievc--empty')).not.toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('flat series do not divide by zero', () => {
    const { container } = render(
      <EvidenceChart
        {...base}
        points={[
          { label: 'a', value: 5 },
          { label: 'b', value: 5 },
        ]}
      />,
    );
    expect(container.querySelector('.uievc-line')?.getAttribute('d')).not.toContain('NaN');
  });
});
