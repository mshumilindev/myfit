/**
 * Passkeys on the web (SPO-211): Face ID / Touch ID / Windows Hello / Android biometrics through WebAuthn.
 * No buttons or settings: a passkey is registered right after a "Remember me" sign-in and used on the next tap of the person.
 * Anything that fails or is unavailable simply falls back to the password.
 */
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { callFn, type AuthPayload } from '../api';

export async function biometricsAvailable(): Promise<boolean> {
  try {
    return browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable());
  } catch {
    return false;
  }
}

/** Registers a passkey for the signed-in person. Returns true when one was stored. */
export async function registerPasskey(): Promise<boolean> {
  try {
    if (!(await biometricsAvailable())) return false;
    const { challengeId, options } = await callFn<{ challengeId: string; options: Parameters<typeof startRegistration>[0]['optionsJSON'] }>(
      'passkeyRegisterOptions',
      undefined,
      { quiet: true },
    );
    const response = await startRegistration({ optionsJSON: options });
    await callFn('passkeyRegisterVerify', { challengeId, response }, { quiet: true });
    return true;
  } catch {
    return false; // declined, unsupported or server not updated yet: the password keeps working
  }
}

/** Signs in with the device's biometrics. Throws when cancelled or unusable: the caller falls back to the password. */
export async function signInWithPasskey(userId: string): Promise<AuthPayload> {
  const { challengeId, options } = await callFn<{ challengeId: string; options: Parameters<typeof startAuthentication>[0]['optionsJSON'] }>(
    'passkeyLoginOptions',
    { userId },
    { quiet: true },
  );
  const response = await startAuthentication({ optionsJSON: options });
  return callFn<AuthPayload>('passkeyLoginVerify', { challengeId, response }, { quiet: true });
}
