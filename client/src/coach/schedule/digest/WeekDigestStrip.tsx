import { useMemo } from 'react';
import { Card } from '../../../components/ui/Card';
import { StatStrip, type StatStripItem } from '../../../components/ui/StatStrip';
import { useScheduleDigestT } from '../../../i18n/coachScheduleDigest';
import type { CoachWorldPort } from '../../data/port';
import { useCoachWorld } from '../../data/useCoachWorld';
import { usePeople } from '../people';
import type { SchedulePort } from '../port';
import { useSchedule } from '../useSchedule';
import './WeekDigestStrip.css';
import { digestIsEmpty, weekDigest } from './weekDigest';

export interface WeekDigestStripProps {
  /** the seven day keys of the week shown */
  days: readonly number[];
  isThisWeek: boolean;
  port?: SchedulePort;
  worldPort?: CoachWorldPort;
}

/**
 * Per-week digest of the Week page: sessions done of planned, reschedules waiting, decisions open (this week only).
 * Built from the kit `StatStrip` in a `Card`. Consent-gated (sessions of clients who do not share totals are not
 * counted, and the strip says how many were left out) and silent: while loading, or when the week has nothing to
 * count, it renders nothing.
 */
export function WeekDigestStrip(p: WeekDigestStripProps) {
  const t = useScheduleDigestT();
  const sch = useSchedule(p.port);
  const world = useCoachWorld(p.worldPort);
  const people = usePeople(p.worldPort);
  const minute = Math.floor(sch.now / 60_000);
  const needDecision = world.world?.counts.needDecision;
  const d = useMemo(
    () =>
      weekDigest({
        days: p.days,
        slots: sch.slots,
        requests: sch.requests,
        byId: people.byId,
        now: sch.now,
        openDecisions: p.isThisWeek && needDecision != null ? needDecision : null,
      }),
    // `now` moves with the minute clock; the digest only needs it for request expiry
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.days, p.isThisWeek, sch.slots, sch.requests, people.byId, needDecision, minute],
  );
  if (sch.loading || people.loading || digestIsEmpty(d)) return null;
  const items: StatStripItem[] = [
    {
      value: d.planned > 0 ? `${d.done}/${d.planned}` : '0',
      label: d.planned > 0 ? t.wdDone : t.wdPlanned,
    },
    { value: d.moves, label: t.wdMoves, tone: d.moves > 0 ? 'accent' : undefined },
    ...(d.decisions != null
      ? [
          {
            value: d.decisions,
            label: t.wdDecisions,
            tone: d.decisions > 0 ? ('accent' as const) : undefined,
          },
        ]
      : []),
  ];
  return (
    <Card pad="md" className="sc-digest">
      <StatStrip items={items} label={t.wdLabel} wrapLabels />
      {d.hidden > 0 && <p className="sc-form-hint">{t.wdHidden(d.hidden)}</p>}
    </Card>
  );
}
