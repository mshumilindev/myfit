import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { DayBar } from './DayBar';

afterEach(cleanup);

describe('DayBar', () => {
  it('draws one filled part per range, placed by the hour', () => {
    const { container } = render(
      <DayBar
        ranges={[
          [360, 480],
          [1080, 1260],
        ]}
      />,
    );
    const on = container.querySelectorAll<HTMLElement>('.uidb-on');
    expect(on).toHaveLength(2);
    expect(on[0].style.left).toBe('25%');
    expect(on[0].style.width).toBe(`${(2 / 24) * 100}%`);
    expect(on[1].style.left).toBe('75%');
  });
  it('is hidden from a screen reader unless it has a label', () => {
    const { container, rerender } = render(<DayBar ranges={[[360, 480]]} />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    rerender(<DayBar ranges={[[360, 480]]} label="Free 06:00-08:00" />);
    expect(container.firstElementChild?.getAttribute('role')).toBe('img');
    expect(container.firstElementChild?.getAttribute('aria-label')).toBe('Free 06:00-08:00');
  });
  it('an empty day is just the track', () => {
    const { container } = render(<DayBar ranges={[]} />);
    expect(container.querySelectorAll('.uidb-on')).toHaveLength(0);
  });
});
