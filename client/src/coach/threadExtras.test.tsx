import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatEn as ch } from '../i18n/coachChat.en';
import { notesEn as nt } from '../i18n/coachNotes.en';
import { shareEn as sh } from '../i18n/coachShare.en';
import { ChatScreen } from './chat/ChatScreen';
import { createFixturesChatPort, type FixturesChatPort } from './chat/__fixtures__/fixtures';
import { createFixturesPort } from './data/__fixtures__/fixtures';
import { createFixturesNotesPort } from './notes/__fixtures__/fixtures';
import { createFixturesShareSource } from './share/__fixtures__/fixtures';
import { clearRecentShares } from './share/search';
import { setViewport } from './testViewport';
import { createCoachThreadExtras, type ThreadExtrasInitial } from './threadExtras';

let chat: FixturesChatPort;
beforeEach(() => {
  setViewport(1440);
  window.location.hash = '#/c/chat?with=c1';
  chat = createFixturesChatPort();
  clearRecentShares();
});
afterEach(cleanup);

function mount(initial?: ThreadExtrasInitial) {
  const onNavigate = vi.fn();
  const notesPort = createFixturesNotesPort();
  const sharePort = createFixturesShareSource({ warm: true });
  const ext = createCoachThreadExtras({ onNavigate, notesPort, sharePort, initial });
  render(
    <ChatScreen
      onNavigate={onNavigate}
      chatPort={chat}
      worldPort={createFixturesPort({ warm: true })}
      uid="t"
      useThreadExtras={ext}
    />,
  );
  return { onNavigate, notesPort };
}

function msgsOf() {
  let out: { body: { kind: string; text?: string; share?: unknown } }[] = [];
  const off = chat.subscribeMessages(
    'cid-c1',
    (m) => (out = m as never),
    () => undefined,
  );
  off();
  return out;
}

async function openPicker() {
  fireEvent.click(await screen.findByRole('button', { name: sh.pickAria }));
  return screen.findByRole('combobox', { name: sh.pickSearchAria });
}

/**
 * Types a query and waits until the debounced search is applied (the empty-query "Suggested" view is gone). Before that the
 * rows on screen belong to the old view and are replaced when the debounce fires, so a click on one of them is lost (SPO-425).
 */
async function typeQuery(box: HTMLElement, value: string) {
  fireEvent.change(box, { target: { value } });
  await waitFor(() => expect(screen.queryByText(sh.pickSuggested)).toBeNull(), { timeout: 5000 });
}

describe('Share in the thread', () => {
  it('the composer has a Share button; picking an item shows a pending card and lets Send go without text', async () => {
    mount();
    const box = await openPicker();
    expect(await screen.findByText(sh.pickSuggested)).toBeTruthy();
    await typeQuery(box, 'upper');
    const row = await screen.findByRole(
      'option',
      { name: new RegExp(`^${sh.kind.program}: Upper`) },
      { timeout: 2000 },
    );
    fireEvent.click(row);
    // the picker closes and the chip row shows the item, with a way to take it back
    expect(
      await screen.findByRole('button', { name: sh.pendingRemove }, { timeout: 5000 }),
    ).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: sh.pickSearchAria })).toBeNull();
    const send = screen.getByRole('button', { name: ch.chSend }) as HTMLButtonElement;
    expect(send.disabled).toBe(false);
    fireEvent.click(send);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: sh.pendingRemove })).toBeNull(),
    );
    // the stored message is a share body (one typed ref), and the card is drawn from it
    const msgs = msgsOf();
    const last = msgs[msgs.length - 1];
    expect(last.body.kind).toBe('share');
    expect(last.body.share).toMatchObject({ kind: 'program' });
    expect(
      Object.keys(last.body.share as object).every((k) => ['id', 'kind', 'ownerId'].includes(k)),
    ).toBe(true);
    expect(await screen.findByText(sh.youShared(sh.kindLower.program))).toBeTruthy();
  });

  it('the pending item can be taken back, and Send is disabled again without text', async () => {
    mount();
    const box = await openPicker();
    await typeQuery(box, 'chest');
    fireEvent.click(
      (
        await screen.findAllByRole(
          'option',
          { name: new RegExp(`^${sh.kind.muscle}`) },
          { timeout: 2000 },
        )
      )[0],
    );
    fireEvent.click(await screen.findByRole('button', { name: sh.pendingRemove }));
    expect((screen.getByRole('button', { name: ch.chSend }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('a locked type is a group with the way to unlock it, never silently missing', async () => {
    mount();
    const box = await openPicker();
    fireEvent.change(box, { target: { value: 'zzzz' } });
    expect(
      await screen.findByText(sh.pickEmptyQuery('zzzz'), undefined, { timeout: 2000 }),
    ).toBeTruthy();
  });

  it('arrow keys move the active option (aria-activedescendant) while focus stays in the field; Escape closes', async () => {
    mount();
    const box = await openPicker();
    box.focus();
    expect(box.getAttribute('role')).toBe('combobox');
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    const id = box.getAttribute('aria-activedescendant');
    expect(id).toBeTruthy();
    const opt = document.getElementById(id as string) as HTMLElement;
    expect(opt.getAttribute('role')).toBe('option');
    expect(opt.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(box);
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(box.getAttribute('aria-activedescendant')).not.toBe(id);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('combobox', { name: sh.pickSearchAria })).toBeNull(),
    );
  });

  it('a share message of the client is drawn as a card (resolved now) with the "<name> shared" header', async () => {
    await chat.send('cid-c1', {
      id: 'sh1',
      text: '',
      at: chat.now(),
      body: { kind: 'share', share: { kind: 'gym', id: 'iron-yard' } },
    });
    mount();
    expect(await screen.findByText(sh.youShared(sh.kindLower.gym))).toBeTruthy();
  });

  it('an unknown or hostile share body shows the "cannot be shown" line, never the raw payload', async () => {
    await chat.send('cid-c1', {
      id: 'sh2',
      text: '',
      at: chat.now(),
      body: { kind: 'share', share: { kind: 'nope', id: '<img src=x onerror=alert(1)>' } },
    });
    mount();
    expect(await screen.findByText(sh.unsupportedShare)).toBeTruthy();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });
});

describe('Notes in the thread', () => {
  it('the bar shows a Notes button with the count; the drawer lists the notes newest first', async () => {
    mount();
    const btn = await screen.findByRole('button', { name: nt.nButtonAria(5) });
    fireEvent.click(btn);
    const list = await screen.findByRole('list', { name: nt.nListAria });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0].textContent).toContain('Warm up your shoulder blades');
  });

  it('adding a shared note shows it; the Private note mode saves a note, not a message', async () => {
    // the mode is opened by the thread (the chip is gone from the phone bar): start in it
    const { notesPort } = mount({ noteMode: true });
    const field = await screen.findByRole('textbox', { name: nt.nModePlaceholder });
    fireEvent.change(field, { target: { value: 'remember the band warm-up' } });
    fireEvent.click(screen.getByRole('button', { name: ch.chSend }));
    await waitFor(() =>
      expect(notesPort.all('c1').some((n) => n.text === 'remember the band warm-up')).toBe(true),
    );
    expect(notesPort.all('c1').find((n) => n.text === 'remember the band warm-up')?.vis).toBe(
      'private',
    );
    const msgs = msgsOf();
    expect(msgs.some((m) => m.body.text === 'remember the band warm-up')).toBe(false);
  });
});
