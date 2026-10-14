import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExerciseRow } from './ExerciseRow';
import { ExerciseThumb } from './ExerciseThumb';
import { FindingRow } from './FindingRow';
import { GroupedList } from './GroupedList';
import { RangeBar } from './RangeBar';
import { SessionExercise } from './SessionExercise';
import { WeekdayToggle } from './WeekdayToggle';

afterEach(cleanup);

describe('RangeBar', () => {
  it('speaks the whole sentence and draws value and band as percentages of the scale', () => {
    render(
      <RangeBar value={6} max={24} band={[12, 18]} label="Back 6 sets, range 12 to 18, below" />,
    );
    const bar = screen.getByRole('img', { name: 'Back 6 sets, range 12 to 18, below' });
    expect(bar.style.getPropertyValue('--uirange-v')).toBe('25%');
    expect(bar.style.getPropertyValue('--uirange-b0')).toBe('50%');
    expect(bar.style.getPropertyValue('--uirange-bw')).toBe('25%');
  });
  it('clamps a value above the scale', () => {
    render(<RangeBar value={99} max={24} label="x" />);
    expect(screen.getByRole('img').style.getPropertyValue('--uirange-v')).toBe('100%');
  });
});

describe('FindingRow', () => {
  it('says the status in words and renders the action', () => {
    const onClick = vi.fn();
    render(
      <ul>
        <FindingRow
          icon="warning"
          tone="danger"
          title="Back below its weekly range"
          body="4 sets against 12 to 20"
          status="To fix"
          action={<button onClick={onClick}>Fix in editor</button>}
        />
      </ul>,
    );
    expect(screen.getByRole('listitem')).toBeTruthy();
    expect(screen.getByText('To fix')).toBeTruthy();
    fireEvent.click(screen.getByText('Fix in editor'));
    expect(onClick).toHaveBeenCalled();
  });
});

describe('WeekdayToggle', () => {
  const days = [
    { id: 'Mon', label: 'Mo', sub: 'With Iryna', on: true, ariaLabel: 'Monday, with Iryna' },
    { id: 'Tue', label: 'Tu', sub: 'Solo', on: false, ariaLabel: 'Tuesday, solo' },
    {
      id: 'Wed',
      label: 'We',
      sub: 'Rest',
      on: false,
      disabled: true,
      ariaLabel: 'Wednesday, rest day',
    },
  ];
  it('toggles an enabled day and not a rest day', () => {
    const onToggle = vi.fn();
    render(<WeekdayToggle days={days} onToggle={onToggle} label="Days with Iryna" />);
    fireEvent.click(screen.getByRole('button', { name: 'Tuesday, solo' }));
    expect(onToggle).toHaveBeenCalledWith('Tue');
    // a rest day is a quiet static tile, not a disabled button
    expect(screen.queryByRole('button', { name: 'Wednesday, rest day' })).toBeNull();
    expect(screen.getByRole('img', { name: 'Wednesday, rest day' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Days with Iryna' })).toBeTruthy();
  });
  it('read only draws no buttons', () => {
    render(<WeekdayToggle days={days} onToggle={() => undefined} label="x" readOnly />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getAllByRole('img')).toHaveLength(3);
  });
});

describe('ExerciseRow / ExerciseThumb', () => {
  it('a bare exercise shows name and picture only', () => {
    render(
      <GroupedList label="Exercises">
        <ExerciseRow name="Plank" image={undefined} />
      </GroupedList>,
    );
    expect(screen.getByText('Plank')).toBeTruthy();
    expect(screen.queryByText(/×/)).toBeNull();
  });
  it('prescription and selection are exposed', () => {
    const onClick = vi.fn();
    render(
      <GroupedList label="Exercises">
        <ExerciseRow name="Squat" prescription="3 × 6" selected aria-pressed onClick={onClick} />
      </GroupedList>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Squat/ }));
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByText('3 × 6')).toBeTruthy();
  });
  it('falls back to the icon tile when the picture fails', () => {
    const { container } = render(<ExerciseThumb src="/nope.jpg" />);
    const img = container.querySelector('img');
    if (img) fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('SessionExercise (preview)', () => {
  it('shows the target strip, takes no focus and logs nothing', () => {
    render(
      <SessionExercise
        preview
        name="Press"
        target="3 × 6 · 40 kg"
        setLabel="Set 1"
        kgPlaceholder="kg"
        repsPlaceholder="reps"
      />,
    );
    expect(screen.getByText('3 × 6 · 40 kg')).toBeTruthy();
    expect(document.querySelectorAll('input')).toHaveLength(0);
    expect(document.querySelector('.uisx')?.getAttribute('data-readonly')).toBe('true');
  });
  it('a bare exercise says there is no target', () => {
    render(
      <SessionExercise
        preview
        name="Press"
        noTarget="No target"
        setLabel="Set 1"
        kgPlaceholder="kg"
        repsPlaceholder="reps"
      />,
    );
    expect(screen.getByText('No target')).toBeTruthy();
  });
});
