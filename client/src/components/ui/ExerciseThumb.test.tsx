import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ExerciseThumb } from './ExerciseThumb';

afterEach(cleanup);

describe('ExerciseThumb', () => {
  it('renders a decorative lazy image with the size variable', () => {
    const { container } = render(<ExerciseThumb src="/a.png" size={48} className="x" />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('src')).toBe('/a.png');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.className).toContain('uithumb');
    expect(img.className).toContain('x');
    expect(img.style.getPropertyValue('--uithumb')).toBe('48px');
  });

  it('defaults to 40px', () => {
    const { container } = render(<ExerciseThumb src="/a.png" />);
    expect(
      (container.querySelector('img') as HTMLElement).style.getPropertyValue('--uithumb'),
    ).toBe('40px');
  });

  it('falls back to an outlined icon tile when there is no src', () => {
    const { container } = render(<ExerciseThumb size={32} />);
    expect(container.querySelector('img')).toBeNull();
    const tile = container.querySelector('.uitile') as HTMLElement;
    expect(tile.className).toContain('uitile--outline');
    expect(tile.style.getPropertyValue('--tile')).toBe('32px');
  });

  it('falls back to the tile when the image fails', () => {
    const { container } = render(<ExerciseThumb src="/broken.png" size={56} />);
    fireEvent.error(container.querySelector('img') as HTMLElement);
    expect(container.querySelector('img')).toBeNull();
    expect(
      (container.querySelector('.uitile') as HTMLElement).style.getPropertyValue('--tile'),
    ).toBe('56px');
  });

  it('tries again when src changes after a failure', () => {
    const { container, rerender } = render(<ExerciseThumb src="/broken.png" />);
    fireEvent.error(container.querySelector('img') as HTMLElement);
    rerender(<ExerciseThumb src="/ok.png" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/ok.png');
  });
});
