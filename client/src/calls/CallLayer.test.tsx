import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callsEn as cl } from '../i18n/calls.en';
import { CallLayer } from './CallLayer';
import { IDLE, type CallState } from './callMachine';
import type { CallSession } from './callSession';
import { openPreflight, rememberPeer } from './callsStore';
import { useAudioLevel } from './useAudioLevel';

interface Chip {
  title: string;
  detail: string;
  time: string;
  open: () => void;
}
const chip = vi.hoisted(() => ({ value: null as Chip | null }));
vi.mock('./workoutChip', () => ({ useWorkoutChip: () => chip.value }));
vi.mock('./useAudioLevel', () => ({ useAudioLevel: vi.fn(() => 0.5) }));
// the preflight dialog (shown when idle) asks for the microphone; its own behaviour is covered in CallPreflightDialog.test
vi.mock('./CallPreflightDialog', () => ({
  CallPreflightDialog: ({ req }: { req: { peerId: string } }) => <p>preflight:{req.peerId}</p>,
}));

const T0 = 1_000_000;
let desktop = false;

const media = (audio: number, video: number) =>
  ({
    getAudioTracks: () => Array.from({ length: audio }, () => ({})),
    getVideoTracks: () => Array.from({ length: video }, () => ({})),
    getTracks: () => [],
  }) as unknown as MediaStream;

function fake(init: Partial<CallState> = {}) {
  let state: CallState = { ...IDLE, ...init };
  let remote: MediaStream | null = null;
  let local: MediaStream | null = null;
  const subs = new Set<() => void>();
  const api = {
    subscribe: (f: () => void) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
    getState: () => state,
    getRemoteStream: () => remote,
    getLocalStream: () => local,
    answer: vi.fn(async () => {}),
    decline: vi.fn(),
    hangup: vi.fn(),
    toggleMic: vi.fn(),
    toggleCam: vi.fn(),
    dismiss: vi.fn(),
  };
  return {
    api,
    session: api as unknown as CallSession,
    set: (p: Partial<CallState>) => {
      state = { ...state, ...p };
      act(() => subs.forEach((f) => f()));
    },
    streams: (r: MediaStream | null, l: MediaStream | null = null) => {
      remote = r;
      local = l;
    },
  };
}

const live = (p: Partial<CallState> = {}): Partial<CallState> => ({
  phase: 'active',
  callId: 'c1',
  peerId: 'peer-anna',
  role: 'caller',
  connectedAt: T0 - 65_000,
  ...p,
});

let play: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  });
  vi.setSystemTime(T0);
  desktop = false;
  chip.value = null;
  vi.mocked(useAudioLevel).mockClear();
  rememberPeer('peer-anna', 'Anna');
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: desktop,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  openPreflight(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  play.mockRestore();
});

const btn = (name: string) => screen.getByRole('button', { name });

describe('CallLayer idle and preflight', () => {
  it('draws nothing when idle and no check is requested', () => {
    const t = fake();
    const { container } = render(<CallLayer session={t.session} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the pre-call check when idle and one is requested', () => {
    const t = fake();
    render(<CallLayer session={t.session} />);
    act(() => openPreflight({ peerId: 'peer-anna', kind: 'video' }));
    expect(screen.getByText('preflight:peer-anna')).toBeTruthy();
    act(() => openPreflight(null));
    expect(screen.queryByText('preflight:peer-anna')).toBeNull();
  });
});

describe('CallLayer ringing in', () => {
  const ring = (p: Partial<CallState> = {}) =>
    fake({
      phase: 'ringing-in',
      callId: 'c1',
      peerId: 'peer-anna',
      role: 'callee',
      kind: 'video',
      ...p,
    });

  it('phone: a full screen alert dialog named after the caller, focus on Answer', () => {
    const t = ring();
    render(<CallLayer session={t.session} />);
    expect(screen.getByRole('alertdialog', { name: `Anna: ${cl.callIncomingVideo}` })).toBeTruthy();
    expect(document.querySelector('.uicall-in--card')).toBeNull();
    expect(document.activeElement?.textContent?.trim()).toBe(cl.callAnswer);
  });

  it('desktop: the floating card variant', () => {
    desktop = true;
    render(<CallLayer session={ring().session} />);
    expect(document.querySelector('.uicall-in--card')).not.toBeNull();
    expect(document.activeElement?.textContent?.trim()).toBe(cl.callAnswer);
  });

  it('answer, decline and voice-only call the session', () => {
    const t = ring();
    render(<CallLayer session={t.session} />);
    fireEvent.click(btn(cl.callAnswer));
    expect(t.api.answer).toHaveBeenCalledWith();
    fireEvent.click(btn(cl.callDecline));
    expect(t.api.decline).toHaveBeenCalledTimes(1);
    fireEvent.click(btn(cl.callAnswerVoiceOnly));
    expect(t.api.answer).toHaveBeenLastCalledWith({ voiceOnly: true });
  });

  it('a voice call has no voice-only action and the voice label', () => {
    const t = ring({ kind: 'voice' });
    render(<CallLayer session={t.session} />);
    expect(screen.queryByRole('button', { name: cl.callAnswerVoiceOnly })).toBeNull();
    expect(screen.getByRole('alertdialog', { name: `Anna: ${cl.callIncomingVoice}` })).toBeTruthy();
  });

  it('an unknown caller is shown under the brand name', () => {
    const t = ring({ peerId: 'stranger' });
    render(<CallLayer session={t.session} />);
    expect(
      screen.getByRole('alertdialog', { name: `Spotter: ${cl.callIncomingVideo}` }),
    ).toBeTruthy();
  });

  it('never docks, even with a workout open on desktop', () => {
    desktop = true;
    chip.value = { title: 'Bench', detail: '', time: '0:10', open: vi.fn() };
    render(<CallLayer session={ring().session} />);
    expect(document.documentElement.hasAttribute('data-call-dock')).toBe(false);
  });
});

describe('CallLayer outgoing and connecting', () => {
  it('ringing-out says Calling and shows no own tile', () => {
    const t = fake({
      phase: 'ringing-out',
      callId: 'c1',
      peerId: 'peer-anna',
      role: 'caller',
      kind: 'video',
    });
    render(<CallLayer session={t.session} />);
    expect(screen.getByText(cl.callCalling)).toBeTruthy();
    expect(screen.queryByText(cl.callYou)).toBeNull();
    expect(screen.queryByTestId('call-remote-audio')).toBeNull();
  });

  it('connecting says Connecting and has no audio element yet', () => {
    const t = fake(live({ phase: 'connecting', connectedAt: null }));
    render(<CallLayer session={t.session} />);
    expect(screen.getByText(cl.callConnecting)).toBeTruthy();
    expect(screen.queryByTestId('call-remote-audio')).toBeNull();
  });

  it('minimised while ringing-out is the mini tile even on a phone', () => {
    const t = fake({ phase: 'ringing-out', callId: 'c1', peerId: 'peer-anna', role: 'caller' });
    render(<CallLayer session={t.session} />);
    fireEvent.click(btn(cl.callMinimize));
    expect(document.querySelector('.uicall-mini')).not.toBeNull();
    fireEvent.click(btn(`${cl.callBackToCall}: Anna`));
    expect(document.querySelector('.uicall-mini')).toBeNull();
    expect(screen.getByText(cl.callCalling)).toBeTruthy();
  });
});

describe('CallLayer active', () => {
  it('shows the running timer and ticks every second', () => {
    const t = fake(live());
    render(<CallLayer session={t.session} />);
    expect(screen.getByText('01:05')).toBeTruthy();
    expect(screen.getByText(cl.callNotRecorded)).toBeTruthy();
    act(() => void vi.advanceTimersByTime(3000));
    expect(screen.getByText('01:08')).toBeTruthy();
  });

  it('mute and hang up reach the session', () => {
    const t = fake(live());
    render(<CallLayer session={t.session} />);
    fireEvent.click(btn(cl.callMute));
    expect(t.api.toggleMic).toHaveBeenCalledTimes(1);
    fireEvent.click(btn(cl.callEnd));
    expect(t.api.hangup).toHaveBeenCalledTimes(1);
  });

  it('a muted mic offers Unmute', () => {
    const t = fake(live({ micOn: false }));
    render(<CallLayer session={t.session} />);
    expect(btn(cl.callUnmute)).toBeTruthy();
  });

  it('voice call has no camera control; the level meter follows the remote voice', () => {
    const remote = media(1, 0);
    const t = fake(live({ kind: 'voice' }));
    t.streams(remote);
    render(<CallLayer session={t.session} />);
    expect(screen.queryByRole('button', { name: cl.callCamOff })).toBeNull();
    expect(useAudioLevel).toHaveBeenCalledWith(remote, true);
  });

  it('video call: camera toggle, own tile and own picture; the meter is off', () => {
    const t = fake(live({ kind: 'video', camOn: true }));
    t.streams(media(1, 1), media(1, 1));
    render(<CallLayer session={t.session} />);
    fireEvent.click(btn(cl.callCamOff));
    expect(t.api.toggleCam).toHaveBeenCalledTimes(1);
    expect(screen.getByText(cl.callYou)).toBeTruthy();
    expect(screen.getByLabelText(cl.callYou, { selector: 'video' })).toBeTruthy();
    expect(screen.getByLabelText('Anna', { selector: 'video' })).toBeTruthy();
    expect(vi.mocked(useAudioLevel).mock.calls.every((c) => c[1] === false)).toBe(true);
  });

  it('reconnecting: a notice, no minimise, the timer is replaced by the status', () => {
    const t = fake(live({ phase: 'reconnecting' }));
    render(<CallLayer session={t.session} />);
    expect(screen.getAllByText(cl.callReconnecting).length).toBe(2);
    expect(screen.queryByRole('button', { name: cl.callMinimize })).toBeNull();
  });

  it('weak link: voice-only notice', () => {
    const t = fake(live({ kind: 'video', voiceOnly: true }));
    render(<CallLayer session={t.session} />);
    expect(screen.getByText(cl.callWeakVoiceOnly)).toBeTruthy();
    expect(screen.queryByRole('button', { name: cl.callCamOn })).toBeNull();
  });
});

describe('CallLayer minimised', () => {
  it('phone: a bar with mic, hang up and return', () => {
    const t = fake(live());
    render(<CallLayer session={t.session} />);
    fireEvent.click(btn(cl.callMinimize));
    expect(screen.getByRole('status').textContent).toContain(cl.callWith('Anna'));
    fireEvent.click(btn(cl.callMute));
    expect(t.api.toggleMic).toHaveBeenCalledTimes(1);
    fireEvent.click(btn(cl.callEnd));
    expect(t.api.hangup).toHaveBeenCalledTimes(1);
    fireEvent.click(btn(cl.callBackToCall));
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.querySelector('section.uicall')).not.toBeNull();
  });

  it('phone: the bar offers Unmute while muted', () => {
    const t = fake(live({ micOn: false }));
    render(<CallLayer session={t.session} />);
    fireEvent.click(btn(cl.callMinimize));
    expect(btn(cl.callUnmute)).toBeTruthy();
  });

  it('desktop: a mini tile that expands and hangs up', () => {
    desktop = true;
    const t = fake(live());
    render(<CallLayer session={t.session} />);
    fireEvent.click(btn(cl.callMinimize));
    expect(document.querySelector('.uicall-mini')).not.toBeNull();
    expect(screen.getByText('01:05')).toBeTruthy();
    fireEvent.click(btn(cl.callEnd));
    expect(t.api.hangup).toHaveBeenCalledTimes(1);
    fireEvent.click(btn(`${cl.callBackToCall}: Anna`));
    expect(document.querySelector('.uicall-mini')).toBeNull();
  });

  it('stays expanded for the next call after one was minimised', () => {
    const t = fake(live());
    render(<CallLayer session={t.session} />);
    fireEvent.click(btn(cl.callMinimize));
    t.set({ callId: 'c2' });
    expect(document.querySelector('.uicall-bar')).toBeNull();
    expect(document.querySelector('section.uicall')).not.toBeNull();
  });
});

describe('CallLayer remote audio', () => {
  it('a voice call plays the remote stream through an audio element', () => {
    const remote = media(1, 0);
    const t = fake(live({ kind: 'voice' }));
    t.streams(remote);
    const { unmount } = render(<CallLayer session={t.session} />);
    const audio = screen.getByTestId('call-remote-audio') as HTMLAudioElement;
    expect(audio.srcObject).toBe(remote);
    expect(play).toHaveBeenCalled();
    unmount();
    expect(audio.srcObject).toBeNull();
  });

  it('a refused autoplay does not throw', () => {
    play.mockRejectedValue(new Error('NotAllowedError'));
    const t = fake(live({ kind: 'voice' }));
    t.streams(media(1, 0));
    expect(() => render(<CallLayer session={t.session} />)).not.toThrow();
  });

  it('there is no element when the video call has a picture (the video plays the sound)', () => {
    const t = fake(live({ kind: 'video' }));
    t.streams(media(1, 1));
    render(<CallLayer session={t.session} />);
    expect(screen.queryByTestId('call-remote-audio')).toBeNull();
  });

  it('a video call without remote picture still gets the audio element', () => {
    const t = fake(live({ kind: 'video' }));
    t.streams(media(1, 0));
    render(<CallLayer session={t.session} />);
    expect(screen.getByTestId('call-remote-audio')).toBeTruthy();
  });

  it('a video call degraded to voice gets the audio element', () => {
    const t = fake(live({ kind: 'video', voiceOnly: true }));
    t.streams(media(1, 1));
    render(<CallLayer session={t.session} />);
    expect(screen.getByTestId('call-remote-audio')).toBeTruthy();
  });

  it('keeps sound while reconnecting, drops it when the call ends', () => {
    const t = fake(live({ kind: 'voice', phase: 'reconnecting' }));
    t.streams(media(1, 0));
    render(<CallLayer session={t.session} />);
    expect(screen.getByTestId('call-remote-audio')).toBeTruthy();
    t.set({ phase: 'ended', endReason: 'failed', endedAt: T0 });
    expect(screen.queryByTestId('call-remote-audio')).toBeNull();
  });
});

describe('CallLayer workout dock', () => {
  const open = vi.fn();
  beforeEach(() => {
    open.mockClear();
    chip.value = { title: 'Bench Press', detail: 'Set 2/4', time: '1:32', open };
  });
  const dock = () => document.documentElement.hasAttribute('data-call-dock');

  it('desktop with a workout open: the call docks beside the session and cleans up', () => {
    desktop = true;
    const t = fake(live());
    const { unmount } = render(<CallLayer session={t.session} />);
    expect(dock()).toBe(true);
    expect(document.querySelector('.uicall--dock')).not.toBeNull();
    fireEvent.click(btn(`${cl.callBackToWorkout}: Bench Press`));
    expect(open).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.uicall--dock')).not.toBeNull();
    unmount();
    expect(dock()).toBe(false);
  });

  it('full screen leaves the dock and can be exited', () => {
    desktop = true;
    const t = fake(live());
    render(<CallLayer session={t.session} />);
    fireEvent.click(btn(cl.callFullScreen));
    expect(dock()).toBe(false);
    expect(document.querySelector('.uicall--full')).not.toBeNull();
    fireEvent.click(btn(cl.callExitFullScreen));
    expect(dock()).toBe(true);
  });

  it('phone: no dock; opening the workout minimises the call to the bar', () => {
    const t = fake(live());
    render(<CallLayer session={t.session} />);
    expect(dock()).toBe(false);
    fireEvent.click(btn(`${cl.callBackToWorkout}: Bench Press`));
    expect(open).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.uicall-bar')).not.toBeNull();
  });

  it('desktop: minimised call does not dock; no full-screen button on a phone', () => {
    desktop = true;
    const t = fake(live());
    render(<CallLayer session={t.session} />);
    fireEvent.click(btn(cl.callMinimize));
    expect(dock()).toBe(false);
    cleanup();
    desktop = false;
    render(<CallLayer session={t.session} />);
    expect(screen.queryByRole('button', { name: cl.callFullScreen })).toBeNull();
  });
});

describe('CallLayer ended', () => {
  const ended = (endReason: CallState['endReason'], p: Partial<CallState> = {}) =>
    fake({ phase: 'ended', callId: 'c1', peerId: 'peer-anna', endReason, endedAt: T0, ...p });

  it.each([
    ['declined', cl.callDeclinedT, cl.callDeclinedB],
    ['missed', cl.callNoAnswerT, cl.callNoAnswerB],
    ['busy', cl.callBusyT, cl.callBusyB],
    ['unavailable', cl.callUnavailT, cl.callUnavailB],
    ['offline', cl.callOfflineT, cl.callOfflineB],
    ['permission-denied', cl.callPermDeniedT, cl.callPermDeniedB],
    ['no-device', cl.callNoDeviceT, cl.callNoDeviceB],
    ['failed', cl.callLostT, cl.callLostB],
    ['disabled', cl.callsDisabled, ''],
  ] as const)('%s: title and text, waits to be read', (reason, title, body) => {
    const t = ended(reason);
    render(<CallLayer session={t.session} />);
    expect(screen.getByText(title)).toBeTruthy();
    if (body) expect(screen.getByText(body)).toBeTruthy();
    act(() => void vi.advanceTimersByTime(60_000));
    expect(t.api.dismiss).not.toHaveBeenCalled();
    fireEvent.click(btn(cl.callClose));
    expect(t.api.dismiss).toHaveBeenCalledTimes(1);
  });

  it('permission denied explains how to allow it', () => {
    render(<CallLayer session={ended('permission-denied').session} />);
    expect(screen.getByText(cl.callPermHowTo)).toBeTruthy();
  });

  it('a hang-up shows the call length and closes itself after 3 seconds', () => {
    const t = ended('hangup', { connectedAt: T0 - 65_000 });
    render(<CallLayer session={t.session} />);
    expect(screen.getByText(cl.callEndedT('01:05'))).toBeTruthy();
    expect(screen.getByText(cl.callEndedB)).toBeTruthy();
    act(() => void vi.advanceTimersByTime(2999));
    expect(t.api.dismiss).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(t.api.dismiss).toHaveBeenCalledTimes(1);
  });

  it('a hang-up before anyone answered shows 00:00', () => {
    render(<CallLayer session={ended('hangup').session} />);
    expect(screen.getByText(cl.callEndedT('00:00'))).toBeTruthy();
  });
});
