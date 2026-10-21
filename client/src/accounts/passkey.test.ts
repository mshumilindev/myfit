import { afterEach, describe, expect, it, vi } from 'vitest';

const callFn = vi.hoisted(() => vi.fn());
const swa = vi.hoisted(() => ({
  browserSupportsWebAuthn: vi.fn(() => true),
  platformAuthenticatorIsAvailable: vi.fn(async () => true),
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}));
vi.mock('../api', () => ({ callFn }));
vi.mock('@simplewebauthn/browser', () => swa);

import { registerPasskey, signInWithPasskey } from './passkey';
import { sessionDeviceId } from './sessionDevice';

afterEach(() => {
  callFn.mockReset();
  swa.startRegistration.mockReset();
  swa.startAuthentication.mockReset();
  swa.browserSupportsWebAuthn.mockReturnValue(true);
});

describe('passkeys client', () => {
  it('registration sends this device id so the server can tie the passkey to the device', async () => {
    callFn
      .mockResolvedValueOnce({ challengeId: 'c1', options: { challenge: 'x' } })
      .mockResolvedValueOnce({ ok: true });
    swa.startRegistration.mockResolvedValue({ id: 'cred' });
    expect(await registerPasskey()).toBe(true);
    expect(callFn).toHaveBeenLastCalledWith(
      'passkeyRegisterVerify',
      { challengeId: 'c1', response: { id: 'cred' }, deviceId: sessionDeviceId() },
      expect.anything(),
    );
  });

  it('registration quietly gives up when unsupported, declined or the server refuses', async () => {
    swa.browserSupportsWebAuthn.mockReturnValue(false);
    expect(await registerPasskey()).toBe(false);
    expect(callFn).not.toHaveBeenCalled();
    swa.browserSupportsWebAuthn.mockReturnValue(true);
    callFn.mockResolvedValueOnce({ challengeId: 'c1', options: {} });
    swa.startRegistration.mockRejectedValue(new Error('NotAllowedError'));
    expect(await registerPasskey()).toBe(false);
  });

  it('sign-in returns the auth payload, and throws when the person cancels (password fallback)', async () => {
    callFn
      .mockResolvedValueOnce({ challengeId: 'c2', options: { challenge: 'y' } })
      .mockResolvedValueOnce({ token: 't', userId: 'u1' });
    swa.startAuthentication.mockResolvedValue({ id: 'cred' });
    expect(await signInWithPasskey('u1')).toEqual({ token: 't', userId: 'u1' });
    callFn.mockResolvedValueOnce({ challengeId: 'c3', options: {} });
    swa.startAuthentication.mockRejectedValue(new Error('cancelled'));
    await expect(signInWithPasskey('u1')).rejects.toThrow('cancelled');
  });
});
