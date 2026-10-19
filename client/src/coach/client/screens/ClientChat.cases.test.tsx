/** The member's chat with their trainer: header actions, the thread menu, send / delete / clear with undo, shares, offline. */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatEn as ch } from '../../../i18n/coachChat.en';
import { clientEn as cc } from '../../../i18n/coachClient.en';
import { safeEn as sf } from '../../../i18n/coachSafe.en';
import { setViewport } from '../../testViewport';
import { configureClientCoach } from '../data/config';
import { createFixturesClientChatPort, CLIENT_CID } from '../data/__fixtures__/chat';
import {
  createFixturesClientPort,
  FIXTURE_TRAINER,
  type ClientScenario,
} from '../data/__fixtures__/fixtures';
import { scheduleEn } from '../../../i18n/coachSchedule.en';
import { configureTrustPort } from '../../security/trustPort';
import { createFixturesTrustPort } from '../../security/__fixtures__/trustPort';
import { configureTrustStore, createMemoryTrustStore } from '../../security/trustStore';
import { configureSchedule } from '../../schedule/useSchedule';
import { createFixturesSchedulePort, scheduleSeed } from '../../schedule/__fixtures__/fixtures';
import type { ClientChatPort, ClientThreadData } from '../data/chatPort';
import type { ClientCoachPort } from '../data/port';
import { ClientChat } from './ClientChat';

beforeEach(() => setViewport(390));
afterEach(() => {
  cleanup();
  configureClientCoach();
  configureTrustPort(null);
  configureTrustStore(null);
  configureSchedule(null);
  vi.restoreAllMocks();
});

interface Props {
  onBack?: () => void;
  onOpenSharing?: () => void;
  onOpenTrainer?: () => void;
  onOpenProgram?: () => void;
  port?: ClientCoachPort;
}

function open(chat: ClientChatPort, scenario: ClientScenario = 'active', p: Props = {}) {
  const port = p.port ?? createFixturesClientPort({ scenario });
  configureClientCoach({ port, chat });
  return render(
    <ClientChat
      onBack={p.onBack ?? (() => undefined)}
      onOpenSharing={p.onOpenSharing ?? (() => undefined)}
      onOpenTrainer={p.onOpenTrainer}
      onOpenProgram={p.onOpenProgram}
    />,
  );
}

/** The messages the port holds right now (the fixture port is the "server" side of the test). */
function held(chat: ClientChatPort): ClientThreadData {
  let d!: ClientThreadData;
  chat.subscribe(
    CLIENT_CID,
    (x) => (d = x),
    () => undefined,
  )();
  return d;
}

describe('before there is a trainer to talk to', () => {
  it('a member with no link sees the pushed page with a labelled skeleton, never a composer', async () => {
    open(createFixturesClientChatPort({ unread: 0 }), 'none');
    expect(await screen.findByText(cc.mtTitle)).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Message /)).toBeNull();
    expect(screen.queryByRole('log')).toBeNull();
  });

  it('a link that cannot load is the calm "trainer unavailable" state with a way to the sharing page', async () => {
    const base = createFixturesClientPort({ scenario: 'active' });
    const failing: ClientCoachPort = {
      ...base,
      peek: () => null,
      subscribe: (_on, onError) => {
        onError?.(Object.assign(new Error('x'), { name: 'PortError', code: 'permission-denied' }));
        return () => undefined;
      },
    };
    const onSharing = vi.fn();
    open(createFixturesClientChatPort({ unread: 0 }), 'active', {
      port: failing,
      onOpenSharing: onSharing,
    });
    expect(await screen.findByText(sf.pbDeniedTitle)).toBeTruthy();
    expect(screen.queryByRole('log')).toBeNull();
  });
});

describe('the thread of an active link', () => {
  it('shows the trainer, the messages in order, and marks the thread read', async () => {
    const chat = createFixturesClientChatPort(); // three of the trainer\'s messages are unread
    open(chat);
    const log = await screen.findByRole('log');
    expect(within(log).getByText(/How does your left shoulder feel today\?/)).toBeTruthy();
    expect(screen.getByText('Iryna Melnyk')).toBeTruthy();
    expect(screen.getByPlaceholderText(cc.chPlaceholder('Iryna'))).toBeTruthy();
    // opening the thread reads it: nothing is unread any more on the server side
    await waitFor(() => {
      let unread = -1;
      chat.subscribeUnread(CLIENT_CID, (n) => (unread = n))();
      expect(unread).toBe(0);
    });
  });

  it('header: back, "What Iryna sees" and the Notes button call their handlers', async () => {
    const onBack = vi.fn();
    const onSharing = vi.fn();
    open(createFixturesClientChatPort({ unread: 0 }), 'active', {
      onBack,
      onOpenSharing: onSharing,
    });
    await screen.findByRole('log');
    fireEvent.click(screen.getByRole('button', { name: cc.ccBack }));
    fireEvent.click(screen.getByRole('button', { name: cc.chSeesBtn('Iryna') }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSharing).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Notes from my trainer/ }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('sends the typed text once, trims nothing the person typed, and clears the composer; an empty draft sends nothing', async () => {
    const chat = createFixturesClientChatPort({ unread: 0 });
    open(chat);
    await screen.findByRole('log');
    const before = held(chat).messages.length;
    const box = screen.getByPlaceholderText(cc.chPlaceholder('Iryna')) as HTMLTextAreaElement;
    fireEvent.click(screen.getByRole('button', { name: ch.chSend }));
    expect(held(chat).messages.length).toBe(before);
    fireEvent.change(box, { target: { value: 'Friday works for me' } });
    fireEvent.click(screen.getByRole('button', { name: ch.chSend }));
    await waitFor(() => expect(held(chat).messages.length).toBe(before + 1));
    const sent = held(chat).messages[before];
    expect(sent.from).toBe('client');
    expect(sent.cid).toBe(CLIENT_CID);
    expect(sent.body).toEqual({ kind: 'text', text: 'Friday works for me' });
    expect(box.value).toBe('');
  });
});

describe('the menus', () => {
  it('the chat menu offers My trainer only when the screen can open it, and the security code dialog', async () => {
    const onTrainer = vi.fn();
    open(createFixturesClientChatPort({ unread: 0 }), 'active', { onOpenTrainer: onTrainer });
    await screen.findByRole('log');
    fireEvent.click(screen.getByRole('button', { name: ch.chMenuChat }));
    fireEvent.click(await screen.findByRole('menuitem', { name: cc.chMenuTrainer }));
    expect(onTrainer).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: ch.chMenuChat }));
    fireEvent.click(await screen.findByRole('menuitem', { name: sf.scMenu }));
    expect((await screen.findAllByText(sf.scTitle)).length).toBeGreaterThan(0);
  });

  it('without an onOpenTrainer handler the chat menu has no My trainer entry', async () => {
    open(createFixturesClientChatPort({ unread: 0 }));
    await screen.findByRole('log');
    fireEvent.click(screen.getByRole('button', { name: ch.chMenuChat }));
    await screen.findByRole('menuitem', { name: sf.scMenu });
    expect(screen.queryByRole('menuitem', { name: cc.chMenuTrainer })).toBeNull();
  });

  it('Clear chat asks first, then empties only this side and offers Undo that brings it back', async () => {
    const chat = createFixturesClientChatPort({ unread: 0 });
    open(chat);
    await screen.findByRole('log');
    fireEvent.click(screen.getByRole('button', { name: ch.chMenuChat }));
    fireEvent.click(
      await screen.findByRole('menuitem', { name: new RegExp(ch.chClear.replace('...', '')) }),
    );
    expect(await screen.findByText(ch.chClearTitle)).toBeTruthy();
    expect(held(chat).clearedBefore).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: ch.chClearConfirm }));
    await waitFor(() => expect(held(chat).messages).toHaveLength(0));
    expect(await screen.findByText(ch.chCleared)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: ch.chUndo }));
    await waitFor(() => expect(held(chat).messages.length).toBeGreaterThan(0));
    expect(held(chat).clearedBefore).toBe(0);
  });

  it('Cancel on the clear dialog leaves the thread alone', async () => {
    const chat = createFixturesClientChatPort({ unread: 0 });
    open(chat);
    await screen.findByRole('log');
    fireEvent.click(screen.getByRole('button', { name: ch.chMenuChat }));
    fireEvent.click(
      await screen.findByRole('menuitem', { name: new RegExp(ch.chClear.replace('...', '')) }),
    );
    fireEvent.click(await screen.findByRole('button', { name: ch.chCancel }));
    expect(screen.queryByText(ch.chClearTitle)).toBeNull();
    expect(held(chat).clearedBefore).toBe(0);
  });

  it("a message menu: my own message can be deleted (after confirming), the trainer's cannot", async () => {
    const chat = createFixturesClientChatPort({ unread: 0 });
    open(chat);
    await screen.findByRole('log');
    const buttons = screen.getAllByRole('button', { name: /^Message actions, / });
    // the trainer's message first: Delete is offered disabled-with-reason, never as an action
    fireEvent.click(buttons.find((b) => /Iryna/.test(b.getAttribute('aria-label') ?? ''))!);
    expect(await screen.findByText(ch.chDeleteTheirs('Iryna'))).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    // my own message
    const mine = buttons.find((b) => !/Iryna/.test(b.getAttribute('aria-label') ?? ''))!;
    fireEvent.click(mine);
    fireEvent.click(await screen.findByRole('menuitem', { name: ch.chDelete }));
    expect(await screen.findByText(ch.chDelTitle)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: ch.chDelConfirm }));
    await waitFor(() => expect(screen.getByText(ch.chMsgDeleted)).toBeTruthy());
  });
});

describe('sharing into the chat', () => {
  it('a picked card waits in the composer, can be taken back, and is sent as a share message', async () => {
    const chat = createFixturesClientChatPort({ unread: 0 });
    open(chat);
    await screen.findByRole('log');
    const before = held(chat).messages.length;
    fireEvent.click(screen.getByRole('button', { name: 'Share in chat' }));
    fireEvent.click((await screen.findAllByRole('option'))[0]);
    const remove = await screen.findByRole('button', { name: 'Do not share this item' });
    fireEvent.click(remove);
    expect(screen.queryByRole('button', { name: 'Do not share this item' })).toBeNull();
    // pick again and send
    fireEvent.click(screen.getByRole('button', { name: 'Share in chat' }));
    fireEvent.click((await screen.findAllByRole('option'))[0]);
    const send = await screen.findByRole('button', { name: ch.chSend });
    await waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(send);
    await waitFor(() => expect(held(chat).messages.length).toBe(before + 1));
    expect(held(chat).messages[before].body.kind).toBe('share');
  });
});

describe('connectivity', () => {
  it('shows the offline note while the device is offline and drops it when it is back', async () => {
    const online = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    open(createFixturesClientChatPort({ unread: 0 }));
    await screen.findByRole('log');
    expect(screen.getByText(ch.chOffline)).toBeTruthy();
    online.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(screen.queryByText(ch.chOffline)).toBeNull());
  });
});

describe("the trainer's key changes", () => {
  it('a new key shows the banner and a one-time toast; Review code opens the code and acknowledges the change', async () => {
    const trust = createFixturesTrustPort();
    configureTrustPort(trust);
    configureTrustStore(createMemoryTrustStore());
    open(createFixturesClientChatPort({ unread: 0 }));
    await screen.findByRole('log');
    expect(screen.queryByTestId('key-change-banner')).toBeNull();
    // let the first code be observed, then the trainer gets a new device
    await new Promise((r) => setTimeout(r, 50));
    await act(async () => trust.rotate(FIXTURE_TRAINER.id));
    expect(await screen.findByTestId('key-change-banner')).toBeTruthy();
    // the banner title and the one-time toast say the same words: both are on screen
    expect(screen.getAllByText(sf.scChangedToast('Iryna'))).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: sf.scChangedReview }));
    expect((await screen.findAllByText(sf.scTitle)).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByTestId('key-change-banner')).toBeNull());
  });
});

describe('a message that could not be sent', () => {
  it('stays in the thread as failed and Retry sends it again with the same id', async () => {
    const base = createFixturesClientChatPort({ unread: 0 });
    let fail = true;
    const ids: string[] = [];
    const chat: ClientChatPort = {
      ...base,
      send: async (cid, d) => {
        ids.push(d.id);
        if (fail) throw new Error('offline');
        return base.send(cid, d);
      },
    };
    open(chat);
    await screen.findByRole('log');
    fireEvent.change(screen.getByPlaceholderText(cc.chPlaceholder('Iryna')), {
      target: { value: 'Running late' },
    });
    fireEvent.click(screen.getByRole('button', { name: ch.chSend }));
    expect(await screen.findByText(ch.chFailed)).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: ch.chRetry }));
    await waitFor(() => expect(held(chat).messages.some((m) => m.id === ids[0])).toBe(true));
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
    expect(screen.queryByText(ch.chFailed)).toBeNull();
  });
});

describe('rescheduling from the chat', () => {
  it("the swap button opens the form for the member's own session and closes again", async () => {
    configureSchedule(createFixturesSchedulePort());
    open(createFixturesClientChatPort({ unread: 0 }));
    await screen.findByRole('log');
    fireEvent.click(await screen.findByRole('button', { name: scheduleEn.rcChipAria }));
    expect((await screen.findAllByText(cc.rqTitle)).length).toBeGreaterThan(0);
  });
});

describe('closing what was opened', () => {
  it('the notes drawer, the share picker and the delete dialog close without side effects', async () => {
    const chat = createFixturesClientChatPort({ unread: 0 });
    open(chat);
    await screen.findByRole('log');
    const before = held(chat).messages.length;
    fireEvent.click(screen.getByRole('button', { name: /Notes from my trainer/ }));
    const drawer = await screen.findByRole('dialog');
    fireEvent.keyDown(drawer, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Share in chat' }));
    await screen.findAllByRole('option');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
    expect(held(chat).messages.length).toBe(before);
  });
});

describe("answering the trainer's request with another time", () => {
  it('"Suggest another time" opens the counter form and closing it leaves the request untouched', async () => {
    const seed = scheduleSeed();
    seed.requests = seed.requests.map((r) =>
      r.id === 'rq1' ? { ...r, from: 'trainer' as const } : r,
    );
    const port = createFixturesSchedulePort({ seed });
    configureSchedule(port);
    open(createFixturesClientChatPort({ unread: 0 }));
    fireEvent.click(await screen.findByRole('button', { name: scheduleEn.rcCounter }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // the request is still open: its card still offers the answers
    expect(screen.getByRole('button', { name: scheduleEn.rcCounter })).toBeTruthy();
  });
});

describe('cancelling', () => {
  it('Cancel on the delete dialog keeps my message; closing the security code dialog returns to the thread', async () => {
    const chat = createFixturesClientChatPort({ unread: 0 });
    open(chat);
    await screen.findByRole('log');
    const mine = screen
      .getAllByRole('button', { name: /^Message actions, / })
      .find((b) => !/Iryna/.test(b.getAttribute('aria-label') ?? ''))!;
    fireEvent.click(mine);
    fireEvent.click(await screen.findByRole('menuitem', { name: ch.chDelete }));
    await screen.findByText(ch.chDelTitle);
    fireEvent.click(screen.getByRole('button', { name: ch.chCancel }));
    expect(screen.queryByText(ch.chDelTitle)).toBeNull();
    expect(held(chat).messages.every((m) => !m.deleted)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: ch.chMenuChat }));
    fireEvent.click(await screen.findByRole('menuitem', { name: sf.scMenu }));
    await screen.findAllByText(sf.scTitle);
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getAllByRole('button', { name: sf.scClose }).at(-1)!,
    );
    await waitFor(() => expect(screen.queryAllByText(sf.scTitle)).toHaveLength(0));
  });
});
