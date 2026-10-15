import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientRow, LockedRow, LogModeBadge, SignalListRow, StatusLabel } from './RosterRows';

afterEach(cleanup);

describe('ClientRow', () => {
  it('is one button with a spoken name, calls onClick, marks the selected row', () => {
    const onClick = vi.fn();
    render(
      <ClientRow
        name="Oleh Bondar"
        program="Upper/Lower 4×"
        weekLabel="1 of 4"
        status="urgent"
        statusLabel="Urgent"
        selected
        ariaLabel="Oleh Bondar, Upper/Lower 4×, Urgent"
        onClick={onClick}
      />,
    );
    const b = screen.getByRole('button', { name: 'Oleh Bondar, Upper/Lower 4×, Urgent' });
    expect(b.getAttribute('aria-current')).toBe('true');
    expect(b.textContent).toContain('1 of 4');
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('a pending invite is not a button', () => {
    render(
      <ClientRow
        name="Olena Marchenko"
        program="Invite sent · 6 d left"
        trailing={<small>Pending</small>}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('shows the log mode only when it is not App, and counts with the badge rule', () => {
    const { rerender } = render(
      <ClientRow
        name="A B"
        program="P"
        logMode={{ mode: 'app', label: 'App' }}
        unread={12}
        unreadLabel="12 unread"
        onClick={() => undefined}
      />,
    );
    expect(screen.queryByText('App')).toBeNull();
    expect(screen.getByRole('img', { name: '12 unread' }).textContent).toContain('9+');
    rerender(
      <ClientRow
        name="A B"
        program="P"
        logMode={{ mode: 'program', label: 'Program only' }}
        onClick={() => undefined}
      />,
    );
    expect(screen.getByText('Program only')).toBeTruthy();
  });
});

describe('StatusLabel / LogModeBadge / LockedRow / SignalListRow', () => {
  it('"none" has no dot, others do; the word is always there', () => {
    const { container, rerender } = render(<StatusLabel status="none">All clear</StatusLabel>);
    expect(container.querySelector('.uisevdot-d')).toBeNull();
    rerender(<StatusLabel status="watch">Watch</StatusLabel>);
    expect(container.querySelector('.uisevdot-d')).not.toBeNull();
    expect(screen.getByText('Watch')).toBeTruthy();
  });

  it('log mode badge carries its word', () => {
    render(<LogModeBadge mode="hybrid">Hybrid</LogModeBadge>);
    expect(screen.getByText('Hybrid')).toBeTruthy();
  });

  it('locked row is a sentence, no value', () => {
    render(<LockedRow>Viktoriia has not shared injuries</LockedRow>);
    expect(screen.getByText('Viktoriia has not shared injuries')).toBeTruthy();
  });

  it('inline locked row keeps the lock and the text in one element', () => {
    const { container } = render(<LockedRow inline>Not shared</LockedRow>);
    const el = container.querySelector('.ros-locked.ros-locked-inline');
    expect(el).not.toBeNull();
    expect(el?.querySelector('.ros-locked-i')).not.toBeNull();
    expect(el?.textContent).toBe('Not shared');
  });

  it('signal row: title, meta, Decided pill, click', () => {
    const onClick = vi.fn();
    render(
      <SignalListRow
        title="Bench press has not moved in 4 weeks"
        clientName="Oleh Bondar"
        severity="urgent"
        severityLabel="Urgent"
        kindLabel="Stall"
        ageLabel="today"
        decidedLabel="Decided"
        selected
        onClick={onClick}
      />,
    );
    const b = screen.getByRole('button');
    expect(b.textContent).toContain('Decided');
    expect(b.textContent).toContain('Oleh Bondar');
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalled();
  });
});
