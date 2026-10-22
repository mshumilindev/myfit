import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Hint } from './Hint';

afterEach(cleanup);

describe('Hint', () => {
  it('quiet is a paragraph in the faint text scale', () => {
    render(<Hint>note</Hint>);
    const el = screen.getByText('note');
    expect(el.tagName).toBe('P');
    expect(el.className).toContain('ut-faint');
  });
  it('field is a div with the editor hint class and passes attributes through', () => {
    render(
      <Hint variant="field" data-testid="h">
        hint
      </Hint>,
    );
    const el = screen.getByTestId('h');
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('se-hint');
  });
});
