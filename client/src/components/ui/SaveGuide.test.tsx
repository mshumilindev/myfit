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

describe('SaveGuide extras', () => {
  it('dismiss() closes the flag and a custom focus runs on the dashed field', async () => {
    const focus = vi.fn();
    function Custom() {
      const guide = useSaveGuide([{ id: 'a', label: 'A', done: false, focus }]);
      return (
        <div>
          <div {...guide.field('a')} data-testid="a" />
          <button onClick={guide.dismiss}>off</button>
          <SaveGuide guide={guide} label="Save" heading="Needed" onSave={() => undefined} />
        </div>
      );
    }
    render(<Custom />);
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(screen.queryByRole('status')).not.toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId('a'));
    });
    expect(focus).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    fireEvent.click(screen.getByRole('button', { name: 'off' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('a field inside a grouped list takes the corners of the group', () => {
    function Grouped() {
      const guide = useSaveGuide([{ id: 'g', label: 'G', done: false }]);
      return (
        <div>
          <div className="uigl-rows">
            <div {...guide.field('g')} data-testid="g" />
          </div>
          <SaveGuide guide={guide} label="Save" heading="Needed" onSave={() => undefined} />
        </div>
      );
    }
    const { container } = render(<Grouped />);
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(container.ownerDocument.querySelector('.uisg-frame')).not.toBeNull();
  });

  it('with no field marked the frame draws nothing', () => {
    function Bare() {
      const guide = useSaveGuide([{ id: 'x', label: 'X', done: false }]);
      return <SaveGuide guide={guide} label="Save" heading="Needed" onSave={() => undefined} />;
    }
    render(<Bare />);
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(document.querySelector('.uisg-frame')).toBeNull();
  });
});
