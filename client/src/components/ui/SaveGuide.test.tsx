import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaveGuide, useSaveGuide } from './SaveGuide';

afterEach(cleanup);

function Form({ done, onSave }: { done: boolean[]; onSave: () => void }) {
  const guide = useSaveGuide(
    ['Title', 'Weekday'].map((l, i) => ({ id: l, label: l, done: done[i] })),
  );
  return (
    <div>
      <label {...guide.field('Title')} data-testid="title">
        <input aria-label="t" />
      </label>
      <div {...guide.field('Weekday')} data-testid="weekday">
        <input aria-label="w" />
      </div>
      <p data-testid="outside">elsewhere</p>
      <SaveGuide guide={guide} label="Save" heading="Still needed" onSave={onSave} />
    </div>
  );
}

describe('SaveGuide', () => {
  it('stays pressable, raises the flag and dashes only the first missing field', () => {
    const onSave = vi.fn();
    render(<Form done={[true, false]} onSave={onSave} />);
    const btn = screen.getByRole('button', { name: /Save/ });
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    expect(onSave).not.toHaveBeenCalled();
    const flag = screen.getByRole('status').textContent ?? '';
    expect(flag).toContain('Weekday');
    expect(flag).not.toContain('Title');
    expect(screen.getByTestId('weekday').className).toContain('is-hit');
    expect(screen.getByTestId('title').className).not.toContain('is-hit');
  });

  it('a press elsewhere keeps the flag; a press on the dashed field dismisses it and focuses', async () => {
    render(<Form done={[false, false]} onSave={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    fireEvent.click(screen.getByTestId('outside'));
    expect(screen.queryByRole('status')).not.toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId('title'));
    });
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText('t'));
  });

  it('Esc dismisses', () => {
    render(<Form done={[false, false]} onSave={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('is enabled and saves when everything is filled', () => {
    const onSave = vi.fn();
    render(<Form done={[true, true]} onSave={onSave} />);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(btn);
    expect(onSave).toHaveBeenCalledOnce();
  });
});
