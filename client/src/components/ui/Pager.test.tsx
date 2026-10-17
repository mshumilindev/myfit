import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Pager } from './Pager';

afterEach(cleanup);

describe('Pager', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(<Pager page={0} maxPage={0} onPage={() => undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a 1-based position out of the total in a labelled nav', () => {
    render(<Pager page={1} maxPage={5} onPage={() => undefined} className="x" />);
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(nav.className).toContain('uipager');
    expect(nav.className).toContain('x');
    expect(nav.textContent).toContain('2 / 6');
  });

  it('prev and next go to the neighbouring pages', () => {
    const onPage = vi.fn();
    render(<Pager page={2} maxPage={5} onPage={onPage} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPage).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPage).toHaveBeenLastCalledWith(3);
  });

  it('prev is disabled on the first page', () => {
    render(<Pager page={0} maxPage={3} onPage={() => undefined} />);
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('next is disabled on the last page', () => {
    render(<Pager page={3} maxPage={3} onPage={() => undefined} />);
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
