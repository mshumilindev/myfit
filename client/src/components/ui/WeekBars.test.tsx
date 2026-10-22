import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { WeekBars, type WeekBar } from './WeekBars';

afterEach(cleanup);

const week: WeekBar[] = [
  { tone: 'accent', level: 3 },
  { tone: 'rest', level: 2 },
  { level: 1 },
  { tone: 'sleep', level: 1 },
  { level: 2 },
  { tone: 'ok', level: 3 },
  { level: 1 },
];

describe('WeekBars', () => {
  it('is a decorative wrapper (aria-hidden) with one bar per day', () => {
    const { container } = render(<WeekBars days={week} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toBe('uiwb');
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelectorAll('.uiwb-bar')).toHaveLength(7);
  });

  it('level maps to the height class', () => {
    const { container } = render(<WeekBars days={week} />);
    const bars = container.querySelectorAll('.uiwb-bar');
    expect(bars[0].className).toContain('uiwb-bar--3');
    expect(bars[1].className).toContain('uiwb-bar--2');
    expect(bars[2].className).toContain('uiwb-bar--1');
  });

  it('a day with a tone gets the tone class; one without is the none bar', () => {
    const { container } = render(<WeekBars days={week} />);
    const bars = container.querySelectorAll('.uiwb-bar');
    expect(bars[0].className).toContain('uit--accent');
    expect(bars[0].className).not.toContain('uiwb-bar--none');
    expect(bars[2].className).toContain('uiwb-bar--none');
    expect(bars[2].className).not.toContain('uit--');
  });

  it('appends className and handles an empty week', () => {
    const { container } = render(<WeekBars days={[]} className="extra" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toBe('uiwb extra');
    expect(root.children).toHaveLength(0);
  });
});
