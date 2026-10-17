import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AccountPopover, type AccountPopoverProps } from './AccountPopover';

afterEach(cleanup);

type Mode = 'coach' | 'me';

function Harness(props: Partial<AccountPopoverProps<Mode>> & { onClose?: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={ref}>avatar</button>
      <AccountPopover<Mode>
        open
        onClose={vi.fn()}
        anchorRef={ref}
        title="Profile and mode"
        account={{ name: 'Iryna Koval', roleLabel: 'Trainer' }}
        {...props}
      />
    </>
  );
}

describe('AccountPopover', () => {
  it('renders nothing while closed', () => {
    render(<Harness open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Iryna Koval')).toBeNull();
  });

  it('open: a dialog named by the title that holds only the account panel', () => {
    render(<Harness />);
    const dlg = screen.getByRole('dialog', { name: 'Profile and mode' });
    expect(within(dlg).getByText('Iryna Koval')).toBeTruthy();
    expect(within(dlg).getByText('Trainer')).toBeTruthy();
    expect(dlg.querySelector('.uiacct')).toBeTruthy();
    expect(within(dlg).queryByRole('button')).toBeNull();
  });

  it('sits on the right/end at 320px by default; side, align and width are passed on', () => {
    const { unmount } = render(<Harness />);
    let dlg = screen.getByRole('dialog');
    expect(dlg.style.width).toBe('320px');
    expect(dlg.className).toContain('uipop');
    unmount();
    render(<Harness width={200} side="bottom" align="start" />);
    dlg = screen.getByRole('dialog');
    expect(dlg.style.width).toBe('200px');
  });

  it('Esc closes via onClose', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes first on Profile, mode change and sign out by default', () => {
    const order: string[] = [];
    const onClose = vi.fn(() => order.push('close'));
    const onOpen = vi.fn(() => order.push('profile'));
    const onModeChange = vi.fn(() => order.push('mode'));
    const onSelect = vi.fn(() => order.push('out'));
    render(
      <Harness
        onClose={onClose}
        account={{
          name: 'X',
          modes: [
            { value: 'coach', label: 'Coach' },
            { value: 'me', label: 'My workouts' },
          ],
          mode: 'coach',
          onModeChange,
          profile: { label: 'Profile', onOpen },
          signOut: { label: 'Sign out', onSelect },
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'My workouts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(order).toEqual(['close', 'mode', 'close', 'profile', 'close', 'out']);
  });

  it('closeOnSelect=false leaves the popover open on select', () => {
    const onClose = vi.fn();
    const onOpen = vi.fn();
    render(
      <Harness
        onClose={onClose}
        closeOnSelect={false}
        account={{ name: 'X', profile: { label: 'Profile', onOpen } }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
