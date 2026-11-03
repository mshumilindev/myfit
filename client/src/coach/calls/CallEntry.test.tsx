import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callsEn as cl } from '../../i18n/calls.en';
import { CALL_PREFS_KEY } from '../../calls/callPrefs';
import { IDLE, type CallState } from '../../calls/callMachine';
import type { CallSession } from '../../calls/callSession';
import { openPreflight, peerName, publishCalls, usePreflight } from '../../calls/callsStore';
import { CallEntry, CallEntryProvider, CallLogRows, type CallEntryValue } from './CallEntry';

const dial = vi.fn(async () => {});
let state: CallState = IDLE;
const subs = new Set<() => void>();
const session = {
  dial,
  getState: () => state,
  subscribe: (f: () => void) => {
    subs.add(f);
    return () => void subs.delete(f);
  },
} as unknown as CallSession;

function Probe() {
  const p = usePreflight();
  return <output data-testid="pre">{p ? `${p.peerId}:${p.kind}` : 'none'}</output>;
}
const setOnline = (v: boolean) => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: v });
};

beforeEach(() => {
  dial.mockClear();
  openPreflight(null);
  state = IDLE;
  localStorage.clear();
  setOnline(true);
  publishCalls({ session, enabled: true });
});
afterEach(() => {
  cleanup();
  publishCalls({ session: null, enabled: false });
});

const voice = () => screen.getByRole('button', { name: cl.callVoice });
const video = () => screen.getByRole('button', { name: cl.callVideo });
const pre = () => screen.getByTestId('pre').textContent;

describe('CallEntry (live)', () => {
  it('draws nothing without a person, without a session or with calls off', () => {
    expect(render(<CallEntry />).container.innerHTML).toBe('');
    cleanup();
    publishCalls({ session: null, enabled: true });
    expect(render(<CallEntry peerId="p1" />).container.innerHTML).toBe('');
    cleanup();
    publishCalls({ session, enabled: false });
    expect(render(<CallEntry peerId="p1" />).container.innerHTML).toBe('');
  });

  it('the first call on a device opens the pre-call check and dials nothing', () => {
    render(
      <>
        <Probe />
        <CallEntry peerId="p1" peerName="Anna" />
      </>,
    );
    fireEvent.click(video());
    expect(pre()).toBe('p1:video');
    fireEvent.click(voice());
    expect(pre()).toBe('p1:voice');
    expect(dial).not.toHaveBeenCalled();
  });

  it('after the check was done, the buttons dial straight away', () => {
    localStorage.setItem(CALL_PREFS_KEY, JSON.stringify({ seen: true }));
    render(
      <>
        <Probe />
        <CallEntry peerId="p1" peerName="Anna" />
      </>,
    );
    fireEvent.click(voice());
    expect(dial).toHaveBeenCalledWith('p1', 'voice', expect.stringMatching(/^[\w-]{24}$/));
    fireEvent.click(video());
    expect(dial).toHaveBeenLastCalledWith('p1', 'video', expect.any(String));
    expect(pre()).toBe('none');
  });

  it('remembers how the person is called', () => {
    render(<CallEntry peerId="p-name" peerName="Anna" />);
    expect(peerName('p-name')).toBe('Anna');
  });

  it('offline: both buttons are off with a neutral reason, and come back online', () => {
    setOnline(false);
    render(<CallEntry peerId="p1" />);
    expect(voice().hasAttribute('disabled')).toBe(true);
    expect(video().hasAttribute('disabled')).toBe(true);
    expect(voice().getAttribute('title')).toBe(cl.callReasonOffline);
    act(() => void window.dispatchEvent(new Event('online')));
    expect(voice().hasAttribute('disabled')).toBe(false);
    act(() => void window.dispatchEvent(new Event('offline')));
    expect(voice().getAttribute('title')).toBe(cl.callReasonOffline);
  });

  it('during another call the buttons are off with the busy reason', () => {
    state = { ...IDLE, phase: 'active', callId: 'c1', peerId: 'x' };
    render(<CallEntry peerId="p1" />);
    expect(video().hasAttribute('disabled')).toBe(true);
    expect(video().getAttribute('title')).toBe(cl.callBusyT);
    state = { ...state, phase: 'ended', endReason: 'hangup' };
    act(() => subs.forEach((f) => f()));
    expect(video().hasAttribute('disabled')).toBe(false);
  });

  it('labeled draws text buttons', () => {
    render(<CallEntry peerId="p1" labeled />);
    expect(screen.getByText(cl.callVoice).closest('button')).not.toBeNull();
  });

  it('compact draws one button named after the person', () => {
    render(<CallEntry peerId="p1" peerName="Anna" compact />);
    expect(screen.getByRole('button', { name: cl.callTo('Anna') })).toBeTruthy();
    expect(screen.queryByRole('button', { name: cl.callVideo })).toBeNull();
  });
});

describe('CallEntry design slot', () => {
  const value = (p: Partial<CallEntryValue> = {}): CallEntryValue => ({
    voiceLabel: 'V',
    videoLabel: 'Vi',
    callLabel: 'C',
    onVoice: vi.fn(),
    onVideo: vi.fn(),
    ...p,
  });

  it('a provider replaces the live behaviour (even without a person)', () => {
    const v = value();
    render(
      <CallEntryProvider value={v}>
        <CallEntry />
      </CallEntryProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'V' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vi' }));
    expect(v.onVoice).toHaveBeenCalledTimes(1);
    expect(v.onVideo).toHaveBeenCalledTimes(1);
    expect(dial).not.toHaveBeenCalled();
  });

  it('shows the reason when disabled', () => {
    render(
      <CallEntryProvider value={value({ disabledReason: 'No access' })}>
        <CallEntry />
      </CallEntryProvider>,
    );
    expect(screen.getByRole('button', { name: 'V' }).getAttribute('title')).toBe('No access');
  });

  it('call history rows render only on request and call back', () => {
    expect(render(<CallLogRows />).container.innerHTML).toBe('');
    cleanup();
    const v = value({ showLog: true });
    render(
      <CallEntryProvider value={v}>
        <CallLogRows />
      </CallEntryProvider>,
    );
    expect(screen.getByText('Video call · 12 min', { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Call back' }));
    expect(v.onVoice).toHaveBeenCalledTimes(1);
    cleanup();
    render(
      <CallEntryProvider value={value()}>
        <CallLogRows />
      </CallEntryProvider>,
    );
    expect(screen.queryByText('Missed call', { exact: false })).toBeNull();
  });
});
