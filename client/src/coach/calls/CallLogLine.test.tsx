import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callsEn as cl } from '../../i18n/calls.en';
import { encodeCallLog, type CallLogEntry } from '../../calls/callLog';
import type { CallSession } from '../../calls/callSession';
import { publishCalls, queueCallLog } from '../../calls/callsStore';
import { clock } from '../chat/format';
import {
  CALL_MSG_TYPE,
  CallLogLine,
  callLogBody,
  isCallLog,
  useCallLogWriter,
} from './CallLogLine';

const dial = vi.fn(async () => {});
const AT = Date.UTC(2026, 10, 3, 9, 5);
const entry = (p: Partial<CallLogEntry> = {}): CallLogEntry => ({
  v: 1,
  k: 'done',
  video: false,
  sec: 720,
  ...p,
});

function line(e: CallLogEntry | string, mine = true) {
  return render(
    <CallLogLine
      text={typeof e === 'string' ? e : encodeCallLog(e)}
      at={AT}
      mine={mine}
      peerId="peer-1"
    />,
  );
}

beforeEach(() => {
  dial.mockClear();
  publishCalls({ session: { dial } as unknown as CallSession, enabled: true });
});
afterEach(() => {
  cleanup();
  publishCalls({ session: null, enabled: false });
});

describe('call log body helpers', () => {
  it('seals a finished call as a system message of type call', () => {
    const body = callLogBody(entry());
    expect(body).toEqual({ kind: 'system', type: CALL_MSG_TYPE, text: encodeCallLog(entry()) });
    expect(isCallLog(body)).toBe(true);
    expect(isCallLog({ kind: 'system', type: 'other', text: '' })).toBe(false);
    expect(isCallLog({ kind: 'text', text: 'hi' })).toBe(false);
  });
});

describe('CallLogLine', () => {
  it.each([
    ['voice call that took place', entry({ sec: 720 }), true, cl.callLogVoice(12)],
    ['video call that took place', entry({ video: true, sec: 90 }), true, cl.callLogVideo(2)],
    ['a very short call counts as one minute', entry({ sec: 5 }), true, cl.callLogVoice(1)],
    ['declined', entry({ k: 'declined', sec: 0 }), true, cl.callLogDeclined],
    ['dropped', entry({ k: 'dropped' }), true, cl.callLogDropped],
    ['unanswered, my call', entry({ k: 'noanswer', sec: 0 }), true, cl.callLogNoAnswer],
    ['unanswered voice, their call', entry({ k: 'noanswer', sec: 0 }), false, cl.callLogMissed],
    [
      'unanswered video, their call',
      entry({ k: 'noanswer', video: true, sec: 0 }),
      false,
      cl.callLogMissedVideo,
    ],
  ])('%s', (_n, e, mine, text) => {
    line(e, mine);
    expect(screen.getByText(text, { exact: false }).textContent).toContain(text);
    expect(screen.getByText(clock(AT))).toBeTruthy();
  });

  it('draws nothing for a broken or empty body', () => {
    expect(line('not json').container.innerHTML).toBe('');
    cleanup();
    expect(line(JSON.stringify({ v: 2 })).container.innerHTML).toBe('');
    cleanup();
    expect(
      render(<CallLogLine text={undefined} at={AT} mine peerId="p" />).container.innerHTML,
    ).toBe('');
  });

  it('Call back dials the same person with the same kind and a fresh id', () => {
    line(entry({ k: 'noanswer', video: true, sec: 0 }), false);
    fireEvent.click(screen.getByRole('button', { name: cl.callBack }));
    expect(dial).toHaveBeenCalledWith('peer-1', 'video', expect.stringMatching(/^[\w-]{24}$/));
    cleanup();
    line(entry({ k: 'declined', sec: 0 }));
    fireEvent.click(screen.getByRole('button', { name: cl.callBack }));
    expect(dial).toHaveBeenLastCalledWith('peer-1', 'voice', expect.any(String));
  });

  it('a finished call has no Call back', () => {
    line(entry());
    expect(screen.queryByRole('button', { name: cl.callBack })).toBeNull();
  });

  it('no Call back when calls are off or there is no session', () => {
    publishCalls({ session: { dial } as unknown as CallSession, enabled: false });
    line(entry({ k: 'dropped' }));
    expect(screen.queryByRole('button', { name: cl.callBack })).toBeNull();
    cleanup();
    publishCalls({ session: null, enabled: true });
    line(entry({ k: 'dropped' }));
    expect(screen.queryByRole('button', { name: cl.callBack })).toBeNull();
  });
});

describe('useCallLogWriter', () => {
  const write = vi.fn();
  function Writer({ peer }: { peer: string }) {
    useCallLogWriter(peer, write);
    return null;
  }
  beforeEach(() => write.mockClear());

  it('writes the line of a call that ended while another screen was open', () => {
    queueCallLog({ peerId: 'w-peer', callId: 'w-1', entry: entry({ video: true, sec: 600 }) });
    render(<Writer peer="w-peer" />);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(
      cl.callLogVideo(10),
      callLogBody(entry({ video: true, sec: 600 })),
    );
  });

  it('writes calls that end while the chat is open, once each, only for this person', () => {
    const { unmount } = render(<Writer peer="w-peer2" />);
    expect(write).not.toHaveBeenCalled();
    act(() => queueCallLog({ peerId: 'someone-else', callId: 'w-2', entry: entry() }));
    expect(write).not.toHaveBeenCalled();
    act(() => queueCallLog({ peerId: 'w-peer2', callId: 'w-3', entry: entry({ sec: 60 }) }));
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0]).toBe(cl.callLogVoice(1));
    unmount();
    act(() => queueCallLog({ peerId: 'w-peer2', callId: 'w-4', entry: entry() }));
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('a call queued twice while waiting is written once', () => {
    const q = { peerId: 'w-peer4', callId: 'w-dup', entry: entry() };
    queueCallLog(q);
    queueCallLog(q);
    render(<Writer peer="w-peer4" />);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it.each([
    [entry({ k: 'declined' }), cl.callLogDeclined],
    [entry({ k: 'dropped' }), cl.callLogDropped],
    [entry({ k: 'noanswer' }), cl.callLogNoAnswer],
  ])('preview text for %o', (e, text) => {
    queueCallLog({ peerId: 'w-peer3', callId: `w-${e.k}`, entry: e });
    render(<Writer peer="w-peer3" />);
    expect(write).toHaveBeenCalledWith(text, callLogBody(e));
  });
});
