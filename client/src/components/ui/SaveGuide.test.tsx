import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaveGuide } from './SaveGuide';

const base = (done: boolean[]) =>
  ['Title', 'Weekday'].map((l, i) => ({ id: l, label: l, done: done[i] }));

afterEach(cleanup);

describe('SaveGuide', () => {
  it('stays pressable, shows the flag and reveals the first missing item', () => {
    const onSave = vi.fn();
    const onReveal = vi.fn();
    render(
      <SaveGuide
        label="Save"
        heading="Still needed"
        items={base([true, false])}
        onSave={onSave}
        onReveal={onReveal}
      />,
    );
    const btn = screen.getByRole('button', { name: /Save/ });
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    expect(onSave).not.toHaveBeenCalled();
    const flag = screen.getByRole('status').textContent ?? '';
    expect(flag).toContain('Weekday');
    expect(flag).not.toContain('Title');
    expect(onReveal).toHaveBeenLastCalledWith('Weekday');
  });

  it('drops the dots and saves when everything is filled', () => {
    const onSave = vi.fn();
    const { container } = render(
      <SaveGuide label="Save" heading="Still needed" items={base([true, true])} onSave={onSave} />,
    );
    expect(container.querySelector('.uisg-dots')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledOnce();
  });
});
