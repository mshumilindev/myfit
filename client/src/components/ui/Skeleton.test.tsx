import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Skeleton, SkeletonRows } from './Skeleton';

afterEach(cleanup);

describe('Skeleton', () => {
  it('fills its row by default and is hidden from assistive tech', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toBe('uisk');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.style.width).toBe('100%');
    expect(el.style.height).toBe('14px');
  });

  it('numeric width/height become px, strings are used as given', () => {
    const { container } = render(<Skeleton width={96} height="2rem" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('96px');
    expect(el.style.height).toBe('2rem');
  });

  it('round adds the round modifier', () => {
    const { container } = render(<Skeleton round width={36} height={36} />);
    expect((container.firstChild as HTMLElement).className).toContain('uisk--round');
  });

  it('a feature class or style suppresses the default size', () => {
    const { container, rerender } = render(<Skeleton className="skel-cta" />);
    let el = container.firstChild as HTMLElement;
    expect(el.className).toContain('skel-cta');
    expect(el.style.width).toBe('');
    expect(el.style.height).toBe('');
    rerender(<Skeleton style={{ flex: 1, height: 46 }} />);
    el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('46px');
    expect(el.style.width).toBe('');
  });

  it('explicit width wins over style', () => {
    const { container } = render(<Skeleton width={10} style={{ width: 99, opacity: 0.5 }} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('99px');
    expect(el.style.opacity).toBe('0.5');
  });
});

describe('SkeletonRows', () => {
  it('renders three rows by default as a polite labelled status', () => {
    const { container } = render(<SkeletonRows label="Loading" />);
    const status = screen.getByRole('status', { name: 'Loading' });
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(container.querySelectorAll('.uisk-row')).toHaveLength(3);
  });

  it('honours rows and builds a round tile plus two lines per row', () => {
    const { container } = render(<SkeletonRows rows={5} />);
    const rows = container.querySelectorAll('.uisk-row');
    expect(rows).toHaveLength(5);
    expect(rows[0].querySelectorAll('.uisk--round')).toHaveLength(1);
    expect(rows[0].querySelectorAll('.uisk-lines .uisk')).toHaveLength(2);
  });

  it('rows=0 renders an empty status', () => {
    const { container } = render(<SkeletonRows rows={0} />);
    expect(container.querySelectorAll('.uisk-row')).toHaveLength(0);
  });
});
