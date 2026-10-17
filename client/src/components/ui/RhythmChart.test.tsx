import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RhythmChart, type RhythmBar } from './RhythmChart';

afterEach(cleanup);

const bars: RhythmBar[] = [
  { label: 'W-2', value: 3, ariaLabel: 'Two weeks ago: 3 sessions' },
  { label: 'W-1', value: 4, ariaLabel: 'Last week: 4 sessions' },
  { label: 'Now', value: 1, current: true, ariaLabel: 'This week: 1 session' },
];
const props = { bars, plan: 4, label: 'Rhythm', legendDone: 'Sessions', legendPlan: 'Plan' };

describe('RhythmChart', () => {
  it('is a figure named by label with a legend naming both encodings', () => {
    render(<RhythmChart {...props} className="x" />);
    const fig = screen.getByRole('figure', { name: 'Rhythm' });
    expect(fig.className).toContain('x');
    expect(fig.querySelector('figcaption')?.textContent).toContain('Sessions');
    expect(fig.querySelector('figcaption')?.textContent).toContain('Plan');
  });

  it('each bar is a list item with its spoken name', () => {
    render(<RhythmChart {...props} />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((i) => i.getAttribute('aria-label'))).toEqual(bars.map((b) => b.ariaLabel));
  });

  it('bar heights are a share of the auto axis top; values are shown on top', () => {
    const { container } = render(<RhythmChart {...props} />);
    const segs = container.querySelectorAll<HTMLElement>('.uirh-s');
    expect(Array.from(segs).map((s) => s.style.height)).toEqual(['75%', '100%', '25%']);
    expect(Array.from(container.querySelectorAll('.uirh-v')).map((v) => v.textContent)).toEqual([
      '3',
      '4',
      '1',
    ]);
    expect(container.querySelector<HTMLElement>('.uirh-plan')?.style.bottom).toBe('100%');
  });

  it('the y axis shows top, half and zero; auto top rounds up to an even number', () => {
    const { container } = render(
      <RhythmChart {...props} plan={3} bars={[{ label: 'a', value: 5, ariaLabel: 'a' }]} />,
    );
    const ticks = Array.from(container.querySelectorAll('.uirh-y span')).map((s) => s.textContent);
    expect(ticks).toEqual(['6', '3', '0']);
  });

  it('an explicit max wins and caps taller bars at 100%', () => {
    const { container } = render(<RhythmChart {...props} max={2} />);
    const segs = container.querySelectorAll<HTMLElement>('.uirh-s');
    expect(Array.from(segs).map((s) => s.style.height)).toEqual(['100%', '100%', '50%']);
    expect(
      Array.from(container.querySelectorAll('.uirh-y span')).map((s) => s.textContent),
    ).toEqual(['2', '1', '0']);
  });

  it('only the running period is drawn as current; labels sit under the bars', () => {
    const { container } = render(<RhythmChart {...props} />);
    const segs = container.querySelectorAll('.uirh-s');
    expect(Array.from(segs).map((s) => s.classList.contains('is-now'))).toEqual([
      false,
      false,
      true,
    ]);
    expect(
      Array.from(container.querySelectorAll('.uirh-x span')).map((s) => s.textContent),
    ).toEqual(['W-2', 'W-1', 'Now']);
  });

  it('plot height applies to the axis, grid and bars; empty bars still render an axis', () => {
    const { container } = render(<RhythmChart {...props} bars={[]} height={80} />);
    expect(container.querySelector<HTMLElement>('.uirh-c')?.style.height).toBe('80px');
    expect(container.querySelector<HTMLElement>('.uirh-y')?.style.height).toBe('80px');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(container.querySelectorAll('.uirh-y span')).toHaveLength(3);
  });
});
