import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StatStrip } from './StatStrip';

afterEach(cleanup);

const items = [
  { value: 12, label: 'Workouts' },
  { value: '4.2', unit: 'h', label: 'Time', tone: 'ok' as const },
  { value: '80', label: 'Avg', tone: 'sleep' as const },
];

describe('StatStrip', () => {
  it('is a labelled group with one cell per item', () => {
    const { container } = render(<StatStrip items={items} label="Last 30 days" />);
    expect(screen.getByRole('group', { name: 'Last 30 days' })).toBeTruthy();
    expect(container.querySelectorAll('.uiss-cell')).toHaveLength(3);
    expect(screen.getByText('Workouts').className).toBe('uiss-lab');
    expect(screen.getByText('12').className).toContain('uiss-val');
  });

  it('renders the unit inside the value', () => {
    render(<StatStrip items={items} />);
    const unit = screen.getByText('h');
    expect(unit.className).toBe('uiss-unit');
    expect(unit.parentElement?.className).toContain('uiss-val');
  });

  it('tone toggles the toned class on the value only', () => {
    render(<StatStrip items={items} />);
    expect(screen.getByText('12').className).toBe('uiss-val');
    const ok = screen.getByText('4.2').closest('.uiss-val') as HTMLElement;
    expect(ok.className).toContain('is-toned');
    expect(ok.className).toContain('uit--ok');
    expect((screen.getByText('80') as HTMLElement).className).toContain('uit--sleep');
  });

  it('wrapLabels adds the wrap modifier; className is merged', () => {
    const { container, rerender } = render(<StatStrip items={items} />);
    expect((container.firstChild as HTMLElement).className).toBe('uiss');
    rerender(<StatStrip items={items} wrapLabels className="x" />);
    const cls = (container.firstChild as HTMLElement).className;
    expect(cls).toContain('uiss--wrap');
    expect(cls).toContain('x');
  });

  it('renders an empty group for no items', () => {
    const { container } = render(<StatStrip items={[]} />);
    expect(container.querySelectorAll('.uiss-cell')).toHaveLength(0);
  });
});
