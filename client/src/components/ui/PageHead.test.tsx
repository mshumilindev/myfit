import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PageHead } from './PageHead';

afterEach(cleanup);

describe('PageHead', () => {
  it('renders the title as an h2 and nothing else on a root page', () => {
    const { container } = render(<PageHead title="History" className="x" />);
    const h = screen.getByRole('heading', { level: 2, name: 'History' });
    expect(h.className).toContain('title-26');
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('uipagehead');
    expect(root.className).toContain('x');
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('.sub')).toBeNull();
    expect(container.querySelector('.uipagehead-a')).toBeNull();
  });

  it('shows the sub line only when given', () => {
    const { container } = render(<PageHead title="T" sub="12 sessions" />);
    expect(container.querySelector('.sub')?.textContent).toBe('12 sessions');
  });

  it('back renders a labelled button that fires, with optional visible text', () => {
    const onClick = vi.fn();
    render(<PageHead title="T" back={{ label: 'Back', text: 'Overview', onClick }} />);
    const btn = screen.getByRole('button', { name: 'Back' });
    expect(btn.className).toContain('uiback--text');
    expect(screen.getByText('Overview')).toBeTruthy();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders actions in their own slot', () => {
    const { container } = render(<PageHead title="T" actions={<button>Save</button>} />);
    expect(screen.getByText('Save').closest('.uipagehead-a')).not.toBeNull();
    expect(container.querySelector('.uipagehead-a')).not.toBeNull();
  });
});
