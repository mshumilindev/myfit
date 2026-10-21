import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WeekStepper, type WeekStepperProps } from './WeekStepper';

afterEach(cleanup);

const base: WeekStepperProps = {
  label: '28 Sep – 4 Oct',
  onPrev: () => {},
  onNext: () => {},
  canPrev: true,
  canNext: true,
  prevLabel: 'Previous week',
  nextLabel: 'Next week',
};

describe('WeekStepper', () => {
  it('shows the label and optional sub line', () => {
    const { container, rerender } = render(<WeekStepper {...base} sub="This week" />);
    expect(screen.getByText('28 Sep – 4 Oct').className).toContain('uiwk-label');
    expect(screen.getByText('This week').className).toContain('uiwk-sub');
    rerender(<WeekStepper {...base} />);
    expect(container.querySelector('.uiwk-sub')).toBeNull();
  });

  it('prev and next buttons fire their handlers', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(<WeekStepper {...base} onPrev={onPrev} onNext={onNext} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('canPrev / canNext false disable the arrows', () => {
    render(<WeekStepper {...base} canPrev={false} canNext={false} />);
    expect(
      (screen.getByRole('button', { name: 'Previous week' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole('button', { name: 'Next week' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('with onOpen the label is a named button that fires it', () => {
    const onOpen = vi.fn();
    render(<WeekStepper {...base} onOpen={onOpen} openLabel="Pick a week" />);
    const pick = screen.getByRole('button', { name: 'Pick a week' });
    expect(pick.className).toContain('uiwk-pick');
    fireEvent.click(pick);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('without onOpen the label is static (only the two arrow buttons)', () => {
    const { container } = render(<WeekStepper {...base} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    const pick = container.querySelector('.uiwk-pick') as HTMLElement;
    expect(pick.tagName).toBe('DIV');
    expect(pick.className).toContain('uibtn--secondary');
  });

  it('appends className to the root', () => {
    const { container } = render(<WeekStepper {...base} className="extra" />);
    expect((container.firstChild as HTMLElement).className).toBe('uiwk extra');
  });
});
