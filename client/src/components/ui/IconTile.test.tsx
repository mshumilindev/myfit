import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { IconTile, type IconTileSize } from './IconTile';

afterEach(cleanup);

const tile = (c: HTMLElement) => c.firstChild as HTMLElement;

describe('IconTile', () => {
  it('defaults to a neutral 30px decorative tile', () => {
    const { container } = render(<IconTile icon="barbell" />);
    const el = tile(container);
    expect(el.className).toContain('uitile');
    expect(el.className).toContain('uit--neutral');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.style.getPropertyValue('--tile')).toBe('30px');
    expect(el.style.getPropertyValue('--tile-r')).toBe('var(--r-8)');
  });

  it.each([
    [22, 'var(--r-6)'],
    [32, 'var(--r-10)'],
    [40, 'var(--r-12)'],
    [48, 'var(--r-14)'],
    [56, 'var(--r-16)'],
  ] as [IconTileSize, string][])('size %s picks radius %s', (size, r) => {
    const { container } = render(<IconTile icon="barbell" size={size} />);
    expect(tile(container).style.getPropertyValue('--tile')).toBe(`${size}px`);
    expect(tile(container).style.getPropertyValue('--tile-r')).toBe(r);
  });

  it('maps tone to a class and inherit adds none', () => {
    const { container, rerender } = render(<IconTile tone="ok" icon="check" />);
    expect(tile(container).className).toContain('uit--ok');
    rerender(<IconTile tone="inherit" icon="check" />);
    expect(tile(container).className).not.toContain('uit--');
  });

  it('outline adds the outline modifier', () => {
    const { container } = render(<IconTile icon="plus" outline className="x" />);
    expect(tile(container).className).toContain('uitile--outline');
    expect(tile(container).className).toContain('x');
  });

  it('renders children when no icon is given, and the icon wins when both are', () => {
    const { container, rerender } = render(
      <IconTile>
        <svg data-testid="g" />
      </IconTile>,
    );
    expect(container.querySelector('[data-testid="g"]')).not.toBeNull();
    rerender(
      <IconTile icon="barbell">
        <svg data-testid="g" />
      </IconTile>,
    );
    expect(container.querySelector('[data-testid="g"]')).toBeNull();
  });
});
