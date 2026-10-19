import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NotificationsView } from './NotificationsView';
import { setLocale } from '../i18n';
import type { Notif, NotifState } from '../notifications';
import { freezeClock, installIntersectionObserver, NOW, DAY, reseed } from './__fixtures__/viewKit';

const mk = (id: string, ageMs: number, over: Partial<Notif> = {}): Notif => ({
  id,
  kind: 'pr',
  ts: NOW - ageMs,
  title: `Title ${id}`,
  subtitle: `Sub ${id}`,
  ...over,
});

const unreadState = (ids: string[]): NotifState =>
  Object.fromEntries(ids.map((id) => [id, { ts: NOW, seen: false }]));

let io: ReturnType<typeof installIntersectionObserver>;
beforeEach(() => {
  freezeClock();
  setLocale('en');
  reseed();
  io = installIntersectionObserver();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.location.hash = '';
});

function renderView(over: Partial<Parameters<typeof NotificationsView>[0]> = {}) {
  const props = {
    notifs: [] as Notif[],
    now: NOW,
    state: {} as NotifState,
    onSeen: vi.fn(),
    onMarkAll: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  const view = render(<NotificationsView {...props} />);
  return { ...view, props };
}

describe('NotificationsView', () => {
  it('shows the empty state and no "mark all" when there is nothing', () => {
    renderView();
    expect(screen.getByText('No notifications yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark all read' })).toBeNull();
  });

  it('groups rows into today / this week / earlier by their age', () => {
    const notifs = [mk('a', 1000), mk('b', 3 * DAY), mk('c', 20 * DAY)];
    const { container } = renderView({ notifs });
    const labels = [...container.querySelectorAll('.notif-group')].map(
      (g) => g.querySelector('.notif-rows')?.children.length,
    );
    expect(labels).toEqual([1, 1, 1]);
    expect(screen.getByText('Title a')).toBeTruthy();
    expect(screen.getByText('Title c')).toBeTruthy();
  });

  it('omits empty groups', () => {
    const { container } = renderView({ notifs: [mk('a', 1000), mk('b', 2000)] });
    expect(container.querySelectorAll('.notif-group').length).toBe(1);
  });

  it('marks unread rows (dot + highlight) and offers "Mark all read" which calls back', () => {
    const { props, container } = renderView({
      notifs: [mk('a', 1000), mk('b', 2000)],
      state: { a: { ts: NOW, seen: true }, b: { ts: NOW, seen: false } },
    });
    expect(container.querySelectorAll('.notif-row.unread').length).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    expect(props.onMarkAll).toHaveBeenCalledTimes(1);
  });

  it('hides "Mark all read" when everything is seen', () => {
    renderView({ notifs: [mk('a', 1000)], state: { a: { ts: NOW, seen: true } } });
    expect(screen.queryByRole('button', { name: 'Mark all read' })).toBeNull();
  });

  it('reports a row as seen once when it scrolls into view, ignoring already-seen rows', () => {
    const { props, container } = renderView({
      notifs: [mk('a', 1000), mk('b', 2000)],
      state: { a: { ts: NOW, seen: false }, b: { ts: NOW, seen: true } },
    });
    const rowA = container.querySelector('[data-nid="a"]') as Element;
    const rowB = container.querySelector('[data-nid="b"]') as Element;
    act(() => io.intersect(rowB));
    expect(props.onSeen).not.toHaveBeenCalled();
    act(() => io.intersect(rowA, false));
    expect(props.onSeen).not.toHaveBeenCalled();
    act(() => io.intersect(rowA));
    expect(props.onSeen).toHaveBeenCalledWith(['a']);
    act(() => io.intersect(rowA));
    expect(props.onSeen).toHaveBeenCalledTimes(1);
  });

  it('keeps the unread highlight after the parent marks it read (state frozen at open)', () => {
    const state = unreadState(['a']);
    const { container, rerender, props } = renderView({ notifs: [mk('a', 1000)], state });
    rerender(
      <NotificationsView
        {...props}
        notifs={[mk('a', 1000)]}
        state={{ a: { ts: NOW, seen: true } }}
      />,
    );
    expect(container.querySelectorAll('.notif-row.unread').length).toBe(1);
  });

  it('rows with a target are buttons that navigate via the hash; others are plain', () => {
    const { container } = renderView({
      notifs: [mk('a', 1000, { nav: '#/goals' }), mk('b', 2000)],
    });
    const linked = screen.getByRole('button', { name: /Title a/ });
    fireEvent.click(linked);
    expect(window.location.hash).toBe('#/goals');
    expect(container.querySelector('[data-nid="b"]')?.tagName).toBe('DIV');
  });

  it('pages the feed: 24 rows first, more when the bottom sentinel intersects', () => {
    const notifs = Array.from({ length: 30 }, (_, i) => mk(`n${i}`, 1000 + i));
    const { container } = renderView({ notifs });
    expect(container.querySelectorAll('[data-nid]').length).toBe(24);
    const sentinel = container.querySelector('.notif-feed > div[aria-hidden]') as Element;
    act(() => io.intersect(sentinel));
    expect(container.querySelectorAll('[data-nid]').length).toBe(30);
  });

  it('back button closes in overlay mode; embedded mode has no back and takes a custom title', () => {
    const a = renderView({ notifs: [mk('a', 1)] });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(a.props.onClose).toHaveBeenCalled();
    cleanup();
    renderView({ embedded: true, title: 'Inbox', notifs: [mk('a', 1)] });
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getByText('Inbox')).toBeTruthy();
  });

  it('renders the recap shelf only when the screen is given an opener', () => {
    renderView({ notifs: [mk('a', 1)] });
    expect(within(document.body).queryByText(/Your recaps/i)).toBeNull();
  });
});
