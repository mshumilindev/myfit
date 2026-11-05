// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkCard } from './SkCard';

afterEach(cleanup);

describe('SkCard', () => {
  it('renders children in a sk-card surface', () => {
    render(<SkCard data-testid="c">hello</SkCard>);
    const c = screen.getByTestId('c');
    expect(c.className).toBe('sk-card');
    expect(c.textContent).toBe('hello');
  });
  it('adds padding class with pad and merges className', () => {
    render(
      <SkCard pad className="extra" data-testid="c">
        x
      </SkCard>,
    );
    expect(screen.getByTestId('c').className).toBe('sk-card sk-card-pad extra');
  });
});
