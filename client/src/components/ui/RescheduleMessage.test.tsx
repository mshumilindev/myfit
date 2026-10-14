import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RescheduleMessage, type RescheduleMessageProps } from './RescheduleMessage';

afterEach(cleanup);

const base: RescheduleMessageProps = {
  status: 'pending',
  kindLabel: 'Reschedule request',
  statusLabel: 'Needs your answer',
  title: 'Oleh asks to move a session',
  session: { bold: 'Upper B', rest: ' · 60 min' },
  from: { label: 'Now', day: 'Fri 9 Oct', time: '18:00' },
  to: { label: 'Proposed', day: 'Sat 10 Oct', time: '10:00' },
  note: 'Work trip',
};

describe('RescheduleMessage', () => {
  it('names the status in words and shows which session, old and new time and the note', () => {
    render(<RescheduleMessage {...base} />);
    const g = screen.getByRole('group', { name: 'Reschedule request, Needs your answer' });
    expect(g.textContent).toContain('Upper B');
    expect(g.textContent).toContain('Fri 9 Oct');
    expect(g.textContent).toContain('Sat 10 Oct');
    expect(g.textContent).toContain('Work trip');
  });
  it('the answering side gets three answers; the buttons call back', () => {
    const accept = vi.fn();
    const decline = vi.fn();
    const counter = vi.fn();
    render(
      <RescheduleMessage
        {...base}
        accept={{ label: 'Accept', onClick: accept }}
        decline={{ label: 'Decline', onClick: decline }}
        counter={{ label: 'Suggest another time', onClick: counter }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    fireEvent.click(screen.getByRole('button', { name: 'Suggest another time' }));
    expect([accept, decline, counter].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });
  it('the asking side waits and may cancel; no answers are offered', () => {
    const cancel = vi.fn();
    render(
      <RescheduleMessage
        {...base}
        mine
        statusLabel="Waiting for Oleh"
        waiting={{ text: 'Waiting.', cancel: { label: 'Cancel request', onClick: cancel } }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
    expect(cancel).toHaveBeenCalled();
  });
  it('a finished request has no answers, only the outcome and a follow-up', () => {
    render(
      <RescheduleMessage
        {...base}
        status="declined"
        statusLabel="Declined"
        accept={{ label: 'Accept', onClick: () => undefined }}
        outcome={{ text: 'It did not move.', when: 'Today 08:55' }}
        followUp={{ label: 'Propose a new time', onClick: () => undefined }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
    expect(screen.getByText('It did not move.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Propose a new time' })).toBeTruthy();
  });
  it('disables the buttons while an answer is sent and shows an error line', () => {
    render(
      <RescheduleMessage
        {...base}
        busy
        errorText="Try again."
        accept={{ label: 'Accept', onClick: () => undefined }}
      />,
    );
    expect((screen.getByRole('button', { name: 'Accept' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByRole('alert').textContent).toBe('Try again.');
  });
});
