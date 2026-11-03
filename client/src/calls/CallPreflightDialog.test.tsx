import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callsEn as cl } from '../i18n/calls.en';
import { CALL_PREFS_KEY, readCallPrefs } from './callPrefs';
import { CallPreflightDialog } from './CallPreflightDialog';
import type { CallSession } from './callSession';
import { openPreflight, usePreflight, type PreflightRequest } from './callsStore';
import { useAudioLevel } from './useAudioLevel';

vi.mock('./useAudioLevel', () => ({ useAudioLevel: vi.fn(() => 0.4) }));

const req: PreflightRequest = { peerId: 'peer-1', kind: 'video' };

function fakeStream() {
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
  return { tracks, stream: { getTracks: () => tracks } as unknown as MediaStream };
}

const getUserMedia = vi.fn();
const enumerateDevices = vi.fn();
const dial = vi.fn(async () => {});
const session = { dial } as unknown as CallSession;

function Probe() {
  const p = usePreflight();
  return <output data-testid="probe">{p ? p.peerId : 'closed'}</output>;
}

function mount(r: PreflightRequest = req) {
  act(() => openPreflight(r));
  return render(
    <>
      <Probe />
      <CallPreflightDialog session={session} req={r} />
    </>,
  );
}

let play: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  localStorage.clear();
  getUserMedia.mockReset();
  enumerateDevices.mockReset();
  dial.mockClear();
  enumerateDevices.mockResolvedValue([
    { kind: 'audioinput', deviceId: 'mic-1', label: 'Headset' },
    { kind: 'audioinput', deviceId: 'mic-2', label: '' },
    { kind: 'videoinput', deviceId: 'cam-1', label: 'Webcam' },
  ]);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia, enumerateDevices },
  });
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  act(() => openPreflight(null));
  play.mockRestore();
});

const probe = () => screen.getByTestId('probe').textContent;

describe('CallPreflightDialog', () => {
  it('asks for mic and camera for a video call and lists the devices', async () => {
    const { stream } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    mount();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText(cl.callPreTitle)).toBeTruthy();
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ video: expect.objectContaining({ facingMode: 'user' }) }),
    );
    await screen.findByRole('option', { name: 'Headset' });
    // an unnamed device is numbered by position so it can still be told apart
    expect(screen.getByRole('option', { name: '2' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Webcam' })).toBeTruthy();
    expect(screen.getByRole('meter', { name: cl.callPreLevel }).getAttribute('aria-valuenow')).toBe(
      '40',
    );
    expect(useAudioLevel).toHaveBeenCalledWith(stream);
    expect(screen.getByLabelText(cl.callYou, { selector: 'video' })).toBeTruthy();
  });

  it('a voice call asks for the microphone only and shows no picture', async () => {
    getUserMedia.mockResolvedValue(fakeStream().stream);
    mount({ peerId: 'peer-1', kind: 'voice' });
    await screen.findByRole('option', { name: 'Headset' });
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: false }));
    expect(screen.queryByLabelText(cl.callYou, { selector: 'video' })).toBeNull();
  });

  it('without devices the pickers say so', async () => {
    enumerateDevices.mockResolvedValue([]);
    getUserMedia.mockResolvedValue(fakeStream().stream);
    mount();
    await waitFor(() => expect(enumerateDevices).toHaveBeenCalled());
    expect(await screen.findAllByRole('option', { name: cl.callPreNoDevices })).toHaveLength(2);
  });

  it('a refused permission shows the blocked text instead of the check', async () => {
    getUserMedia.mockRejectedValue(new DOMException('no', 'NotAllowedError'));
    mount();
    expect((await screen.findByRole('alert')).textContent).toBe(cl.callPermDeniedB);
    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('switching the camera off and picking a mic is saved and re-asks without video', async () => {
    getUserMedia.mockResolvedValue(fakeStream().stream);
    mount();
    await screen.findByRole('option', { name: 'Headset' });
    fireEvent.click(screen.getByRole('switch', { name: cl.callPreCam }));
    expect(readCallPrefs().camOn).toBe(false);
    await waitFor(() =>
      expect(getUserMedia).toHaveBeenLastCalledWith(expect.objectContaining({ video: false })),
    );
    await screen.findByRole('option', { name: 'Headset' });
    fireEvent.change(screen.getByLabelText(cl.callPreMic), { target: { value: 'mic-1' } });
    expect(readCallPrefs().mic).toBe('mic-1');
    await waitFor(() =>
      expect(getUserMedia).toHaveBeenLastCalledWith(
        expect.objectContaining({
          audio: expect.objectContaining({ deviceId: { exact: 'mic-1' } }),
        }),
      ),
    );
    await screen.findByRole('option', { name: 'Webcam' });
    fireEvent.change(screen.getByLabelText(cl.callPreCam, { selector: 'select' }), {
      target: { value: 'cam-1' },
    });
    expect(readCallPrefs().cam).toBe('cam-1');
  });

  it('Start saves "seen", stops the preview, closes and places the call', async () => {
    const { stream, tracks } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    mount();
    await screen.findByRole('option', { name: 'Headset' });
    fireEvent.click(screen.getByRole('button', { name: cl.callPreStart }));
    expect(JSON.parse(localStorage.getItem(CALL_PREFS_KEY) ?? '{}').seen).toBe(true);
    tracks.forEach((t) => expect(t.stop).toHaveBeenCalled());
    expect(probe()).toBe('closed');
    expect(dial).toHaveBeenCalledTimes(1);
    expect(dial).toHaveBeenCalledWith('peer-1', 'video', expect.stringMatching(/^[\w-]{24}$/));
  });

  it('Close places no call and does not mark the check as done', async () => {
    getUserMedia.mockResolvedValue(fakeStream().stream);
    mount();
    await screen.findByRole('option', { name: 'Headset' });
    fireEvent.click(screen.getByRole('button', { name: cl.callClose }));
    expect(probe()).toBe('closed');
    expect(dial).not.toHaveBeenCalled();
    expect(readCallPrefs().seen).toBe(false);
  });

  it('Escape closes without calling; other keys do nothing', async () => {
    getUserMedia.mockResolvedValue(fakeStream().stream);
    mount();
    await screen.findByRole('option', { name: 'Headset' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(probe()).toBe('peer-1');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(probe()).toBe('closed');
    expect(dial).not.toHaveBeenCalled();
  });

  it('a click on the scrim closes, a click inside does not', async () => {
    getUserMedia.mockResolvedValue(fakeStream().stream);
    mount();
    await screen.findByRole('option', { name: 'Headset' });
    fireEvent.click(screen.getByRole('alertdialog'));
    expect(probe()).toBe('peer-1');
    fireEvent.click(document.querySelector('.dialog-scrim') as HTMLElement);
    expect(probe()).toBe('closed');
  });

  it('closing before the microphone answers stops the late stream', async () => {
    const { stream, tracks } = fakeStream();
    let grant: (s: MediaStream) => void = () => {};
    getUserMedia.mockReturnValue(new Promise<MediaStream>((r) => (grant = r)));
    const { unmount } = mount();
    unmount();
    await act(async () => grant(stream));
    tracks.forEach((t) => expect(t.stop).toHaveBeenCalled());
    expect(enumerateDevices).not.toHaveBeenCalled();
  });

  it('unmounting stops the preview tracks', async () => {
    const { stream, tracks } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    const { unmount } = mount();
    await screen.findByRole('option', { name: 'Headset' });
    unmount();
    tracks.forEach((t) => expect(t.stop).toHaveBeenCalled());
  });
});
