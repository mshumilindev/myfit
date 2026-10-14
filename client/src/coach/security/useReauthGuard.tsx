import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ReauthDialog } from './ReauthDialog';
import { reauthFresh, type ReauthAction, type ReauthPort } from './reauth';

/**
 * `guard('export', run)` runs `run` at once when the person confirmed their password in the last few minutes, otherwise
 * opens the password dialog first and runs it after a correct answer. Render `dialog` anywhere in the screen.
 */
export function useReauthGuard(port?: ReauthPort): {
  guard: (action: ReauthAction, run: () => void) => void;
  /** Resolves true when the person is (re)confirmed, false when they cancelled. */
  ask: (action: ReauthAction) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [asking, setAsking] = useState<ReauthAction | null>(null);
  const pending = useRef<((ok: boolean) => void) | null>(null);
  const ask = useCallback(
    (action: ReauthAction) =>
      reauthFresh()
        ? Promise.resolve(true)
        : new Promise<boolean>((res) => {
            pending.current?.(false);
            pending.current = res;
            setAsking(action);
          }),
    [],
  );
  const guard = useCallback(
    (action: ReauthAction, run: () => void) => void ask(action).then((ok) => ok && run()),
    [ask],
  );
  const close = (ok: boolean) => {
    const f = pending.current;
    pending.current = null;
    setAsking(null);
    f?.(ok);
  };
  const dialog = asking ? (
    <ReauthDialog
      action={asking}
      port={port}
      onCancel={() => close(false)}
      onDone={() => close(true)}
    />
  ) : null;
  return { guard, ask, dialog };
}
