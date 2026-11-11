import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { newDraft } from './draft';
import { PlanForm } from './PlanForm';

afterEach(cleanup);
const draft = () => newDraft('p1', '2026-11-11');

describe('PlanForm leaving', () => {
  it('Cancel with nothing changed leaves at once (defaults do not count)', () => {
    const onClose = vi.fn();
    render(<PlanForm initial={draft()} editing={false} onSave={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('after a change Cancel asks first; Keep editing stays, Discard leaves', () => {
    const onClose = vi.fn();
    render(<PlanForm initial={draft()} editing={false} onSave={() => {}} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('Name this plan'), { target: { value: 'Run' } });
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByText('Discard changes?')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Keep editing'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByText('Discard'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
