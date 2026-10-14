import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXPORT_STRINGS } from './ExportMenu.stories';
import { ExportMenu } from './ExportMenu';

const base = {
  strings: EXPORT_STRINGS,
  rows: 3,
  columns: ['Date', 'Session'],
};

afterEach(cleanup);

describe('ExportMenu', () => {
  it('opens a dialog naming rows, columns and the privacy note', () => {
    render(<ExportMenu {...base} onExport={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByRole('dialog', { name: 'Export session history' })).toBeTruthy();
    expect(screen.getByText('3 rows, as shown now.')).toBeTruthy();
    expect(screen.getByText('2 columns: Date, Session')).toBeTruthy();
    expect(screen.getByText(EXPORT_STRINGS.leftOutNone)).toBeTruthy();
  });

  it('names what was left out', () => {
    render(
      <ExportMenu {...base} omitted={['Sets', 'PR']} onExport={() => undefined} defaultOpen />,
    );
    expect(screen.getByText('Left out, not shared with you: Sets, PR.')).toBeTruthy();
  });

  it('exports the current view or all rows and confirms', () => {
    const onExport = vi.fn(() => 'Exported x.csv, 3 rows');
    render(<ExportMenu {...base} rows={3} allRows={9} onExport={onExport} defaultOpen />);
    fireEvent.click(screen.getByRole('radio', { name: /All rows/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(onExport).toHaveBeenCalledWith(true);
    expect(screen.getByText('Exported x.csv, 3 rows')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not offer the choice without filters and disables an empty export', () => {
    render(<ExportMenu {...base} rows={0} onExport={() => undefined} defaultOpen />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect((screen.getByRole('button', { name: 'Export CSV' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
