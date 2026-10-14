import type { ReauthPort } from '../reauth';

/** Demo / stories / tests: any non-empty password passes (or only `accept`). */
export function createFixturesReauthPort(opts: { accept?: string } = {}): ReauthPort {
  return {
    knowsIdentifier: () => true,
    check: async ({ password }) =>
      password && (opts.accept === undefined || password === opts.accept) ? 'ok' : 'wrong',
  };
}
