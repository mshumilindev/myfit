import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StickyActionBar } from './StickyActionBar';

afterEach(cleanup);

describe('StickyActionBar', () => {
  it('defaults to the page variant on the bg surface and wraps children in the actions slot', () => {
    const { container } = render(
      <StickyActionBar>
        <button>Cancel</button>
        <button>Save</button>
      </StickyActionBar>,
    );
    const cls = (container.firstChild as HTMLElement).className;
    expect(cls).toContain('uiab--page');
    expect(cls).toContain('uiab--on-bg');
    const acts = container.querySelector('.uiab-acts') as HTMLElement;
    expect(acts.querySelectorAll('button')).toHaveLength(2);
    expect(container.querySelector('.uiab-note')).toBeNull();
  });

  it('maps panel variant and surface to classes and merges className', () => {
    const { container } = render(
      <StickyActionBar variant="panel" surface="surface" className="x">
        <button>Save</button>
      </StickyActionBar>,
    );
    const cls = (container.firstChild as HTMLElement).className;
    expect(cls).toContain('uiab--panel');
    expect(cls).toContain('uiab--on-surface');
    expect(cls).toContain('x');
  });

  it('renders the note above the buttons', () => {
    const { container } = render(
      <StickyActionBar note="Could not save">
        <button>Save</button>
      </StickyActionBar>,
    );
    const note = screen.getByText('Could not save');
    expect(note.className).toBe('uiab-note');
    const kids = Array.from((container.firstChild as HTMLElement).children);
    expect(kids.indexOf(note)).toBeLessThan(kids.indexOf(container.querySelector('.uiab-acts')!));
  });

  it('children handlers still fire', () => {
    const onSave = vi.fn();
    render(
      <StickyActionBar>
        <button onClick={onSave}>Save</button>
      </StickyActionBar>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
