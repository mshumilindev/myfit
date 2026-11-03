/** A finished call waits in the queue and is written into the thread that opens, as a system line the thread draws. */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callsEn as cl } from '../../i18n/calls.en';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { setViewport } from '../testViewport';
import { queueCallLog } from '../../calls/callsStore';
import { isCallLog } from '../calls/CallLogLine';
import { ChatScreen } from './ChatScreen';
import { createFixturesChatPort, type FixturesChatPort } from './__fixtures__/fixtures';

const IDS = ['c1', 'c2', 'c3', 'c7', 'c9'];
let port: FixturesChatPort;
beforeEach(() => {
  setViewport(1440);
  window.location.hash = '#/c/chat';
  port = createFixturesChatPort();
});
afterEach(cleanup);

describe('call lines in the trainer thread', () => {
  it('the queued call of the open client is sent as a call log and drawn in the thread', async () => {
    for (const id of IDS)
      queueCallLog({
        peerId: id,
        callId: `call-${id}`,
        entry: { v: 1, k: 'done', video: false, sec: 720 },
      });
    render(
      <ChatScreen
        onNavigate={vi.fn()}
        chatPort={port}
        worldPort={createFixturesPort({ warm: true })}
        uid="t"
      />,
    );
    await waitFor(() => {
      const sent = IDS.flatMap((id) => port.dump(`cid-${id}`)).filter((m) => isCallLog(m.body));
      expect(sent).toHaveLength(1);
      expect(sent[0].from).toBe('trainer');
    });
    expect(await screen.findByText(cl.callLogVoice(12))).toBeTruthy();
  });
});
