import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callsEn as cl } from '../i18n/calls.en';
import { CALL_PREFS_KEY, readCallPrefs } from './callPrefs';
import { CallSettingsRow } from './CallSettingsRow';
import { CallSettingsSheet } from './CallSettingsSheet';
import { publishCalls } from './callsStore';

vi.mock('./useAudioLevel', () => ({ useAudioLevel: vi.fn(() => 0.4) }));

const getUserMedia = vi.fn();
const enumerateDevices = vi.fn();
const stream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;

let play: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  localStorage.clear();
  getUserMedia.mockReset().mockResolvedValue(stream);
  enumerateDevices.mockReset().mockResolvedValue([
    { kind: 'audioinput', deviceId: 'mic-1', label: 'Headset' },
    { kind: 'audioinput', deviceId: 'mic-2', label: 'Desk mic' },
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
  act(() => publishCalls({ session: null, enabled: false }));
  play.mockRestore();
});

describe('CallSettingsSheet', () => {
  it('opens with the safe defaults: camera on, relay (direct off), nothing recorded', async () => {
    render(<CallSettingsSheet onClose={() => undefined} />);
    expect(screen.getByText(cl.callSetNotRecorded)).toBeTruthy();
    expect(
      screen.getByRole('switch', { name: cl.callSetDirect }).getAttribute('aria-checked'),
    ).toBe('false');
    expect(screen.getByRole('switch', { name: cl.callSetCamOn }).getAttribute('aria-checked')).toBe(
      'true',
    );
    await waitFor(() => expect(screen.getByText('Headset')).toBeTruthy());
  });

  it('saves each choice on this device', async () => {
    render(<CallSettingsSheet onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByText('Headset')).toBeTruthy());
    fireEvent.click(screen.getByRole('switch', { name: cl.callSetDirect }));
    expect(readCallPrefs().direct).toBe(true);
    fireEvent.click(screen.getByRole('switch', { name: cl.callSetCamOn }));
    expect(readCallPrefs().camOn).toBe(false);
    fireEvent.change(screen.getByLabelText(cl.callPreMic), { target: { value: 'mic-2' } });
    expect(readCallPrefs().mic).toBe('mic-2');
    expect(JSON.parse(localStorage.getItem(CALL_PREFS_KEY) ?? '{}')).toMatchObject({
      direct: true,
      camOn: false,
      mic: 'mic-2',
    });
  });

  it('says so when the microphone is blocked and still offers the connection choice', async () => {
    getUserMedia.mockRejectedValue(new Error('denied'));
    render(<CallSettingsSheet onClose={() => undefined} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('switch', { name: cl.callSetDirect })).toBeTruthy();
  });

  it('closes from its close button', async () => {
    const onClose = vi.fn();
    render(<CallSettingsSheet onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: cl.callClose }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('CallSettingsRow', () => {
  it('is not drawn while calls are off', () => {
    render(<CallSettingsRow />);
    expect(screen.queryByText(cl.callSetRow)).toBeNull();
  });

  it('is drawn when calls are on and opens the drawer', async () => {
    act(() => publishCalls({ session: null, enabled: true }));
    render(<CallSettingsRow />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(cl.callSetRow) }));
    expect(await screen.findByText(cl.callSetNotRecorded)).toBeTruthy();
  });
});
