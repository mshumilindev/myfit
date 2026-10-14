import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shareEn as sh } from '../../i18n/coachShare.en';
import { safeEn as sf } from '../../i18n/coachSafe.en';
import { ChatScreen } from '../chat/ChatScreen';
import { createFixturesChatPort, type FixturesChatPort } from '../chat/__fixtures__/fixtures';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { createFixturesNotesPort } from '../notes/__fixtures__/fixtures';
import { setViewport } from '../testViewport';
import { createCoachThreadExtras } from '../threadExtras';
import { AskCard } from './AskCard';
import { askBody, askedRecently, parseAskReqId } from './askShare';
import { createFixturesShareSource } from './__fixtures__/fixtures';
import { clearRecentShares } from './search';

let chat: FixturesChatPort;
beforeEach(() => {
  setViewport(1440);
  window.location.hash = '#/c/chat?with=c1';
  chat = createFixturesChatPort();
  clearRecentShares();
});
afterEach(cleanup);

const msgs = () => {
  let out: { from: string; at: number; body: { kind: string; reqId?: string } }[] = [];
  chat.subscribeMessages(
    'cid-c1',
    (m) => (out = m as never),
    () => undefined,
  )();
  return out;
};

describe('share-ask request ids', () => {
  it('round-trip, and a reschedule request id is not an ask', () => {
    const b = askBody('workout', 5);
    expect(b.kind === 'request' && parseAskReqId(b.reqId)).toBe('workout');
    expect(parseAskReqId('rq1')).toBeNull();
    expect(parseAskReqId('share-ask:nope:1')).toBeNull();
  });
  it('asks within a day are throttled, older ones are not', () => {
    const m = (at: number) =>
      ({
        id: 'a',
        cid: 'c',
        from: 'trainer',
        at,
        body: askBody('workout', at),
        state: 'sent',
      }) as never;
    expect(askedRecently([m(1000)], 'workout', 2000)).toBe(true);
    expect(askedRecently([m(1000)], 'workout', 2000 + 25 * 3600_000)).toBe(false);
    expect(askedRecently([m(1000)], 'activity', 2000)).toBe(false);
  });
});

describe('Ask to share (S-21)', () => {
  it('Ask sends a real request message through the chat port and draws the card', async () => {
    const before = msgs().length;
    render(
      <ChatScreen
        onNavigate={vi.fn()}
        chatPort={chat}
        worldPort={createFixturesPort({ warm: true })}
        uid="t"
        useThreadExtras={createCoachThreadExtras({
          notesPort: createFixturesNotesPort(),
          sharePort: createFixturesShareSource({
            warm: true,
            patch: (s) => ({
              ...s,
              clients: {
                ...s.clients,
                c1: { ...s.clients.c1, consent: { ...s.clients.c1.consent, totals: 'off' } },
              },
            }),
          }),
        })}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: sh.pickAria }));
    const box = await screen.findByRole('combobox', { name: sh.pickSearchAria });
    fireEvent.change(box, { target: { value: 'a' } });
    const ask = (await screen.findAllByRole('button', { name: sh.pickAsk('Oleh') }))[0];
    fireEvent.click(ask);
    await waitFor(() => expect(msgs().length).toBe(before + 1));
    const sent = msgs()[msgs().length - 1];
    expect(sent.from).toBe('trainer');
    expect(sent.body.kind).toBe('request');
    expect(parseAskReqId(sent.body.reqId ?? '')).not.toBeNull();
    // the card is drawn in the thread
    expect(await screen.findByText(sf.askCardKind)).toBeTruthy();
  });
});

describe('AskCard', () => {
  it('trainer and client read the same kind in their own words, the client can open sharing', () => {
    const open = vi.fn();
    const { rerender } = render(<AskCard kind="workout" side="trainer" mine />);
    expect(screen.getByText(sf.askCardMine(sh.kindPlural.workout))).toBeTruthy();
    rerender(<AskCard kind="workout" side="client" mine={false} onOpenSharing={open} />);
    expect(
      screen.getByText(new RegExp(sf.askCardTheirs(sh.kindPlural.workout).slice(0, 12))),
    ).toBeTruthy();
    fireEvent.click(within(document.body).getByRole('button', { name: sf.askCardOpen }));
    expect(open).toHaveBeenCalled();
  });
});
