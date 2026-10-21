import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Textarea } from './Textarea';

afterEach(cleanup);

describe('Textarea', () => {
  it('renders a 4-row textarea inside a label with the label text', () => {
    render(<Textarea label="Notes" />);
    const ta = screen.getByLabelText('Notes') as HTMLTextAreaElement;
    expect(ta.tagName).toBe('TEXTAREA');
    expect(ta.rows).toBe(4);
    expect(ta.className).toContain('uifield-area');
    expect(ta.getAttribute('aria-invalid')).toBeNull();
  });

  it('respects rows and passes native props through', () => {
    const onChange = vi.fn();
    render(
      <Textarea aria-label="n" rows={8} placeholder="Write" maxLength={20} onChange={onChange} />,
    );
    const ta = screen.getByPlaceholderText('Write') as HTMLTextAreaElement;
    expect(ta.rows).toBe(8);
    expect(ta.maxLength).toBe(20);
    fireEvent.change(ta, { target: { value: 'hi' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('shows a hint when there is no error', () => {
    const { container } = render(<Textarea aria-label="n" hint="Optional" />);
    expect(screen.getByText('Optional').className).toContain('uifield-hint');
    expect(container.querySelector('.uifield--err')).toBeNull();
  });

  it('error replaces the hint, is announced, and marks the textarea invalid', () => {
    const { container } = render(<Textarea aria-label="n" hint="Optional" error="Too short" />);
    expect(screen.getByRole('alert').textContent).toBe('Too short');
    expect(screen.queryByText('Optional')).toBeNull();
    expect(container.querySelector('.uifield--err')).not.toBeNull();
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
  });

  it('renders no label span without a label and forwards the ref and className', () => {
    const ref = createRef<HTMLTextAreaElement>();
    const { container } = render(<Textarea ref={ref} aria-label="n" className="wide" disabled />);
    expect(container.querySelector('.uifield-l')).toBeNull();
    expect(container.querySelector('label')?.className).toContain('wide');
    expect(ref.current).toBe(screen.getByRole('textbox'));
    expect(ref.current?.disabled).toBe(true);
  });
});
