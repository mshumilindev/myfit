// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
afterEach(cleanup);
import { SkRel } from './SkRel';

describe('SkRel', () => {
  it('renders the text with a decorative link icon', () => {
    const { container } = render(<SkRel>Works with Health</SkRel>);
    expect(screen.getByText('Works with Health').className).toContain('sk-rel');
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });
});
