import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';

afterEach(cleanup);

describe('ProgressBar', () => {
  it('is a progressbar with rounded value, label and fill width', () => {
    const { container } = render(<ProgressBar value={42.6} label="Done" />);
    const bar = screen.getByRole('progressbar', { name: 'Done' });
    expect(bar.getAttribute('aria-valuenow')).toBe('43');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect((container.querySelector('.uibar-fill') as HTMLElement).style.width).toBe('42.6%');
  });

  it.each([
    [-20, '0', '0%'],
    [250, '100', '100%'],
  ])('clamps %s', (value, now, width) => {
    const { container } = render(<ProgressBar value={value} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(now);
    expect((container.querySelector('.uibar-fill') as HTMLElement).style.width).toBe(width);
  });

  it('maps tone, height and className', () => {
    render(<ProgressBar value={10} tone="ok" height={10} className="x" />);
    const bar = screen.getByRole('progressbar');
    expect(bar.className).toContain('uit--ok');
    expect(bar.className).toContain('x');
    expect(bar.style.height).toBe('10px');
  });

  it('defaults to accent tone and 6px', () => {
    render(<ProgressBar value={10} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.className).toContain('uit--accent');
    expect(bar.style.height).toBe('6px');
  });

  it('segments render a decorative stack, dropping empty parts', () => {
    const { container } = render(
      <ProgressBar
        value={0}
        segments={[
          { value: 5, tone: 'ok' },
          { value: 0, tone: 'danger' },
          { value: 2, tone: 'neutral' },
        ]}
      />,
    );
    expect(screen.queryByRole('progressbar')).toBeNull();
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('uibar--stack');
    expect(root.getAttribute('aria-hidden')).toBe('true');
    const segs = container.querySelectorAll<HTMLElement>('.uibar-seg');
    expect(segs).toHaveLength(2);
    expect(segs[0].className).toContain('uit--ok');
    expect(segs[0].style.flexGrow).toBe('5');
    expect(segs[1].className).toContain('uit--neutral');
  });
});
