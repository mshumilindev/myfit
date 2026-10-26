import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PickPhoto, pickPhotoGlyph } from './PickPhoto';

afterEach(cleanup);

describe('pickPhotoGlyph', () => {
  it('chooses the glyph by session type, falling back to the barbell', () => {
    expect(pickPhotoGlyph('warmup')).toBe('flame');
    expect(pickPhotoGlyph('cooldown')).toBe('wind');
    expect(pickPhotoGlyph('cardio')).toBe('heartbeat');
    expect(pickPhotoGlyph('home')).toBe('house');
    expect(pickPhotoGlyph('strength')).toBe('barbell');
    expect(pickPhotoGlyph('something-new')).toBe('barbell');
  });
});

describe('PickPhoto', () => {
  it('shows the picture when there is a src', () => {
    const { container } = render(<PickPhoto src="/markers/warmup.jpg" kind="warmup" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/markers/warmup.jpg');
    expect(container.querySelector('.pickphoto-fallback')).toBeNull();
  });

  it.each([undefined, null, ''])('a missing src (%s) renders the glyph, never nothing', (src) => {
    const { container } = render(
      <PickPhoto src={src} kind="cooldown" fallbackClassName="es-noimg" />,
    );
    expect(container.querySelector('img')).toBeNull();
    const fb = container.querySelector('.pickphoto-fallback')!;
    expect(fb.className).toContain('pickphoto-fallback--cooldown');
    expect(fb.className).toContain('es-noimg');
    expect(fb.querySelector('svg')).toBeTruthy();
  });

  it('a picture that fails to load (onError) is replaced by the glyph', () => {
    const { container } = render(<PickPhoto src="/markers/gone.jpg" kind="cardio" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.pickphoto-fallback--cardio svg')).toBeTruthy();
  });

  it('a new src after a failure is tried again', () => {
    const { container, rerender } = render(<PickPhoto src="/a.jpg" kind="warmup" />);
    fireEvent.error(container.querySelector('img')!);
    rerender(<PickPhoto src="/b.jpg" kind="warmup" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/b.jpg');
  });
});
