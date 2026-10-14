import { useRef } from 'react';
import { useFitCount } from '../../../components/ui/useFitCount';
import { StoryBubble, StoryRow, type StoryRing } from '../../../components/ui/StoryBubble';
import type { RosterStrings } from '../../../i18n/coachRoster';
import type { RosterRow } from '../../domain/roster';
import { ClientAvatar } from '../../ClientAvatar';
import { firstName, statusLabel } from '../format';

/**
 * The row of client bubbles above the list (live / alert ring) with a "+N" bubble that shows everyone. The row is
 * always full: as many bubbles as the width holds (measured, follows a resize) and the "+N" bubble in the last slot of
 * the same row; `max` only caps the count (the row never shows more than that).
 */
export function RosterStrip(p: {
  clients: readonly RosterRow[];
  max: number;
  r: RosterStrings;
  unread?: Readonly<Record<string, number>>;
  onOpen: (id: string) => void;
  onAll: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const capped = p.clients.slice(0, p.max);
  const fit = useFitCount(ref, p.clients.length);
  const first = capped.slice(0, fit.shown);
  const rest = p.clients.length - first.length;
  return (
    <StoryRow innerRef={ref} className={rest > 0 ? 'ro-strip ro-strip--full' : 'ro-strip'}>
      {first.map(({ client: c, status }) => {
        const ring: StoryRing = c.live ? 'live' : status === 'urgent' ? 'alert' : 'default';
        return (
          <StoryBubble
            key={c.id}
            size="md"
            ring={ring}
            label={firstName(c.name)}
            media={<ClientAvatar id={c.id} name={c.name} hasPhoto={c.hasPhoto} size={42} />}
            badge={p.unread?.[c.id] || undefined}
            aria-label={
              p.unread?.[c.id]
                ? p.r.c3MessageUnread(firstName(c.name), p.unread[c.id])
                : `${c.name}, ${statusLabel(p.r, status)}`
            }
            onClick={() => p.onOpen(c.id)}
          />
        );
      })}
      {rest > 0 && (
        <StoryBubble
          size="md"
          more={rest}
          label={p.r.roStoryAll}
          aria-label={`${p.r.roStoryAll} (+${rest})`}
          onClick={p.onAll}
        />
      )}
    </StoryRow>
  );
}
