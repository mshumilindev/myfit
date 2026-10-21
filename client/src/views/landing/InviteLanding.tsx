/** Opened invite link (#/join/<token>): the landing with a personalised step 0, then the standard onboarding. */
import { useEffect, useRef, useState } from 'react';
import { callFn } from '../../api';
import { LandingView } from './LandingView';

interface Preview {
  state: 'valid' | 'expired' | 'claimed' | 'revoked';
  inviter: string | null;
  expiresAt: number;
}

export function InviteLanding({ token, onStart }: { token: string; onStart: () => void }) {
  const [info, setInfo] = useState<Preview | null>(null);
  const start = useRef(onStart);
  useEffect(() => {
    start.current = onStart;
  });

  useEffect(() => {
    let live = true;
    callFn<Preview>('invitePreview', { token })
      .then((i) => {
        if (!live) return;
        // A dead / used link is explained by the onboarding screen itself.
        if (i.state === 'valid') setInfo(i);
        else start.current();
      })
      .catch(() => live && start.current());
    return () => {
      live = false;
    };
  }, [token]);

  if (!info) return null;
  return (
    <LandingView
      onLoggedIn={() => {}}
      invite={{ inviter: info.inviter, expiresAt: info.expiresAt, onStart }}
    />
  );
}
