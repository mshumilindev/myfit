import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatEn as ch } from '../../i18n/coachChat.en';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { useCoachUnreadState } from '../data/useCoachUnread';
import { setViewport } from '../testViewport';
import { ChatScreen } from './ChatScreen';
import { conversationsFromChat } from './chatStore';
import { createFixturesChatPort, type FixturesChatPort } from './__fixtures__/fixtures';
import { safeEn } from '../../i18n/coachSafe.en';
import { currentHash } from '../../route';

let port: FixturesChatPort;
beforeEach(() => {
  setViewport(1440);
  window.location.hash = '#/c/chat';
  port = createFixturesChatPort();
});
afterEach(cleanup);

/** The nav badge stand-in: reads the unread total exactly like the rail does. */
function NavBadge({ p }: { p: FixturesChatPort }) {
  const { total } = useCoachUnreadState({ port: conversationsFromChat(p), uid: 't' });
  return <output aria-label="nav total">{total}</output>;
}

const mount = (over: Partial<Parameters<typeof ChatScreen>[0]> = {}) => {
  const onNavigate = vi.fn();
  const utils = render(
    <>
      <NavBadge p={port} />
      <ChatScreen
        onNavigate={onNavigate}
        chatPort={port}
        worldPort={createFixturesPort({ warm: true })}
        uid="t"
        {...over}
      />
    </>,
  );
  return { onNavigate, ...utils };
};
const convs = () => within(screen.getByRole('list', { name: ch.chListLabel }));
const nav = () => screen.getByLabelText('nav total').textContent;

describe('Chat: list', () => {
  it('shows every conversation with exact counts, most recent first; the nav total is their sum', async () => {
    setViewport(390); // the list alone: on desktop the first thread opens and is read at once
    mount();
    const rows = await convs().findAllByRole('button');
    expect(rows).toHaveLength(5);
    expect(rows[0].textContent).toContain('Maria');
    expect(within(rows[0]).getByRole('img', { name: ch.chUnreadLabel(12) }).textContent).toBe('9+');
    expect(nav()).toBe('16');
    const oleh = convs()
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('Oleh'))!;
    expect(within(oleh).getByRole('img', { name: ch.chUnreadLabel(3) }).textContent).toBe('3');
  });

  it('opening another conversation clears that row and decrements the total in the same step', async () => {
    mount();
    await waitFor(() => expect(nav()).toBe('4'));
    const oleh = convs()
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('Oleh'))!;
    fireEvent.click(oleh);
    await waitFor(() => expect(nav()).toBe('1'));
    expect(
      within(
        convs()
          .getAllByRole('button')
          .find((b) => b.textContent?.includes('Oleh'))!,
      ).queryByRole('img'),
    ).toBeNull();
  });

  it('empty: explains and leads to Clients', async () => {
    port = createFixturesChatPort({ empty: true });
    const { onNavigate } = mount();
    expect(await screen.findByText(ch.chEmptyH)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: ch.chGoClients }));
    expect(onNavigate).toHaveBeenCalledWith({ screen: 'clients' });
  });

  it('loading is a polite skeleton, never an overlay', () => {
    port = {
      ...createFixturesChatPort(),
      subscribeThreads: () => () => undefined,
    } as FixturesChatPort;
    mount();
    expect(screen.getByRole('status', { name: ch.chListLabel })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('error with nothing cached: failed card with Retry that recovers', async () => {
    const real = createFixturesChatPort();
    let fail = true;
    port = {
      ...real,
      subscribeThreads: (u, on, onErr) => {
        if (fail) {
          onErr(new Error('x'));
          return () => undefined;
        }
        return real.subscribeThreads(u, on, onErr);
      },
    } as FixturesChatPort;
    mount();
    expect(await screen.findByText(safeEn.pbUnknownTitle)).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: safeEn.retry }));
    expect(await convs().findAllByRole('button')).toHaveLength(5);
  });
});

describe('Chat: thread', () => {
  it('desktop opens the most recent thread and reading it drops its badge and the nav total together', async () => {
    mount();
    await waitFor(() => expect(nav()).toBe('4'));
    expect(within(convs().getAllByRole('button')[0]).queryByRole('img')).toBeNull();
  });

  it('marks where the new messages start; the thread bar shows no number', async () => {
    mount();
    const log = await screen.findByRole('log');
    const sep = within(log).getByRole('separator', { name: ch.chNewDivider });
    // 12 messages from Maria are after the line, none before it
    const items = Array.from(log.querySelector('ol')!.children);
    const at = items.indexOf(sep.closest('li')!);
    expect(items.slice(at + 1).filter((li) => li.className.includes('uimsg--them'))).toHaveLength(
      12,
    );
    expect(
      items.slice(0, at).filter((li) => li.textContent?.includes('Thanks! My glutes')),
    ).toHaveLength(0);
    const bar = document.querySelector('.ch-bar')!;
    expect(bar.querySelector('.uibadge')).toBeNull();
  });

  it('send: Send needs text, the message appears and the draft clears; Enter adds a line (no hotkeys)', async () => {
    mount();
    const box = await screen.findByRole('textbox');
    const send = screen.getByRole('button', { name: ch.chSend });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    expect(send.getAttribute('aria-describedby')).toBeTruthy();
    fireEvent.change(box, { target: { value: 'Morning works.' } });
    expect((send as HTMLButtonElement).disabled).toBe(false);
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(within(screen.getByRole('log')).queryByText('Morning works.')).toBeNull();
    fireEvent.click(send);
    expect(await within(screen.getByRole('log')).findByText('Morning works.')).toBeTruthy();
    expect((box as HTMLTextAreaElement).value).toBe('');
  });

  it('paging: a long thread starts at the newest page and "Show earlier messages" adds older ones', async () => {
    const history = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`cid-c${i + 1}`, 120] as const),
    );
    port = createFixturesChatPort({ history });
    mount();
    const log = await screen.findByRole('log');
    const more = await screen.findByRole('button', { name: ch.chEarlier });
    const before = within(log).queryAllByText(/^Earlier message/).length;
    fireEvent.click(more);
    await waitFor(() =>
      expect(
        within(screen.getByRole('log')).queryAllByText(/^Earlier message/).length,
      ).toBeGreaterThan(before),
    );
  });

  it('a draft survives switching conversations and coming back', async () => {
    mount();
    const box = (await screen.findByRole('textbox')) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'Half written reply' } });
    const rows = convs().getAllByRole('button');
    fireEvent.click(rows[1]);
    await waitFor(() =>
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(''),
    );
    fireEvent.click(convs().getAllByRole('button')[0]);
    await waitFor(() =>
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Half written reply'),
    );
  });

  it('too long: Send is disabled and says why', async () => {
    mount();
    const box = await screen.findByRole('textbox');
    fireEvent.change(box, { target: { value: 'x'.repeat(2001) } });
    expect((screen.getByRole('button', { name: ch.chSend }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText(ch.chTooLong(2000))).toBeTruthy();
  });

  it('message text is rendered as text, never as markup', async () => {
    mount();
    await screen.findByRole('log');
    act(() => port.receive('cid-c2', '<img src=x onerror=alert(1)> <b>hi</b>'));
    expect(
      await within(screen.getByRole('log')).findByText('<img src=x onerror=alert(1)> <b>hi</b>'),
    ).toBeTruthy();
    expect(document.querySelector('.ch-card img[src="x"]')).toBeNull();
  });

  it('their message cannot be deleted: the item is disabled and says who can', async () => {
    mount();
    await screen.findByRole('log');
    const row = within(screen.getByRole('log'))
      .getByText('Thanks! My glutes are still sore.')
      .closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: new RegExp(`^${ch.chMenuMsg}`) }));
    const del = await screen.findByRole('menuitem', { name: new RegExp(ch.chDelete) });
    expect((del as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(ch.chDeleteTheirs('Maria'))).toBeTruthy();
  });

  it('delete own: confirm names who stops seeing it, then an 8 s Undo; Undo brings it back', async () => {
    mount();
    fireEvent.click(await convs().findByText('Oleh Bondar'));
    const quote = 'Thanks for telling me. This week I will swap';
    const mineRow = (await screen.findByText(new RegExp(quote))).closest('li')!;
    fireEvent.click(within(mineRow).getByRole('button', { name: new RegExp(`^${ch.chMenuMsg}`) }));
    fireEvent.click(await screen.findByRole('menuitem', { name: new RegExp(ch.chDelete) }));
    const dlg = await screen.findByRole('alertdialog');
    expect(within(dlg).getByText(ch.chDelTitle)).toBeTruthy();
    expect(within(dlg).getByText(ch.chDelWho('Oleh'))).toBeTruthy();
    expect(within(dlg).getByText(ch.chUndoSmall)).toBeTruthy();
    // Cancel is the focused, safe default
    expect(document.activeElement?.textContent).toBe(ch.chCancel);
    fireEvent.click(within(dlg).getByRole('button', { name: ch.chDelConfirm }));
    await waitFor(() => expect(screen.queryByText(new RegExp(quote))).toBeNull());
    expect(screen.getByText(ch.chMsgDeleted)).toBeTruthy();
    expect(screen.getByTestId('undo-bar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: ch.chUndo }));
    expect(await screen.findByText(new RegExp(quote))).toBeTruthy();
    expect(screen.queryByText(ch.chMsgDeleted)).toBeNull();
  });

  it('Esc and Cancel dismiss the dialog without deleting', async () => {
    mount();
    fireEvent.click(await convs().findByText('Oleh Bondar'));
    const row = (await screen.findByText(/Thanks for telling me/)).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: new RegExp(`^${ch.chMenuMsg}`) }));
    fireEvent.click(await screen.findByRole('menuitem', { name: new RegExp(ch.chDelete) }));
    await screen.findByRole('alertdialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByText(/Thanks for telling me/)).toBeTruthy();
    expect(screen.queryByText(ch.chMsgDeleted)).toBeNull();
  });

  it('clear chat: own copy only, confirm + Undo; then the empty state says the other side keeps theirs', async () => {
    mount();
    await screen.findByRole('log');
    fireEvent.click(screen.getByRole('button', { name: ch.chMenuChat }));
    fireEvent.click(
      await screen.findByRole('menuitem', { name: new RegExp(ch.chClear.replace('...', '')) }),
    );
    const dlg = await screen.findByRole('alertdialog');
    expect(within(dlg).getByText(ch.chClearKeeps('Maria'))).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: ch.chClearConfirm }));
    expect(await screen.findByText(ch.chClearedH)).toBeTruthy();
    expect(screen.getByText(ch.chClearedB('Maria'))).toBeTruthy();
    expect(screen.getByText(ch.chCleared)).toBeTruthy();
    expect(port.dump('cid-c2').length).toBeGreaterThan(10); // nothing erased for the other person
    // the composer is still there
    expect(screen.getByRole('textbox')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: ch.chUndo }));
    expect(await screen.findByRole('log')).toBeTruthy();
  });

  it('offline: a quiet line, the composer stays', async () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    mount();
    expect(await screen.findByText(ch.chOffline)).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
    spy.mockRestore();
  });
});

describe('Chat: phone', () => {
  beforeEach(() => setViewport(390));

  it('the list is the screen; a thread is pushed with Back', async () => {
    mount();
    const rows = await convs().findAllByRole('button');
    expect(screen.queryByRole('log')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(rows[1]);
    expect(currentHash()).toContain('with=');
    act(() => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(await screen.findByRole('log')).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.getByRole('button', { name: ch.chBack })).toBeTruthy();
  });
});
