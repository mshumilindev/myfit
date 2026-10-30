import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BarChart, type BarChartBar } from './BarChart';

afterEach(cleanup);

const bars: BarChartBar[] = [
  { label: '6 Oct – 12 Oct', valueText: 'No workouts', value: 0, tone: 'muted' },
  { label: '13 Oct – 19 Oct', valueText: '4.0 t', value: 4000, tone: 'accent-700' },
  { label: '20 Oct – 26 Oct', valueText: '8.0 t', value: 8000, tone: 'accent' },
];
const cells = () => screen.getAllByRole('button');
const tip = (c: HTMLElement) => c.querySelector('.uibc-tip') as HTMLElement;

describe('BarChart', () => {
  it('is a labelled group with one button per bar, spoken as period + value', () => {
    const { container } = render(<BarChart bars={bars} label="Volume this week" />);
    expect(screen.getByRole('group', { name: 'Volume this week' })).toBeTruthy();
    expect(cells().map((c) => c.getAttribute('aria-label'))).toEqual([
      '6 Oct – 12 Oct, No workouts',
      '13 Oct – 19 Oct, 4.0 t',
      '20 Oct – 26 Oct, 8.0 t',
    ]);
    expect(container.querySelectorAll('.uibc-bar--accent-700')).toHaveLength(1);
  });

  it('scales heights to the biggest value with a 4% floor', () => {
    const { container } = render(<BarChart bars={bars} label="v" />);
    const h = [...container.querySelectorAll<HTMLElement>('.uibc-bar')].map((b) => b.style.height);
    expect(h).toEqual(['4%', '50%', '100%']);
  });

  it('tip is hidden until a bar is chosen; a tap shows it and a second tap hides it', () => {
    const { container } = render(<BarChart bars={bars} label="v" />);
    const t = tip(container);
    expect(t.hasAttribute('data-show')).toBe(false);
    fireEvent.click(cells()[1]);
    expect(t.textContent).toContain('13 Oct – 19 Oct');
    expect(t.textContent).toContain('4.0 t');
    expect(cells()[1].getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(cells()[1]);
    expect(cells()[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('focus shows the tip, arrows move between bars, Home/End jump, Esc dismisses', () => {
    const { container } = render(<BarChart bars={bars} label="v" />);
    cells()[0].focus();
    fireEvent.keyDown(cells()[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cells()[1]);
    fireEvent.keyDown(cells()[1], { key: 'End' });
    expect(document.activeElement).toBe(cells()[2]);
    fireEvent.keyDown(cells()[2], { key: 'Home' });
    expect(document.activeElement).toBe(cells()[0]);
    fireEvent.keyDown(cells()[0], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(cells()[0]);
    fireEvent.keyDown(cells()[0], { key: 'Escape' });
    expect(cells()[0].hasAttribute('data-active')).toBe(false);
    expect(tip(container).hasAttribute('data-show')).toBe(false);
  });

  it('only one tab stop (the newest bar by default) and the tip is not read twice', () => {
    const { container } = render(<BarChart bars={bars} label="v" />);
    expect(cells().map((c) => c.tabIndex)).toEqual([-1, -1, 0]);
    expect(tip(container).getAttribute('aria-hidden')).toBe('true');
  });

  it('an outside press unpins the tip', () => {
    render(<BarChart bars={bars} label="v" />);
    fireEvent.click(cells()[2]);
    expect(cells()[2].hasAttribute('data-active')).toBe(true);
    fireEvent.pointerDown(document.body);
    expect(cells()[2].hasAttribute('data-active')).toBe(false);
  });

  it('handles an empty list and all-zero data', () => {
    const { container, rerender } = render(<BarChart bars={[]} label="v" />);
    expect(container.querySelectorAll('.uibc-cell')).toHaveLength(0);
    rerender(<BarChart bars={[{ label: 'a', valueText: 'b', value: 0 }]} label="v" />);
    expect(container.querySelector<HTMLElement>('.uibc-bar')!.style.height).toBe('4%');
  });

  it('moving focus while a bar is pinned shows the newly focused bar', () => {
    const { container } = render(<BarChart bars={bars} label="v" />);
    fireEvent.click(cells()[2]);
    fireEvent.focus(cells()[1]);
    expect(tip(container).textContent).toContain('13 Oct – 19 Oct');
  });
});
