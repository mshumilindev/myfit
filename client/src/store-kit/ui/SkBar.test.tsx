// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkBar } from './SkBar';

afterEach(cleanup);

describe('SkBar', () => {
  it('renders children and the optional note', () => {
    render(
      <SkBar note="Hint">
        <button type="button">Install</button>
      </SkBar>,
    );
    expect(screen.getByRole('button', { name: 'Install' })).toBeTruthy();
    expect(screen.getByText('Hint')).toBeTruthy();
  });
  it('has no note element without a note', () => {
    const { container } = render(<SkBar>x</SkBar>);
    expect(container.querySelector('.sk-act-note')).toBeNull();
  });
});
