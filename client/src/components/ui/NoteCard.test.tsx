import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NoteCard, type NoteCardProps } from './NoteCard';

afterEach(cleanup);

const base: NoteCardProps = {
  vis: 'private',
  visLabel: 'Private',
  time: 'Today 08:40',
  text: 'Short note',
};
const long = 'x'.repeat(200);

describe('NoteCard', () => {
  it('private note: neutral class, label, time and a plain paragraph', () => {
    const { container } = render(<NoteCard {...base} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('uinote');
    expect(root.className).toContain('is-private');
    expect(screen.getByText('Private')).toBeTruthy();
    expect(container.querySelector('time')?.textContent).toBe('Today 08:40');
    expect(screen.getByText('Short note').tagName).toBe('P');
  });

  it('shared note gets the shared class; highlighted and className apply', () => {
    const { container } = render(
      <NoteCard {...base} vis="shared" visLabel="Shared with Oleh" highlighted className="x" />,
    );
    const cls = (container.firstChild as HTMLElement).className;
    expect(cls).toContain('is-shared');
    expect(cls).toContain('is-hl');
    expect(cls).toContain('x');
  });

  it('long text with an expandLabel is a toggle button that folds and unfolds', () => {
    render(
      <NoteCard {...base} text={long} expandLabel="Expand" collapseLabel="Collapse" lines={5} />,
    );
    const btn = screen.getByRole('button', { name: 'Expand' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.style.getPropertyValue('--uinote-lines')).toBe('5');
    fireEvent.click(btn);
    const open = screen.getByRole('button', { name: 'Collapse' });
    expect(open.getAttribute('aria-expanded')).toBe('true');
    expect(open.className).toContain('is-open');
    expect(open.style.getPropertyValue('--uinote-lines')).toBe('');
  });

  it('defaults to 3 folded lines; a newline counts as long', () => {
    render(<NoteCard {...base} text={'a\nb'} expandLabel="Expand" collapseLabel="C" />);
    expect(
      screen.getByRole('button', { name: 'Expand' }).style.getPropertyValue('--uinote-lines'),
    ).toBe('3');
  });

  it('long text without expandLabel, or short text, is not a toggle', () => {
    const a = render(<NoteCard {...base} text={long} />);
    expect(screen.queryByRole('button')).toBeNull();
    a.unmount();
    render(<NoteCard {...base} expandLabel="Expand" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('text is rendered as text, never HTML', () => {
    const { container } = render(<NoteCard {...base} text="<b>hi</b>" />);
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText('<b>hi</b>')).toBeTruthy();
  });

  it('editing replaces the text and hides actions', () => {
    render(
      <NoteCard
        {...base}
        editing={<textarea aria-label="edit" />}
        actions={<button>Delete</button>}
      />,
    );
    expect(screen.getByLabelText('edit')).toBeTruthy();
    expect(screen.queryByText('Short note')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('actions render under the note when not editing', () => {
    const { container } = render(<NoteCard {...base} actions={<button>Delete</button>} />);
    expect(screen.getByText('Delete').closest('.uinote-act')).not.toBeNull();
    expect(container.querySelector('.uinote-act')).not.toBeNull();
  });

  it('context with onOpen is a button named label + action; without it, static', () => {
    const onOpen = vi.fn();
    const a = render(
      <NoteCard
        {...base}
        context={{ icon: 'chat', label: 'Squat set', onOpen, actionLabel: 'Jump to message' }}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Squat set. Jump to message' });
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledTimes(1);
    a.unmount();
    const b = render(<NoteCard {...base} context={{ icon: 'chat', label: 'Squat set' }} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(b.container.querySelector('.uinote-ctx')?.className).toContain('is-static');
  });

  it('context button without actionLabel is named by the label only', () => {
    render(
      <NoteCard
        {...base}
        context={{ icon: 'chat', label: 'Squat set', onOpen: () => undefined }}
      />,
    );
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Squat set.');
  });
});
