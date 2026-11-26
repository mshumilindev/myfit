// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Chips, EffortHint, EffortTag } from './pieces';
import { STRINGS } from './strings';

describe('effort pieces', () => {
  it('offers 6–10 (no Skip cell), marks the chosen one, clears on a second tap, and not while failure is on', () => {
    const onPick = vi.fn();
    const { rerender } = render(<Chips rpe={8} failOn={false} onPick={onPick} />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.queryByText('Skip')).toBeNull();
    fireEvent.click(screen.getByText('9'));
    expect(onPick).toHaveBeenCalledWith(9);
    expect(screen.getByText('8').closest('button')!.className).toContain('is-selected');
    fireEvent.click(screen.getByText('8'));
    expect(onPick).toHaveBeenLastCalledWith(0);
    rerender(<Chips rpe={8} failOn onPick={onPick} />);
    expect(screen.getByText('8').closest('button')!.className).not.toContain('is-selected');
  });
  it('hint explains the value, or shows the estimate when nothing is rated', () => {
    const { rerender } = render(<EffortHint rpe={9} est={null} />);
    expect(screen.getByText('1 more rep was possible')).toBeTruthy();
    rerender(<EffortHint rpe={0} est={8} />);
    expect(screen.getByText(STRINGS.en.estHint('8'))).toBeTruthy();
  });
  it('tag shows the rated value, else the dashed estimate, else nothing', () => {
    const { container, rerender } = render(<EffortTag rpe={8} est={7} />);
    expect(container.textContent).toBe('@8');
    rerender(<EffortTag rpe={null} est={7} />);
    expect(container.textContent).toBe('~7');
    rerender(<EffortTag rpe={null} est={null} />);
    expect(container.textContent).toBe('');
  });
});
