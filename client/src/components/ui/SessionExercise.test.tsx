import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SessionExercise, type SessionExerciseProps } from './SessionExercise';

afterEach(cleanup);

const base: SessionExerciseProps = {
  name: 'Bench press',
  setLabel: '1',
  kgPlaceholder: 'kg',
  repsPlaceholder: 'reps',
};

describe('SessionExercise', () => {
  it('renders name, muscles and the set cells', () => {
    render(<SessionExercise {...base} muscles="Chest, Triceps" />);
    expect(screen.getByText('Bench press').tagName).toBe('B');
    expect(screen.getByText('Chest, Triceps').tagName).toBe('SMALL');
    expect(screen.getByText('1').className).toContain('idx');
    expect(screen.getByText('kg').className).toContain('val');
    expect(screen.getByText('reps').className).toContain('val');
  });

  it('shows the target chip and not the no-target line when a target exists', () => {
    const { container } = render(
      <SessionExercise {...base} target="3 x 6 . 60 kg" noTarget="No target" />,
    );
    expect(screen.getByText('3 x 6 . 60 kg').closest('.uisx-target')).not.toBeNull();
    expect(screen.queryByText('No target')).toBeNull();
    expect(container.querySelector('.uisx-none')).toBeNull();
  });

  it('shows the no-target line for a bare exercise, and nothing when both are absent', () => {
    const { container, rerender } = render(<SessionExercise {...base} noTarget="No target" />);
    expect(screen.getByText('No target').className).toContain('uisx-none');
    expect(container.querySelector('.uisx-target')).toBeNull();
    rerender(<SessionExercise {...base} />);
    expect(container.querySelector('.uisx-none')).toBeNull();
    expect(container.querySelector('.uisx-target')).toBeNull();
  });

  it('live mode keeps the set row focusable and enabled', () => {
    const { container } = render(<SessionExercise {...base} />);
    const row = container.querySelector('.uisx-set') as HTMLButtonElement;
    expect(row.disabled).toBe(false);
    expect(row.hasAttribute('aria-hidden')).toBe(false);
    expect(row.hasAttribute('tabindex')).toBe(false);
    expect((container.firstChild as HTMLElement).hasAttribute('data-readonly')).toBe(false);
  });

  it('preview mode is read-only: disabled, hidden from AT, out of tab order', () => {
    const { container } = render(<SessionExercise {...base} preview />);
    const row = container.querySelector('.uisx-set') as HTMLButtonElement;
    expect(row.disabled).toBe(true);
    expect(row.getAttribute('aria-hidden')).toBe('true');
    expect(row.tabIndex).toBe(-1);
    expect((container.firstChild as HTMLElement).getAttribute('data-readonly')).toBe('true');
  });

  it('renders a caption only when given', () => {
    const { container, rerender } = render(<SessionExercise {...base} />);
    expect(container.querySelector('.uisx-cap')).toBeNull();
    rerender(<SessionExercise {...base} caption="What the client sees" />);
    expect(screen.getByText('What the client sees').className).toContain('uisx-cap');
  });
});
