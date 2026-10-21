import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LiveWidget, type LiveEntry, type LiveWidgetProps } from './LiveWidget';

afterEach(cleanup);

const entry = (over: Partial<LiveEntry>): LiveEntry => ({
  id: 'e',
  name: 'Maria Tkach',
  status: 'live',
  detail: 'Iron Yard',
  metric: '14 min',
  statusText: 'Training now',
  ...over,
});

const props = (over: Partial<LiveWidgetProps> = {}): LiveWidgetProps => ({
  entries: [],
  pillLabel: '1 live',
  pillAria: 'Clients training now',
  title: 'Live now',
  summary: 'Who is training',
  groupLabels: { live: 'Training now', offline: 'Lost connection', finished: 'Finished' },
  noneText: 'Nobody is training',
  privacy: 'No sets or weights shown',
  ...over,
});

// Until measured the popover panel is visibility:hidden, which empties accessible names, so panel content is queried by text / attribute.
describe('LiveWidget', () => {
  it('starts closed with a pill that has haspopup and expanded=false', () => {
    render(<LiveWidget {...props()} />);
    const pill = screen.getByRole('button', { name: 'Clients training now' });
    expect(pill.getAttribute('aria-haspopup')).toBe('dialog');
    expect(pill.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Live now')).toBeNull();
  });

  it('clicking the pill opens and closes the panel', () => {
    render(<LiveWidget {...props()} />);
    const pill = screen.getByRole('button', { name: 'Clients training now' });
    fireEvent.click(pill);
    expect(pill.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Live now')).toBeTruthy();
    expect(screen.getByText('No sets or weights shown')).toBeTruthy();
    fireEvent.click(pill);
    expect(screen.queryByText('Live now')).toBeNull();
  });

  it('defaultOpen shows the empty text when there are no entries', () => {
    render(<LiveWidget {...props({ defaultOpen: true })} />);
    expect(screen.getByText('Nobody is training')).toBeTruthy();
    expect(screen.getByText('Who is training')).toBeTruthy();
  });

  it('groups entries by status and hides empty groups and the none text', () => {
    render(
      <LiveWidget
        {...props({
          defaultOpen: true,
          entries: [
            entry({ id: '1', name: 'Maria' }),
            entry({ id: '2', name: 'Oleh', status: 'finished', statusText: 'Finished' }),
          ],
        })}
      />,
    );
    expect(screen.queryByText('Nobody is training')).toBeNull();
    const labels = screen
      .getAllByRole('list', { hidden: true })
      .map((l) => l.getAttribute('aria-label'));
    expect(labels).toEqual(['Training now', 'Finished']);
    expect(screen.getByText('Maria')).toBeTruthy();
    expect(screen.getByText('Oleh')).toBeTruthy();
  });

  it('row is plain text without onOpen', () => {
    render(<LiveWidget {...props({ defaultOpen: true, entries: [entry({})] })} />);
    expect(screen.getByText('Maria Tkach').closest('button')).toBeNull();
    expect(screen.getByText('14 min')).toBeTruthy();
  });

  it('row with onOpen is a button that closes the widget first, then opens', () => {
    const onOpen = vi.fn();
    render(
      <LiveWidget
        {...props({
          defaultOpen: true,
          entries: [entry({ onOpen, ariaLabel: 'Maria Tkach, training now, 14 min' })],
        })}
      />,
    );
    const row = screen.getByText('Maria Tkach').closest('button') as HTMLElement;
    expect(row.getAttribute('aria-label')).toBe('Maria Tkach, training now, 14 min');
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Live now')).toBeNull();
  });

  it('uses a custom avatar when given', () => {
    render(
      <LiveWidget
        {...props({ defaultOpen: true, entries: [entry({ avatar: <i data-testid="av" /> })] })}
      />,
    );
    expect(screen.getByTestId('av')).toBeTruthy();
  });
});
