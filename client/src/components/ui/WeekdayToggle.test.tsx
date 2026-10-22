import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WeekdayToggle, type WeekdayToggleDay } from './WeekdayToggle';

afterEach(cleanup);

const days: WeekdayToggleDay[] = [
  { id: 'mon', label: 'Mon', sub: 'Solo', on: false, ariaLabel: 'Monday, solo' },
  { id: 'tue', label: 'Tue', sub: 'With Iryna', on: true, ariaLabel: 'Tuesday, with Iryna' },
  { id: 'wed', label: 'Wed', sub: 'Rest', on: false, disabled: true, ariaLabel: 'Wednesday, rest' },
  { id: 'thu', label: 'Thu', on: true, ariaLabel: 'Thursday' },
];

describe('WeekdayToggle', () => {
  it('is a labelled group', () => {
    render(<WeekdayToggle days={days} onToggle={() => {}} label="Days with Iryna" />);
    expect(screen.getByRole('group', { name: 'Days with Iryna' })).toBeTruthy();
  });

  it('selectable days are toggle buttons with aria-pressed and a full spoken label', () => {
    render(<WeekdayToggle days={days} onToggle={() => {}} label="g" />);
    const mon = screen.getByRole('button', { name: 'Monday, solo' });
    const tue = screen.getByRole('button', { name: 'Tuesday, with Iryna' });
    expect(mon.getAttribute('aria-pressed')).toBe('false');
    expect(tue.getAttribute('aria-pressed')).toBe('true');
    expect(tue.className).toContain('is-on');
    expect(mon.className).not.toContain('is-on');
  });

  it('shows the second line only when given', () => {
    render(<WeekdayToggle days={days} onToggle={() => {}} label="g" />);
    expect(screen.getByText('With Iryna').tagName).toBe('SMALL');
    const thu = screen.getByRole('button', { name: 'Thursday' });
    expect(thu.querySelector('small')).toBeNull();
  });

  it('clicking a day calls onToggle with its id', () => {
    const onToggle = vi.fn();
    render(<WeekdayToggle days={days} onToggle={onToggle} label="g" />);
    fireEvent.click(screen.getByRole('button', { name: 'Monday, solo' }));
    expect(onToggle).toHaveBeenCalledWith('mon');
  });

  it('a disabled day is a static image tile, not a button', () => {
    const onToggle = vi.fn();
    render(<WeekdayToggle days={days} onToggle={onToggle} label="g" />);
    const wed = screen.getByRole('img', { name: 'Wednesday, rest' });
    expect(wed.className).toContain('is-static');
    expect(screen.queryByRole('button', { name: 'Wednesday, rest' })).toBeNull();
    fireEvent.click(wed);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('readOnly turns every day into a static tile that keeps its on state', () => {
    const onToggle = vi.fn();
    render(<WeekdayToggle days={days} onToggle={onToggle} label="g" readOnly />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getAllByRole('img')).toHaveLength(4);
    expect(screen.getByRole('img', { name: 'Tuesday, with Iryna' }).className).toContain('is-on');
    expect(screen.getByRole('img', { name: 'Monday, solo' }).className).not.toContain('is-on');
    fireEvent.click(screen.getByRole('img', { name: 'Monday, solo' }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
