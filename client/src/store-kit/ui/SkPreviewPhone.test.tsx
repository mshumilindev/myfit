// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkPreviewPhone, SkPvBars, SkPvBox, SkPvProgress } from './SkPreviewPhone';

afterEach(cleanup);

describe('SkPreviewPhone', () => {
  it('is an image with a label, decorative without one', () => {
    const { container, rerender } = render(<SkPreviewPhone label="Preview" caption="Cap" />);
    expect(screen.getByRole('img', { name: 'Preview' })).toBeTruthy();
    rerender(<SkPreviewPhone caption="Cap" />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(container.firstElementChild?.getAttribute('role')).toBeNull();
  });
  it('maps size to a class', () => {
    const { container, rerender } = render(<SkPreviewPhone />);
    expect(container.firstElementChild?.className).not.toContain('sk-phone-d');
    rerender(<SkPreviewPhone size="d" />);
    expect(container.firstElementChild?.className).toContain('sk-phone-d');
  });
  it('renders blocks, bars and progress with custom properties', () => {
    const { container } = render(
      <SkPreviewPhone label="x">
        <SkPvBox tall="chart">
          <SkPvBars values={[10, 90]} />
        </SkPvBox>
        <SkPvProgress value={40} />
      </SkPreviewPhone>,
    );
    expect(container.querySelector('.sk-phone-bx-chart')).toBeTruthy();
    const cols = container.querySelectorAll<HTMLElement>('.sk-phone-col');
    expect(cols).toHaveLength(2);
    expect(cols[1]?.style.getPropertyValue('--sk-pv-h')).toBe('90%');
    expect(
      container
        .querySelector<HTMLElement>('.sk-phone-bar i')
        ?.style.getPropertyValue('--sk-pv-pct'),
    ).toBe('40%');
  });
});
