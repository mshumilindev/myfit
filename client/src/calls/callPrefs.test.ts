import { beforeEach, describe, expect, it } from 'vitest';
import {
  CALL_PREFS_KEY,
  DEFAULT_CALL_PREFS,
  mediaConstraints,
  readCallPrefs,
  writeCallPrefs,
} from './callPrefs';

beforeEach(() => localStorage.clear());

describe('call prefs', () => {
  it('defaults: relay, not checked yet, camera on', () => {
    expect(readCallPrefs()).toEqual(DEFAULT_CALL_PREFS);
    expect(DEFAULT_CALL_PREFS).toMatchObject({ seen: false, direct: false, camOn: true });
  });
  it('writes merge and survive a read', () => {
    writeCallPrefs({ seen: true, mic: 'm1' });
    writeCallPrefs({ cam: 'c1' });
    expect(readCallPrefs()).toMatchObject({ seen: true, mic: 'm1', cam: 'c1' });
  });
  it('garbage in storage falls back to the defaults', () => {
    localStorage.setItem(CALL_PREFS_KEY, '{nope');
    expect(readCallPrefs()).toEqual(DEFAULT_CALL_PREFS);
    localStorage.setItem(CALL_PREFS_KEY, JSON.stringify({ seen: 'yes', direct: 1, mic: 5 }));
    expect(readCallPrefs()).toEqual(DEFAULT_CALL_PREFS);
  });
  it('constraints: saved devices only when chosen; video only for a video call', () => {
    const voice = mediaConstraints('voice', DEFAULT_CALL_PREFS);
    expect(voice.video).toBe(false);
    const p = { ...DEFAULT_CALL_PREFS, mic: 'm1', cam: 'c1' };
    const video = mediaConstraints('video', p) as {
      audio: { deviceId: unknown };
      video: { deviceId: unknown };
    };
    expect(video.audio.deviceId).toEqual({ exact: 'm1' });
    expect(video.video.deviceId).toEqual({ exact: 'c1' });
  });
});
