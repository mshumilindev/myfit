import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RequestCard, type RequestCardProps } from './RequestCard';

afterEach(cleanup);

const act = (label: string, onClick = vi.fn()) => ({
  label,
  ariaLabel: `${label} request`,
  onClick,
});
const base: RequestCardProps = {
  title: 'Maria asks to move',
  status: 'Needs your answer',
  kind: 'answer',
  fromLabel: 'From',
  from: 'Tue 10:00',
  toLabel: 'To',
  to: 'Wed 11:00',
};

describe('RequestCard', () => {
  it('shows title, status, and the from/to move', () => {
    render(<RequestCard {...base} />);
    expect(screen.getByRole('heading', { name: 'Maria asks to move' })).toBeTruthy();
    expect(screen.getByText('Needs your answer')).toBeTruthy();
    expect(screen.getByText('From')).toBeTruthy();
    expect(screen.getByText('Tue 10:00')).toBeTruthy();
    expect(screen.getByText('To')).toBeTruthy();
    expect(screen.getByText('Wed 11:00')).toBeTruthy();
  });

  it('quotes the note only when given', () => {
    const a = render(<RequestCard {...base} note="Sick kid" />);
    expect(a.container.querySelector('blockquote')?.textContent).toBe('“Sick kid”');
    a.unmount();
    const b = render(<RequestCard {...base} />);
    expect(b.container.querySelector('blockquote')).toBeNull();
  });

  it('answer kind shows accept, decline and propose that fire; cancel is hidden', () => {
    const accept = act('Accept');
    const decline = act('Decline');
    const propose = act('Propose');
    render(
      <RequestCard
        {...base}
        accept={accept}
        decline={decline}
        propose={propose}
        cancel={act('Cancel')}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Accept request' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decline request' }));
    fireEvent.click(screen.getByRole('button', { name: 'Propose request' }));
    expect(accept.onClick).toHaveBeenCalledTimes(1);
    expect(decline.onClick).toHaveBeenCalledTimes(1);
    expect(propose.onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull();
  });

  it('waiting kind shows only cancel', () => {
    const cancel = act('Cancel');
    render(<RequestCard {...base} kind="waiting" accept={act('Accept')} cancel={cancel} />);
    expect(screen.queryByRole('button', { name: 'Accept request' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
    expect(cancel.onClick).toHaveBeenCalledTimes(1);
  });

  it('busy disables every action', () => {
    render(
      <RequestCard
        {...base}
        busy
        accept={act('Accept')}
        decline={act('Decline')}
        propose={act('Propose')}
      />,
    );
    for (const b of screen.getAllByRole('button'))
      expect((b as HTMLButtonElement).disabled).toBe(true);
  });

  it('resultText replaces the buttons with a status line', () => {
    render(<RequestCard {...base} accept={act('Accept')} resultText="Accepted" />);
    expect(screen.getByRole('status').textContent).toBe('Accepted');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('errorText is an alert under the buttons', () => {
    render(<RequestCard {...base} accept={act('Accept')} errorText="Could not send" />);
    expect(screen.getByRole('alert').textContent).toBe('Could not send');
    expect(screen.getByRole('button', { name: 'Accept request' })).toBeTruthy();
  });

  it('is a section; className is applied', () => {
    const { container } = render(<RequestCard {...base} flat className="x" />);
    const root = container.firstChild as HTMLElement;
    expect(root.tagName).toBe('SECTION');
    expect(root.className).toContain('uirq');
    expect(root.className).toContain('x');
  });
});
