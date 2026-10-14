import { useMemo, type ReactNode } from 'react';
import { ChatStoryFrame } from '../chat/ChatStoryFrame';
import { createFixturesChatPort, type FixturesChatPort } from '../chat/__fixtures__/fixtures';
import type { Category } from '../domain/types';
import { createFixturesNotesPort } from '../notes/__fixtures__/fixtures';
import { configureThreadExtras, type ThreadExtrasInitial } from '../threadExtras';
import { createFixturesShareSource } from './__fixtures__/fixtures';
import type { ShareRef, ShareSource } from './types';

/** Lower one category of Oleh (c1) in the share source. */
export const lowerConsent =
  (...cats: Category[]) =>
  (s: ShareSource): ShareSource => {
    const c = s.clients.c1;
    const consent = { ...c.consent };
    for (const k of cats) consent[k] = 'off';
    return { ...s, clients: { ...s.clients, c1: { ...c, consent } } };
  };

export interface ShareStoryFrameProps {
  initial?: ThreadExtrasInitial;
  /** Messages the thread starts with (shares of the trainer, with an optional caption). */
  sent?: { share: ShareRef; text?: string }[];
  /** Categories of Oleh that are switched off for the share source. */
  off?: Category[];
  notesEmpty?: boolean;
  /** Slow share source: the picker and cards show their loading states. */
  slow?: boolean;
  hash?: string;
}

/**
 * Stories: the real shell around the Oleh thread with Share and Notes switched on, parts of them open at mount.
 * Ports are created per mount, so every story starts from its own data.
 */
export function ShareStoryFrame({
  initial,
  sent,
  off,
  notesEmpty,
  slow,
  hash,
}: ShareStoryFrameProps): ReactNode {
  const makePort = useMemo(
    () => (): FixturesChatPort => {
      const p = createFixturesChatPort();
      sent?.forEach(
        (s, i) =>
          void p.send('cid-c1', {
            id: `story-share-${i}`,
            text: s.text ?? '',
            at: p.now() + i,
            body: { kind: 'share', share: s.share, ...(s.text ? { text: s.text } : {}) },
          }),
      );
      return p;
    },
    [sent],
  );
  useMemo(() => {
    configureThreadExtras({
      initial,
      sharePort: createFixturesShareSource({
        warm: !slow,
        delayMs: slow ? 60_000 : undefined,
        patch: off?.length ? lowerConsent(...off) : undefined,
      }),
      notesPort: createFixturesNotesPort(notesEmpty ? { seed: { c1: [] } } : {}),
    });
  }, [initial, off, notesEmpty, slow]);
  return <ChatStoryFrame makePort={makePort} hash={hash ?? '#/c/chat?with=c1'} />;
}
