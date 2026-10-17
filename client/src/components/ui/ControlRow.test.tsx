import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ControlRow } from './ControlRow';

afterEach(cleanup);

describe('ControlRow', () => {
  it('is a div at the md step by default and renders its children', () => {
    render(
      <ControlRow data-testid="row">
        <button>one</button>
        <button>two</button>
      </ControlRow>,
    );
    const el = screen.getByTestId('row');
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('ctl-row');
    expect(el.className).toContain('ctl-row--md');
    expect(el.className).not.toContain('ctl-row--end');
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it.each(['xs', 'sm', 'md', 'lg'] as const)('size %s maps to a class', (size) => {
    render(<ControlRow size={size} data-testid="row" />);
    expect(screen.getByTestId('row').className).toContain(`ctl-row--${size}`);
  });

  it('alignEnd adds the end modifier', () => {
    render(<ControlRow alignEnd data-testid="row" />);
    expect(screen.getByTestId('row').className).toContain('ctl-row--end');
  });

  it('keeps kit classes next to a caller className and passes attributes through', () => {
    render(<ControlRow className="mine" role="toolbar" aria-label="Tools" />);
    const el = screen.getByRole('toolbar', { name: 'Tools' });
    expect(el.className).toContain('ctl-row');
    expect(el.className).toContain('mine');
  });
});
