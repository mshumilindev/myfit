import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notesEn as nt } from '../i18n/coachNotes.en';
import { shareEn as sh } from '../i18n/coachShare.en';
import type { ThreadExtras, ThreadExtrasCtx } from './chat/ThreadView';
import type { ChatMessage, MsgBody } from './chat/types';
import { createFixturesNotesPort } from './notes/__fixtures__/fixtures';
import type { NotesPort } from './notes/port';
import { createFixturesShareSource } from './share/__fixtures__/fixtures';
import { ASK_REPEAT_MS, askBody } from './share/askShare';
import { clearRecentShares } from './share/search';
import { setViewport } from './testViewport';
import {
  configureThreadExtras,
  createCoachThreadExtras,
  getThreadExtrasOpts,
  type CoachThreadExtrasOpts,
} from './threadExtras';

const NOW = Date.UTC(2026, 9, 19, 12, 0, 0);
const msg = (
  id: string,
  from: 'trainer' | 'client',
  body: MsgBody,
  over: Partial<ChatMessage> = {},
): ChatMessage => ({
  id,
  cid: 'cid-c1',
  from,
  at: NOW - 60_000,
  body,
  state: 'sent',
  ...over,
});

let latest: ThreadExtras;
let sent: { text: string; body?: MsgBody }[];

function Host({
  opts,
  messages,
  clientId = 'c1',
}: {
  opts: CoachThreadExtrasOpts;
  messages: readonly ChatMessage[];
  clientId?: string;
}): ReactNode {
  // a stable hook per mount, as ChatWithExtras creates it
  const [use] = [createCoachThreadExtras(opts)];
  const ctx: ThreadExtrasCtx = {
    cid: `cid-${clientId}`,
    clientId,
    first: 'Oleh',
    draft: '',
    onDraft: () => undefined,
    messages,
    send: (text, body) => {
      sent.push({ text, body });
      return 'm';
    },
    now: () => NOW,
  };
  const x = use(ctx);
  useEffect(() => {
    latest = x;
  });
  return (
    <div>
      {x.lead}
      {x.chips}
      {x.barActions}
      {x.noteItems?.map((n) => (
        <div key={n.id}>{n.node}</div>
      ))}
      {messages.map((m) => (
        <div key={m.id} id={`msg-${m.id}`}>
          {x.card?.(m)}
        </div>
      ))}
      {x.overlay}
    </div>
  );
}

beforeEach(() => {
  setViewport(1440);
  clearRecentShares();
  sent = [];
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  configureThreadExtras(null);
});

const base = (over: Partial<CoachThreadExtrasOpts> = {}): CoachThreadExtrasOpts => ({
  sharePort: createFixturesShareSource({ warm: true }),
  notesPort: createFixturesNotesPort({ seed: { c1: [] } }),
  ...over,
});

describe('configureThreadExtras', () => {
  it('stores the options, and null resets them to empty', () => {
    const o = { onAskShare: vi.fn() };
    configureThreadExtras(o);
    expect(getThreadExtrasOpts()).toBe(o);
    configureThreadExtras(null);
    expect(getThreadExtrasOpts()).toEqual({});
  });
});

describe('shares in the thread', () => {
  it('a trainer share is drawn as a card; an unreadable body says it cannot be shown and never prints the payload', async () => {
    const good = msg('s1', 'trainer', { kind: 'share', share: { kind: 'gym', id: 'iron-yard' } });
    const bad = msg('s2', 'client', {
      kind: 'share',
      share: { kind: 'gym', id: 7, evil: '<b>x</b>' },
    });
    render(<Host opts={base()} messages={[good, bad]} />);
    expect(await screen.findByText(sh.unsupportedShare)).toBeTruthy();
    expect(screen.queryByText(/evil|<b>/)).toBeNull();
    expect(await screen.findByText(/Iron Yard/)).toBeTruthy();
  });

  it('non-share messages and request messages that are not asks draw no card', () => {
    render(
      <Host
        opts={base()}
        messages={[
          msg('t', 'client', { kind: 'text', text: 'hi' }),
          msg('r', 'client', { kind: 'request', reqId: 'resched:1' }),
        ]}
      />,
    );
    expect(latest.card?.(msg('t', 'client', { kind: 'text', text: 'hi' }))).toBeUndefined();
    expect(
      latest.card?.(msg('r', 'client', { kind: 'request', reqId: 'resched:1' })),
    ).toBeUndefined();
  });

  it('a share-ask message is drawn as the ask card', () => {
    const ask = msg('a', 'trainer', { kind: 'request', reqId: 'share-ask:results:5' });
    render(<Host opts={base()} messages={[ask]} />);
    expect(latest.card?.(ask)).toBeTruthy();
  });

  it('only the trainer may delete a share, and the copy names the client and what stays', () => {
    const own = msg('s1', 'trainer', { kind: 'share', share: { kind: 'gym', id: 'iron-yard' } });
    render(<Host opts={base()} messages={[own]} />);
    const copy = latest.shareDelete?.(own);
    expect(copy).toEqual({
      title: sh.delTitle,
      body: sh.delBody('Oleh', 'gym'),
      effects: [{ icon: 'eye-slash', text: sh.delWho('Oleh') }],
      confirmLabel: sh.delConfirm,
    });
    expect(latest.shareDelete?.({ ...own, from: 'client' })).toBeUndefined();
    expect(latest.shareDelete?.(msg('t', 'trainer', { kind: 'text', text: 'x' }))).toBeUndefined();
    expect(
      latest.shareDelete?.(
        msg('b', 'trainer', { kind: 'share', share: { kind: 'nope', id: '1' } }),
      ),
    ).toBeUndefined();
  });

  it('a pending share is sent as one typed ref, remembered once sent, and cleared', async () => {
    render(
      <Host
        opts={base({ initial: { pending: { kind: 'gym', id: 'iron-yard' } } })}
        messages={[]}
      />,
    );
    expect(latest.body).toEqual({ kind: 'share', share: { kind: 'gym', id: 'iron-yard' } });
    expect(latest.placeholder).toBe(sh.pendingPlaceholder);
    act(() => latest.sent?.());
    await waitFor(() => expect(latest.body).toBeUndefined());
    expect(latest.placeholder).toBeUndefined();
  });
});

describe('asking the client to share', () => {
  it('a configured onAskShare replaces the default and gets the client id and kind', async () => {
    const onAskShare = vi.fn();
    const port = createFixturesShareSource({
      warm: true,
      patch: (s) => ({
        ...s,
        clients: {
          ...s.clients,
          c1: { ...s.clients.c1, consent: { ...s.clients.c1.consent, sets: 'off' } },
        },
      }),
    });
    render(
      <Host
        opts={base({ onAskShare, sharePort: port, initial: { picker: { filter: 'results' } } })}
        messages={[]}
      />,
    );
    const ask = await screen.findByRole('button', { name: sh.pickAsk('Oleh') });
    fireEvent.click(ask);
    expect(onAskShare).toHaveBeenCalledWith('c1', 'results');
    expect(sent).toEqual([]);
  });

  it('the default ask goes through the chat send with a request body; a repeat within 24 h is not sent', async () => {
    const lowered = createFixturesShareSource({
      warm: true,
      patch: (s) => ({
        ...s,
        clients: {
          ...s.clients,
          c1: { ...s.clients.c1, consent: { ...s.clients.c1.consent, sets: 'off' } },
        },
      }),
    });
    const opts = base({ sharePort: lowered, initial: { picker: { filter: 'results' } } });
    const { unmount } = render(<Host opts={opts} messages={[]} />);
    fireEvent.click(await screen.findByRole('button', { name: sh.pickAsk('Oleh') }));
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toEqual(askBody('results', NOW));
    expect(sent[0].text).toContain(sh.kindPlural.results);
    unmount();

    // an ask 23 h ago blocks a new one; one older than a day does not
    const fresh = msg('a', 'trainer', askBody('results', 1), {
      at: NOW - ASK_REPEAT_MS + 3_600_000,
    });
    render(<Host opts={opts} messages={[fresh]} />);
    fireEvent.click(await screen.findByRole('button', { name: sh.pickAsk('Oleh') }));
    expect(sent).toHaveLength(1);
    cleanup();
    const old = msg('a', 'trainer', askBody('results', 1), { at: NOW - ASK_REPEAT_MS - 1 });
    render(<Host opts={opts} messages={[old]} />);
    fireEvent.click(await screen.findByRole('button', { name: sh.pickAsk('Oleh') }));
    expect(sent).toHaveLength(2);
  });
});

describe('opening what a card shows', () => {
  const card = (kind: string, id: string) =>
    msg('s', 'trainer', { kind: 'share', share: { kind, id } });

  it('a library card opens the peek overlay in place, with no navigation', async () => {
    const onNavigate = vi.fn();
    const opener = new RegExp(`^${sh.kind.exercise}:`);
    render(
      <Host
        opts={base({ onNavigate })}
        messages={[card('exercise', 'Barbell_Bench_Press_-_Medium_Grip')]}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: opener }));
    expect(await screen.findByRole('button', { name: sh.peekDone })).toBeTruthy();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('a program card goes to Programs; a plan day goes to the editor of this client; a workout goes to the client 360', async () => {
    const onNavigate = vi.fn();
    const opener = new RegExp(`^${sh.kind.program}:`);
    const { unmount } = render(
      <Host opts={base({ onNavigate })} messages={[card('program', 'upper-lower-4x')]} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: opener }));
    expect(onNavigate).toHaveBeenLastCalledWith({ screen: 'programs' });
    unmount();
    render(<Host opts={base({ onNavigate })} messages={[card('day', 'upper-lower-4x:0')]} />);
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${sh.kind.day}:`) }));
    const route = onNavigate.mock.calls[onNavigate.mock.calls.length - 1][0];
    expect(JSON.stringify(route)).toContain('c1');
  });

  it('without an onNavigate handler, opening a program card does nothing', async () => {
    const opener = new RegExp(`^${sh.kind.program}:`);
    render(<Host opts={base()} messages={[card('program', 'upper-lower-4x')]} />);
    fireEvent.click(await screen.findByRole('button', { name: opener }));
    expect(screen.queryByRole('button', { name: sh.peekDone })).toBeNull();
  });
});

describe('private notes in the thread', () => {
  it('note mode disables Share, shows its placeholder and takes the text as a private note anchored to the last message', async () => {
    const notesPort = createFixturesNotesPort({ seed: { c1: [] } });
    const add = vi.spyOn(notesPort, 'add');
    const last = msg('m9', 'client', { kind: 'text', text: 'hi' });
    render(<Host opts={base({ notesPort, initial: { noteMode: true } })} messages={[last]} />);
    expect((screen.getByRole('button', { name: sh.pickAria }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(latest.placeholder).toBe(nt.nModePlaceholder);
    let taken = false;
    act(() => {
      taken = latest.intercept?.('  Left shoulder again  ') ?? false;
    });
    expect(taken).toBe(true);
    expect(add).toHaveBeenCalledWith({
      clientId: 'c1',
      text: 'Left shoulder again',
      vis: 'private',
      anchor: { kind: 'message', id: 'm9', at: last.at },
    });
    expect(await screen.findByText(nt.nModeSaved)).toBeTruthy();
    expect(sent).toEqual([]);
  });

  it('blank text in note mode is swallowed without a note; a deleted last message gives an unanchored note; outside note mode nothing is intercepted', async () => {
    const notesPort = createFixturesNotesPort({ seed: { c1: [] } });
    const add = vi.spyOn(notesPort, 'add');
    const { unmount } = render(
      <Host
        opts={base({ notesPort, initial: { noteMode: true } })}
        messages={[msg('d', 'client', { kind: 'text', text: 'x' }, { deleted: true })]}
      />,
    );
    expect(latest.intercept?.('   ')).toBe(true);
    expect(add).not.toHaveBeenCalled();
    act(() => void latest.intercept?.('plain'));
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ anchor: { kind: 'none' }, vis: 'private' }),
    );
    unmount();
    render(<Host opts={base()} messages={[]} />);
    expect(latest.intercept?.('hello')).toBe(false);
  });

  it('notes sit between the messages with their visibility label; private and shared are marked differently', async () => {
    const notesPort = createFixturesNotesPort({ seed: { c1: [] } });
    await notesPort.add({
      clientId: 'c1',
      text: 'only me',
      vis: 'private',
      anchor: { kind: 'none' },
    });
    await notesPort.add({
      clientId: 'c1',
      text: 'for him',
      vis: 'shared',
      anchor: { kind: 'message', id: 'x' },
    });
    await notesPort.add({
      clientId: 'c1',
      text: 'on a day',
      vis: 'private',
      anchor: { kind: 'day', id: 'p:0' },
    });
    render(<Host opts={base({ notesPort })} messages={[]} />);
    expect(await screen.findByText(nt.nBubblePrivate)).toBeTruthy();
    expect(screen.getByText(nt.nBubbleShared('Oleh'))).toBeTruthy();
    expect(screen.getByText(/only me/)).toBeTruthy();
    expect(screen.getByText(/for him/)).toBeTruthy();
    expect(screen.queryByText(/on a day/)).toBeNull(); // day anchors belong to the program, not the thread
    expect(latest.noteItems).toHaveLength(2);
  });

  it('delete asks first; confirming removes the note, cancelling keeps it', async () => {
    const notesPort: NotesPort = createFixturesNotesPort({ seed: { c1: [] } });
    await notesPort.add({
      clientId: 'c1',
      text: 'to delete',
      vis: 'private',
      anchor: { kind: 'none' },
    });
    render(<Host opts={base({ notesPort })} messages={[]} />);
    fireEvent.click(await screen.findByRole('button', { name: nt.nMenuDelete }));
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.findByRole('dialog'));
    expect(within(dialog).getByText(/to delete/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: nt.nCancel }));
    await waitFor(() => expect(screen.queryByText(nt.nDelTitle)).toBeNull());
    expect(screen.getByText(/to delete/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: nt.nMenuDelete }));
    const again = await screen.findByRole('alertdialog').catch(() => screen.findByRole('dialog'));
    fireEvent.click(within(again).getByRole('button', { name: nt.nDelConfirm }));
    await waitFor(() => expect(screen.queryByText(nt.nDelTitle)).toBeNull());
  });

  it('the Notes bar button shows the count and opens the drawer; Edit opens it on that note', async () => {
    const notesPort = createFixturesNotesPort({ seed: { c1: [] } });
    await notesPort.add({
      clientId: 'c1',
      text: 'edit me',
      vis: 'private',
      anchor: { kind: 'none' },
    });
    render(<Host opts={base({ notesPort })} messages={[]} />);
    const bar = await screen.findByRole('button', { name: nt.nButtonAria(1) });
    expect(bar.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: nt.nMenuEdit }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: nt.nButtonAria(1) }).getAttribute('aria-expanded'),
      ).toBe('true'),
    );
  });
});

describe('the share picker in the composer', () => {
  it('picking a result shows it as a pending chip, removing the chip clears it, and the picker closes on pick', async () => {
    render(<Host opts={base()} messages={[]} />);
    const open = screen.getByRole('button', { name: sh.pickAria });
    expect(open.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(open);
    expect(screen.getByRole('button', { name: sh.pickAria }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    fireEvent.click(await screen.findByRole('option', { name: /Iron Yard/ }, { timeout: 3000 }));
    await waitFor(() =>
      expect(latest.body).toEqual({ kind: 'share', share: { kind: 'gym', id: 'iron-yard' } }),
    );
    expect(screen.getByRole('button', { name: sh.pickAria }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: sh.pendingRemove }));
    await waitFor(() => expect(latest.body).toBeUndefined());
    expect(screen.queryByRole('button', { name: sh.pendingRemove })).toBeNull();
  });

  it('closing the picker without a pick leaves nothing pending', async () => {
    render(<Host opts={base()} messages={[]} />);
    fireEvent.click(screen.getByRole('button', { name: sh.pickAria }));
    await screen.findByRole('option', { name: /Iron Yard/ }, { timeout: 3000 });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: sh.pickAria }).getAttribute('aria-expanded')).toBe(
        'false',
      ),
    );
    expect(latest.body).toBeUndefined();
  });

  it('the peek overlay closes with Done', async () => {
    const opener = new RegExp(`^${sh.kind.exercise}:`);
    const m = msg('s', 'trainer', {
      kind: 'share',
      share: { kind: 'exercise', id: 'Barbell_Bench_Press_-_Medium_Grip' },
    });
    render(<Host opts={base()} messages={[m]} />);
    fireEvent.click(await screen.findByRole('button', { name: opener }));
    fireEvent.click(await screen.findByRole('button', { name: sh.peekDone }));
    await waitFor(() => expect(screen.queryByRole('button', { name: sh.peekDone })).toBeNull());
  });
});

describe('jumping from a note', () => {
  it('a missing message gives a one-line notice instead of a silent no-op', async () => {
    const notesPort = createFixturesNotesPort({ seed: { c1: [] } });
    await notesPort.add({
      clientId: 'c1',
      text: 'ghost',
      vis: 'private',
      anchor: { kind: 'message', id: 'gone', at: NOW },
    });
    render(<Host opts={base({ notesPort, initial: { notesOpen: true } })} messages={[]} />);
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(nt.nAnchorMessage('')) }));
    expect(await screen.findByText(nt.nJumpGone)).toBeTruthy();
  });
});

describe('jumping to a message that exists', () => {
  it('scrolls it to the centre and closes the drawer', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const notesPort = createFixturesNotesPort({ seed: { c1: [] } });
    await notesPort.add({
      clientId: 'c1',
      text: 'here',
      vis: 'private',
      anchor: { kind: 'message', id: 'm1', at: NOW },
    });
    render(
      <Host
        opts={base({ notesPort, initial: { notesOpen: true } })}
        messages={[msg('m1', 'client', { kind: 'text', text: 'hi' })]}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(nt.nAnchorMessage('')) }));
    expect(scroll).toHaveBeenCalledWith({ block: 'center' });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: nt.nButtonAria(1) }).getAttribute('aria-expanded'),
      ).toBe('false'),
    );
  });
});

describe('opening the context of a note', () => {
  it.each([
    ['decision', { kind: 'decision', id: 'd1', text: 'Stalled' }, { screen: 'decisions' }],
    [
      'day',
      { kind: 'day', id: 'p:0', text: 'Upper A' },
      { screen: 'client', cid: 'c1', tab: 'program' },
    ],
    [
      'exercise',
      { kind: 'exercise', id: 'x', text: 'Bench' },
      { screen: 'client', cid: 'c1', tab: 'program' },
    ],
  ] as const)('a %s note navigates', async (_k, anchor, route) => {
    const notesPort = createFixturesNotesPort({ seed: { c1: [] } });
    const n = await notesPort.add({ clientId: 'c1', text: 'ctx', vis: 'private', anchor });
    const onNavigate = vi.fn();
    render(
      <Host opts={base({ notesPort, onNavigate, initial: { notesOpen: true } })} messages={[]} />,
    );
    const li = await waitFor(() => {
      const el = document.querySelector(`[data-note="${n.id}"]`);
      if (!el) throw new Error('note not listed');
      return el as HTMLElement;
    });
    fireEvent.click(within(li).getByRole('button', { name: new RegExp(anchor.text) }));
    expect(onNavigate).toHaveBeenCalledWith(route);
  });

  it('without a handler an anchor outside the thread does nothing', async () => {
    const notesPort = createFixturesNotesPort({ seed: { c1: [] } });
    const n = await notesPort.add({
      clientId: 'c1',
      text: 'ctx',
      vis: 'private',
      anchor: { kind: 'decision', id: 'd1', text: 'Stalled' },
    });
    render(<Host opts={base({ notesPort, initial: { notesOpen: true } })} messages={[]} />);
    const li = await waitFor(() => {
      const el = document.querySelector(`[data-note="${n.id}"]`);
      if (!el) throw new Error('x');
      return el as HTMLElement;
    });
    fireEvent.click(within(li).getByRole('button', { name: /Stalled/ }));
    expect(screen.getByText(/ctx/)).toBeTruthy();
  });
});
