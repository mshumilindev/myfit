// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkBento } from './SkBento';
import { SkBentoLink, SkBentoTile } from './SkBentoTile';

afterEach(cleanup);

describe('SkBentoTile', () => {
  it('renders slots and is a plain div by default', () => {
    const { container } = render(
      <SkBentoTile eyebrow="E" title="T" body="B" big={7} footer={<span>F</span>} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName).toBe('DIV');
    expect(root.className).toContain('sk-btile-white');
    for (const t of ['E', 'T', 'B', '7', 'F']) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('maps variant, tone, size and span to classes', () => {
    const { container, rerender } = render(<SkBentoTile variant="dark" size="wide" span={2} />);
    expect(container.firstElementChild?.className).toMatch(/sk-btile-dark.*sk-btile-wide.*span2/);
    rerender(<SkBentoTile tone={4} size="hero" />);
    expect(container.firstElementChild?.className).toMatch(/sk-btile-tone.*sk-btile-g4.*hero/);
  });
  it('becomes a real button when clickable', () => {
    const on = vi.fn();
    render(<SkBentoTile onClick={on} title="Browse" label="Browse by goal" />);
    fireEvent.click(screen.getByRole('button', { name: 'Browse by goal' }));
    expect(on).toHaveBeenCalledTimes(1);
  });
  it('makes only the title a button with onTitle', () => {
    const on = vi.fn();
    render(<SkBentoTile title="Sleep" onTitle={on} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sleep' }));
    expect(on).toHaveBeenCalled();
  });
  it('does not nest a title button inside a clickable tile', () => {
    render(<SkBentoTile title="Sleep" onTitle={() => undefined} onClick={() => undefined} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
  it('SkBentoLink is a button only with onClick', () => {
    const { rerender } = render(<SkBentoLink>More</SkBentoLink>);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<SkBentoLink onClick={() => undefined}>More</SkBentoLink>);
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
  });
  it('SkBento sets the column class', () => {
    const { container } = render(<SkBento cols={3}>x</SkBento>);
    expect(container.firstElementChild?.className).toContain('sk-bgrid-c3');
  });
});
