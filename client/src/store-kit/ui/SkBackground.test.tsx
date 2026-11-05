// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkBackground } from './SkBackground';

afterEach(cleanup);

describe('SkBackground', () => {
  it('is decorative: aria-hidden, nothing focusable', () => {
    const { container } = render(<SkBackground />);
    expect(screen.getByTestId('sk-bg').getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('button,a,input,[tabindex]')).toHaveLength(0);
  });
  it('renders three wave layers of inline SVG filled with currentColor', () => {
    const { container } = render(<SkBackground />);
    const layers = container.querySelectorAll('.sk-wv');
    expect(layers).toHaveLength(3);
    expect(layers[0].className).toContain('sk-wv-1');
    const paths = container.querySelectorAll('.sk-wv-2 svg path');
    expect(paths.length).toBeGreaterThan(1);
    expect(paths[0].getAttribute('fill')).toBe('currentColor');
  });
  it('maps still and contained to classes', () => {
    render(<SkBackground still contained />);
    const c = screen.getByTestId('sk-bg').className;
    expect(c).toContain('sk-bg-still');
    expect(c).toContain('sk-bg-in');
  });
});
