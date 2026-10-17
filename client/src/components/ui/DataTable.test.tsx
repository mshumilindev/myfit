import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { DataTable, type DataTableColumn } from './DataTable';

afterEach(cleanup);

interface Row {
  id: string;
  lift: string;
  kg: number;
  target: string;
}

const rows: Row[] = [
  { id: 'a', lift: 'Squat', kg: 100, target: '105' },
  { id: 'b', lift: 'Bench', kg: 80, target: '82.5' },
];

const columns: DataTableColumn<Row>[] = [
  { id: 'lift', header: 'Lift', strong: true, cell: (r) => r.lift },
  { id: 'target', header: 'Target', muted: true, cell: (r) => r.target },
  { id: 'kg', header: 'Weight', align: 'end', cell: (r) => `${r.kg} kg` },
];

const base = { label: 'Lifts', columns, rows, rowKey: (r: Row) => r.id };

describe('DataTable', () => {
  it('renders a real table with column headers and one row per item', () => {
    render(<DataTable {...base} />);
    const table = screen.getByRole('table', { name: 'Lifts' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(3);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('Squat')).toBeTruthy();
    expect(within(table).getByText('80 kg')).toBeTruthy();
  });

  it('wraps the table in a focusable labelled scroll region', () => {
    render(<DataTable {...base} />);
    const region = screen.getByRole('region', { name: 'Lifts' });
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(region.className).toContain('uidt-scroll');
  });

  it('encodes align, strong and muted on the cells', () => {
    render(<DataTable {...base} />);
    const cells = screen.getAllByRole('row')[1].querySelectorAll('td');
    expect(cells[0].className).toBe('is-strong');
    expect(cells[1].className).toBe('is-muted');
    expect(cells[2].className).toBe('is-end');
    expect(screen.getByText('Weight').className).toBe('is-end');
    expect(screen.getByText('Lift').className).toBe('');
  });

  it('bare drops the card chrome', () => {
    const { container } = render(<DataTable {...base} bare className="x" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('uidt--bare');
    expect(root.className).toContain('x');
  });

  it('non-bare sits in a card', () => {
    const { container } = render(<DataTable {...base} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('uidt');
    expect(root.className).not.toContain('uidt--bare');
  });

  it('headless keeps headers in the DOM but visually hidden', () => {
    const { container } = render(<DataTable {...base} headless />);
    expect(container.querySelector('thead')?.className).toBe('visually-hidden');
    expect(screen.getAllByRole('columnheader', { hidden: true })).toHaveLength(3);
  });

  it('shows the footer only when given', () => {
    const { container, rerender } = render(<DataTable {...base} />);
    expect(container.querySelector('.uidt-foot')).toBeNull();
    rerender(<DataTable {...base} footer="All lifts" />);
    expect(container.querySelector('.uidt-foot')?.textContent).toBe('All lifts');
  });

  it('renders only the header row for empty rows', () => {
    render(<DataTable {...base} rows={[]} />);
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });
});
