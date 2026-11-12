import './Schedule.css';
import './ScheduleFree.css';
import { Icon } from '../../ui';
import type { ScheduleStrings } from '../../i18n/coachSchedule';
import { fitsFree } from '../domain/availability';
import { useClientAvailability } from '../data/availability';
import { overlaps } from './model';
import { wall } from './time';
import type { RescheduleRequest, ScheduleSlot } from './types';

export interface RequestChecksProps {
  request: RescheduleRequest;
  slot: ScheduleSlot;
  /** every session of the window (the proposed time is tested against the other ones) */
  slots: readonly ScheduleSlot[];
  name: string;
  t: ScheduleStrings;
}

type Row = { ok: boolean; text: string };

/**
 * "Checks" of a session request in the trainer's drawer: is the proposed time inside the client's free hours (only when
 * the client shares them; otherwise the row is not shown, and nothing says why), and does it collide with another session.
 */
export function RequestChecks(p: RequestChecksProps) {
  const { request: r, slot, t } = p;
  const av = useClientAvailability(r.clientId);
  const end = r.toStart + slot.durationMin * 60_000;
  const rows: Row[] = [];
  if (av.state === 'shared') {
    const a = wall(r.toStart);
    const b = wall(end);
    const fits = a.day === b.day && fitsFree(av.availability, a.day, a.min, b.min);
    rows.push({ ok: fits, text: fits ? t.rcChkFree(p.name) : t.rcChkNotFree(p.name) });
  }
  const clash = p.slots.some(
    (s) =>
      s.id !== slot.id &&
      s.status !== 'moved' &&
      overlaps(s, { start: r.toStart, durationMin: slot.durationMin }),
  );
  rows.push({ ok: !clash, text: clash ? t.rcChkClash : t.rcChkNoClash });
  return (
    <ul className="sc-insp-checks" aria-label={t.rcChkH}>
      {rows.map((x) => (
        <li key={x.text} className={x.ok ? 'is-ok' : 'is-bad'}>
          <Icon name={x.ok ? 'check' : 'warning'} />
          <span>{x.text}</span>
        </li>
      ))}
    </ul>
  );
}
