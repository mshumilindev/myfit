import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Avatar, initialsOf } from './Avatar';

afterEach(cleanup);

describe('initialsOf', () => {
  it.each([
    ['', '?'],
    ['   ', '?'],
    ['iryna', 'IR'],
    ['x', 'X'],
    ['Iryna Koval', 'IK'],
    ['  oleh   petrovych   shevchenko ', 'OS'],
  ])('initialsOf(%j) = %j', (name, out) => {
    expect(initialsOf(name)).toBe(out);
  });
});

describe('Avatar', () => {
  it('shows initials on the brass gradient when there is no photo', () => {
    render(<Avatar name="Iryna Koval" />);
    const el = screen.getByRole('img', { name: 'Iryna Koval' });
    expect(el.textContent).toBe('IK');
    expect(el.className).toContain('uiav--ini');
    expect(el.querySelector('img')).toBeNull();
  });

  it('shows the photo as a decorative image when src is given; null falls back to initials', () => {
    const { rerender } = render(<Avatar name="Iryna Koval" src="/a.jpg" />);
    const el = screen.getByRole('img', { name: 'Iryna Koval' });
    expect(el.className).toContain('uiav--img');
    const img = el.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/a.jpg');
    expect(img.getAttribute('alt')).toBe('');
    rerender(<Avatar name="Iryna Koval" src={null} />);
    expect(screen.getByRole('img').textContent).toBe('IK');
  });

  it('sizes the disc and scales the font with a floor of 10px', () => {
    const { rerender } = render(<Avatar name="A B" size={100} />);
    let el = screen.getByRole('img');
    expect(el.style.width).toBe('100px');
    expect(el.style.height).toBe('100px');
    expect(el.style.fontSize).toBe('38px');
    rerender(<Avatar name="A B" size={16} />);
    el = screen.getByRole('img');
    expect(el.style.fontSize).toBe('10px');
  });

  it('defaults to 40px, merges className and style, passes attributes through', () => {
    render(<Avatar name="A B" className="extra" style={{ opacity: 0.5 }} data-testid="av" />);
    const el = screen.getByTestId('av');
    expect(el.style.width).toBe('40px');
    expect(el.style.opacity).toBe('0.5');
    expect(el.className).toContain('uiav');
    expect(el.className).toContain('extra');
  });
});
