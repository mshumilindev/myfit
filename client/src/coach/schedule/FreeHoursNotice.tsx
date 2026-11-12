import { Notice } from '../../components/ui/Notice';
import type { ScheduleStrings } from '../../i18n/coachSchedule';
import { useClientAvailability } from '../data/availability';
import { fitsFree } from '../domain/availability';
import type { DraftSpan } from './HoursNotice';
import { wall } from './time';

/**
 * A calm warning (never a block) under a session form for ONE client who shares their free hours: the session sits
 * outside them. Nothing is shown when the client does not share, when the read fails, or while it loads.
 */
export function FreeHoursNotice(p: {
  clientId: string | null;
  drafts: readonly DraftSpan[];
  name: string;
  t: ScheduleStrings;
}) {
  const av = useClientAvailability(p.clientId);
  if (av.state !== 'shared') return null;
  const out = p.drafts.filter((d) => {
    const a = wall(d.start);
    const b = wall(d.start + d.durationMin * 60_000);
    return !(a.day === b.day && fitsFree(av.availability, a.day, a.min, b.min));
  });
  if (out.length === 0) return null;
  return (
    <Notice tone="note" icon="clock" role="status">
      {out.length > 1 ? p.t.rcChkNotFreeN(p.name, out.length) : p.t.rcChkNotFree(p.name)}
    </Notice>
  );
}
