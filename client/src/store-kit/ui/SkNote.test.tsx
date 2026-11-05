// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
afterEach(cleanup);
import { SkNote } from './SkNote';

describe('SkNote', () => {
  it('info has no tone class and no live role', () => {
    const { container } = render(<SkNote>Hi</SkNote>);
    expect(container.firstElementChild!.className).toBe('sk-note');
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('bad is an alert, warn a status, ok/bad carry tone classes', () => {
    const { rerender } = render(<SkNote tone="bad">x</SkNote>);
    expect(screen.getByRole('alert').className).toContain('sk-bad');
    rerender(<SkNote tone="warn">x</SkNote>);
    expect(screen.getByRole('status').className).toContain('sk-warn');
    rerender(<SkNote tone="ok">x</SkNote>);
    expect(screen.getByText('x').parentElement!.className).toContain('sk-ok');
  });
  it('renders the optional icon', () => {
    const { container } = render(
      <SkNote tone="warn" icon="alert">
        x
      </SkNote>,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
