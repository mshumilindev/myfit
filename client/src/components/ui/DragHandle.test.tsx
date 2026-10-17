import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DragHandle } from './DragHandle';

afterEach(cleanup);

describe('DragHandle', () => {
  it('is a focusable draggable button with an accessible name', () => {
    render(<DragHandle label="Drag Nudges" />);
    const h = screen.getByRole('button', { name: 'Drag Nudges' });
    expect(h.getAttribute('tabindex')).toBe('0');
    expect(h.getAttribute('draggable')).toBe('true');
    expect(h.getAttribute('aria-roledescription')).toBe('drag handle');
    expect(h.className).toBe('uidrag');
  });

  it('ArrowUp / ArrowDown call onMove with -1 / 1 and prevent default', () => {
    const onMove = vi.fn();
    render(<DragHandle label="Drag" onMove={onMove} />);
    const h = screen.getByRole('button');
    expect(fireEvent.keyDown(h, { key: 'ArrowUp' })).toBe(false);
    fireEvent.keyDown(h, { key: 'ArrowDown' });
    expect(onMove.mock.calls).toEqual([[-1], [1]]);
  });

  it('ignores other keys and works without onMove', () => {
    const onMove = vi.fn();
    const { rerender } = render(<DragHandle label="Drag" onMove={onMove} />);
    expect(fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })).toBe(true);
    expect(onMove).not.toHaveBeenCalled();
    rerender(<DragHandle label="Drag" />);
    expect(fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' })).toBe(true);
  });

  it('fires drag start and end handlers', () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    render(<DragHandle label="Drag" onDragStart={onDragStart} onDragEnd={onDragEnd} />);
    const h = screen.getByRole('button');
    fireEvent.dragStart(h);
    fireEvent.dragEnd(h);
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });

  it('dragging adds is-dragging', () => {
    render(<DragHandle label="Drag" dragging className="c" />);
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('is-dragging');
    expect(cls).toContain('c');
  });

  it('pinned is a hidden, non-interactive pin', () => {
    const { container } = render(<DragHandle label="Drag" pinned onMove={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('is-pinned');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('draggable')).toBeNull();
  });
});
