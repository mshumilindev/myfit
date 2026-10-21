import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LockerWall } from './LockerWall';

afterEach(cleanup);

const people = [
  { id: 'a', name: 'Anna Koval' },
  { id: 'b', name: 'Boris' },
  { id: 'c', name: 'Clara Diaz', avatar: '/c.png' },
];
const base = {
  people,
  label: 'People on this device',
  lockerLabel: (n: string, i: number) => `${n}, locker ${i + 1}`,
  onSelect: () => undefined,
};

describe('LockerWall', () => {
  it('shows one locker per person: number and first name, named for assistive tech', () => {
    render(<LockerWall {...base} />);
    expect(screen.getByRole('group', { name: base.label })).toBeTruthy();
    const b = screen.getByRole('button', { name: 'Boris, locker 2' });
    expect(b.textContent).toContain('02');
    expect(b.textContent).toContain('Boris');
    expect(screen.getByRole('button', { name: 'Anna Koval, locker 1' }).textContent).toContain(
      'Anna',
    );
    expect(screen.getByRole('button', { name: 'Anna Koval, locker 1' }).textContent).not.toContain(
      'Koval',
    );
  });

  it('reports the chosen person', () => {
    const onSelect = vi.fn();
    render(<LockerWall {...base} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clara Diaz, locker 3' }));
    expect(onSelect).toHaveBeenCalledWith('c');
  });

  it('marks the active person and opens the locker of the person signing in', () => {
    render(<LockerWall {...base} activeId="b" openId="b" openLabel="Open" />);
    const b = screen.getByRole('button', { name: 'Boris, locker 2' });
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(b.className).toContain('is-open');
    expect(b.textContent).toContain('Open');
    expect(
      screen.getByRole('button', { name: 'Anna Koval, locker 1' }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('shows progress on the person being signed in and disables the other lockers', () => {
    render(<LockerWall {...base} busyId="b" busyLabel="Signing in…" />);
    const b = screen.getByRole('button', { name: 'Boris, locker 2' });
    expect(b.className).toContain('is-busy');
    expect(b.querySelector('.uilw-spin')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Signing in…');
    expect((b as HTMLButtonElement).disabled).toBe(false);
    expect(
      (screen.getByRole('button', { name: 'Anna Koval, locker 1' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByRole('group').getAttribute('aria-busy')).toBe('true');
  });

  it('nothing is busy or disabled by default', () => {
    render(<LockerWall {...base} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Boris, locker 2' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
