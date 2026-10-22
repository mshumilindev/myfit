import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Stepper } from './Stepper';

afterEach(cleanup);
const steps = [
  { id: 'a', label: 'Documents' },
  { id: 'b', label: 'Agreement' },
  { id: 'c', label: 'Your choices' },
];
const word = (n: number, t: number) => `Step ${n} of ${t}`;

describe('Stepper', () => {
  it('shows every step name at once and says which step this is', () => {
    render(<Stepper steps={steps} current={0} stepLabel={word} />);
    for (const s of steps) expect(screen.getByText(s.label)).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Step 1 of 3' })).toBeTruthy();
    expect(screen.getByText('Documents').closest('li')?.getAttribute('aria-current')).toBe('step');
  });

  it('fills finished and current segments only', () => {
    const { container, rerender } = render(<Stepper steps={steps} current={0} stepLabel={word} />);
    const seg = () =>
      Array.from(container.querySelectorAll('.uistepr-bar i')).map((i) => i.className);
    expect(seg()).toEqual(['is-on', '', '']);
    rerender(<Stepper steps={steps} current={1} stepLabel={word} />);
    expect(seg()).toEqual(['is-done', 'is-on', '']);
    expect(screen.getByRole('group', { name: 'Step 2 of 3' })).toBeTruthy();
  });

  it('marks a step done from `done` even while it is the current one', () => {
    const { container } = render(
      <Stepper steps={steps} current={0} done={['a']} stepLabel={word} />,
    );
    expect(container.querySelectorAll('li.is-done')).toHaveLength(1);
    expect(container.querySelector('li.is-done svg')).toBeTruthy();
  });

  it('makes only reachable, non-current steps buttons that call onStep', () => {
    const onStep = vi.fn();
    render(
      <Stepper steps={steps} current={1} reachable={['a', 'b']} onStep={onStep} stepLabel={word} />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Documents/ }));
    expect(onStep).toHaveBeenCalledWith('a');
  });
});
