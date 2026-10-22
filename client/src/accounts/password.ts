import { callFn, renewSessionWithToken } from '../api';

/** Changes the password. The server ended every refresh token with the old one and returns a fresh token: this device signs back in. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const r = await callFn<{ token?: string } | undefined>('changePassword', {
    currentPassword,
    newPassword,
  });
  if (r?.token) await renewSessionWithToken(r.token);
}
