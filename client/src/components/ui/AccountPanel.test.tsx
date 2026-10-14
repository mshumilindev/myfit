import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AccountPanel, withClose } from './AccountPanel';

afterEach(cleanup);

const modes = [
  { value: 'a', label: 'Coach' },
  { value: 'b', label: 'My workouts' },
] as const;

describe('AccountPanel', () => {
  it('identity only: initials avatar, name, role; no switch, note or profile', () => {
    const { container } = render(<AccountPanel name="Iryna Koval" roleLabel="Trainer" />);
    expect(screen.getByText('Iryna Koval')).toBeTruthy();
    expect(screen.getByText('Trainer')).toBeTruthy();
    expect(container.querySelector('.uiav')?.textContent).toBe('IK');
    expect(container.querySelector('.uiseg')).toBeNull();
    expect(container.querySelector('.uiacct-note')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the avatar slot instead of the initials disc', () => {
    const { container } = render(<AccountPanel name="X" avatar={<span data-testid="mine" />} />);
    expect(screen.getByTestId('mine')).toBeTruthy();
    expect(container.querySelector('.uiav')).toBeNull();
  });

  it('mode switch only with two modes and a handler; the current mode is a no-op', () => {
    const onModeChange = vi.fn();
    const { rerender } = render(
      <AccountPanel<'a' | 'b'>
        name="X"
        modes={[...modes]}
        mode="a"
        modeLabel="Mode"
        onModeChange={onModeChange}
      />,
    );
    const a = screen.getByRole('button', { name: 'Coach' });
    expect(a.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(a);
    expect(onModeChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'My workouts' }));
    expect(onModeChange).toHaveBeenCalledWith('b');
    rerender(<AccountPanel<'a' | 'b'> name="X" modes={[...modes]} mode="a" />);
    expect(screen.queryByRole('button', { name: 'Coach' })).toBeNull();
    rerender(
      <AccountPanel<'a'> name="X" modes={[modes[0]]} mode="a" onModeChange={onModeChange} />,
    );
    expect(screen.queryByRole('button', { name: 'Coach' })).toBeNull();
  });

  it('shows the note and a Profile row that fires its handler', () => {
    const onOpen = vi.fn();
    render(<AccountPanel name="X" note="Private." profile={{ label: 'Profile', onOpen }} />);
    expect(screen.getByText('Private.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('AccountPanel mode = null (the app is neither side)', () => {
  it('no segment is selected and picking either one fires onModeChange', () => {
    const onModeChange = vi.fn();
    render(
      <AccountPanel
        name="X"
        modes={[...modes]}
        mode={null}
        onModeChange={onModeChange}
        modeLabel="Mode"
      />,
    );
    const a = screen.getByRole('button', { name: 'Coach' });
    const b = screen.getByRole('button', { name: 'My workouts' });
    expect([a, b].map((x) => x.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
    fireEvent.click(b);
    expect(onModeChange).toHaveBeenCalledWith('b');
    fireEvent.click(a);
    expect(onModeChange).toHaveBeenCalledWith('a');
  });

  it('Profile then Sign out, as a matching pair of pills; each fires once; absent without a handler', () => {
    const onOpen = vi.fn();
    const onSelect = vi.fn();
    const { container, rerender } = render(
      <AccountPanel
        name="X"
        profile={{ label: 'Profile', onOpen }}
        signOut={{ label: 'Sign out', onSelect }}
      />,
    );
    const pills = [...container.querySelectorAll('.uiacct-action')];
    expect(pills.map((p) => p.textContent)).toEqual(['Profile', 'Sign out']);
    // same component, same shape; the families differ (People silver vs danger)
    expect(pills.every((p) => p.classList.contains('uicard'))).toBe(true);
    expect(pills[0].classList.contains('uicard--people')).toBe(true);
    expect(pills[1].classList.contains('uicard--danger')).toBe(true);
    fireEvent.click(pills[1]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    rerender(<AccountPanel name="X" profile={{ label: 'Profile', onOpen }} />);
    expect(container.querySelectorAll('.uiacct-action')).toHaveLength(1);
  });

  it('withClose closes the container before Sign out runs', () => {
    const order: string[] = [];
    const acct = withClose(
      { name: 'X', signOut: { label: 'Sign out', onSelect: () => order.push('select') } },
      () => order.push('close'),
    );
    render(<AccountPanel {...acct} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(order).toEqual(['close', 'select']);
  });
});
