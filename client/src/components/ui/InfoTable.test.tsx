import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InfoTable } from './InfoTable';

afterEach(cleanup);

const rows = [
  { id: 'a', label: 'Plan', value: 'Pro' },
  { id: 'b', label: 'Since', value: 'Jan 2026', className: 'is-dim' },
];

describe('InfoTable', () => {
  it('renders a definition list with a term and a definition per row', () => {
    const { container } = render(<InfoTable rows={rows} />);
    expect(container.querySelector('dl')?.className).toBe('uiinfo');
    expect(container.querySelectorAll('dt')).toHaveLength(2);
    expect(container.querySelectorAll('dd')).toHaveLength(2);
    expect(screen.getByText('Plan').tagName).toBe('DT');
    expect(screen.getByText('Pro').tagName).toBe('DD');
  });

  it('puts label and className on the dl', () => {
    const { container } = render(<InfoTable rows={rows} label="Account" className="x" />);
    const dl = container.querySelector('dl') as HTMLElement;
    expect(dl.getAttribute('aria-label')).toBe('Account');
    expect(dl.className).toContain('x');
  });

  it('omits aria-label when none is given', () => {
    const { container } = render(<InfoTable rows={rows} />);
    expect(container.querySelector('dl')?.getAttribute('aria-label')).toBeNull();
  });

  it('applies a per-row class', () => {
    const { container } = render(<InfoTable rows={rows} />);
    const rs = container.querySelectorAll('.uiinfo-row');
    expect(rs[0].className).toBe('uiinfo-row');
    expect(rs[1].className).toBe('uiinfo-row is-dim');
  });

  it('renders nothing inside for empty rows and accepts node values', () => {
    const { container, rerender } = render(<InfoTable rows={[]} />);
    expect(container.querySelectorAll('.uiinfo-row')).toHaveLength(0);
    rerender(<InfoTable rows={[{ id: 'n', label: 'L', value: <b>bold</b> }]} />);
    expect(screen.getByText('bold').tagName).toBe('B');
  });
});
