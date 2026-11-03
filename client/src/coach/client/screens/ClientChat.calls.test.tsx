/** The member's chat: a finished call waiting in the queue is written into the thread and drawn there. */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { callsEn as cl } from '../../../i18n/calls.en';
import { setViewport } from '../../testViewport';
import { configureClientCoach } from '../data/config';
import { createFixturesClientChatPort, CLIENT_CID } from '../data/__fixtures__/chat';
import { createFixturesClientPort, FIXTURE_TRAINER } from '../data/__fixtures__/fixtures';
import type { ClientThreadData } from '../data/chatPort';
import { queueCallLog } from '../../../calls/callsStore';
import { isCallLog } from '../../calls/CallLogLine';
import { ClientChat } from './ClientChat';

beforeEach(() => setViewport(390));
afterEach(() => {
  cleanup();
  configureClientCoach();
});

describe('call lines in the member chat', () => {
  it('writes the queued call with the trainer and draws it', async () => {
    const chat = createFixturesClientChatPort({ unread: 0 });
    configureClientCoach({ port: createFixturesClientPort({ scenario: 'active' }), chat });
    queueCallLog({
      peerId: FIXTURE_TRAINER.id,
      callId: 'call-member-1',
      entry: { v: 1, k: 'declined', video: false, sec: 0 },
    });
    render(<ClientChat onBack={() => undefined} onOpenSharing={() => undefined} />);
    expect(await screen.findByText(cl.callLogDeclined)).toBeTruthy();
    let d!: ClientThreadData;
    chat.subscribe(
      CLIENT_CID,
      (x) => (d = x),
      () => undefined,
    )();
    await waitFor(() => expect(d.messages.filter((m) => isCallLog(m.body))).toHaveLength(1));
  });
});
