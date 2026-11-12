import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReminderAlert, type ReminderAlertProps } from './ReminderAlert';

afterEach(cleanup);

const labels: ReminderAlertProps['labels'] = {
  snooze: 'Snooze',
  dismiss: 'Dismiss',
  close: 'Close',
  minutes: (n) => `${n} min`,
};

function alert(over: Partial<ReminderAlertProps> = {}) {
  return (
    <ReminderAlert
      variant="screen"
      state="ringing"
      title="Chest 2"
      kind="Reminder"
      labels={labels}
      {...over}
    />
  );
}

describe('ReminderAlert', () => {
  it('screen: picks a snooze length with the chips and snoozes by it', () => {
    const onSnooze = vi.fn();
    render(alert({ onSnooze }));
    fireEvent.click(screen.getByRole('button', { name: '30 min' }));
    fireEvent.click(screen.getByRole('button', { name: 'Snooze' }));
    expect(onSnooze).toHaveBeenCalledWith(30);
  });

  it('screen: the middle length is preselected and dismiss calls back', () => {
    const onSnooze = vi.fn();
    const onDismiss = vi.fn();
    render(alert({ onSnooze, onDismiss }));
    fireEvent.click(screen.getByRole('button', { name: 'Snooze' }));
    expect(onSnooze).toHaveBeenCalledWith(10);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('card: the snooze button carries the chosen length', () => {
    const onSnooze = vi.fn();
    render(alert({ variant: 'card', onSnooze }));
    fireEvent.click(screen.getByRole('button', { name: '10 min' }));
    expect(onSnooze).toHaveBeenCalledWith(10);
  });

  it('a state that does not ring shows Close', () => {
    const onClose = vi.fn();
    render(alert({ state: 'snoozed', onClose }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
