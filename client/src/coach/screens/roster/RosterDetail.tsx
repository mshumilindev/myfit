import { InfoTable } from '../../../components/ui/InfoTable';
import { LockedRow, StatusLabel } from '../../../components/ui/RosterRows';
import { useT, type LocaleId } from '../../../i18n';
import { restrictionLine } from '../injuryLabel';
import type { RosterStrings } from '../../../i18n/coachRoster';
import { coachClock, coachDate } from '../../format';
import type { RosterRow } from '../../domain/roster';
import { hasClient } from '../../domain/slots';
import type { Signal, Slot } from '../../domain/types';
import {
  lastLabel,
  modeLabel,
  sharedReadable,
  signalTitle,
  statusLabel,
  trainerDaysText,
} from '../format';

/** The detail rows of the selected client (status, program, week, last session, shares, restriction ...). */
export function RosterDetailBody({
  row,
  r,
  now,
  locale,
  slots,
  signals,
}: {
  row: RosterRow;
  r: RosterStrings;
  now: number;
  locale: LocaleId;
  slots: readonly Slot[];
  signals: readonly Signal[];
}) {
  const { t: app } = useT();
  const c = row.client;
  const top = row.topSignalKey ? signals.find((s) => s.key === row.topSignalKey) : undefined;
  const injuryOff = c.mode === 'program' || c.consent.injury === 'off';
  const next = slots
    .filter((x) => x.start >= now && x.status !== 'missed' && hasClient(x, c.id))
    .sort((a, b) => a.start - b.start)[0];
  return (
    <>
      <InfoTable
        label={r.roDetailStatus}
        rows={[
          {
            id: 'status',
            label: r.roDetailStatus,
            value:
              row.status === 'none' ? (
                r.roNoSignal
              ) : (
                <StatusLabel status={row.status}>{statusLabel(r, row.status)}</StatusLabel>
              ),
          },
          {
            id: 'program',
            label: r.roDetailProgram,
            value: r.roProgramWeek(c.program, c.programWeek),
          },
          {
            id: 'week',
            label: r.roDetailWeek,
            value: c.mode === 'program' ? r.c3NotLogged : r.roSessionsOf(c.done, c.planned),
          },
          { id: 'last', label: r.roDetailLast, value: lastLabel(r, c, now) },
          {
            id: 'streak',
            label: r.roDetailStreak,
            value: c.mode === 'program' ? r.c3NotLogged : r.roWeeksN(c.streakWeeks),
          },
          { id: 'gym', label: r.roDetailGym, value: c.gym },
          { id: 'logging', label: r.roDetailLogging, value: modeLabel(r, c.mode) },
          {
            id: 'days',
            label: r.roDetailTrainerDays,
            value: c.trainerDays.length ? trainerDaysText(r, c.trainerDays) : r.roNoDaysThisWeek,
          },
          ...(next
            ? [
                {
                  id: 'next',
                  label: r.roDetailNext,
                  value: `${coachDate(next.start, locale)} ${coachClock(next.start)}`,
                },
              ]
            : []),
          {
            id: 'shares',
            label: r.roDetailShares,
            value: c.mode === 'program' ? r.roSharesNone : sharedReadable(r, c.mode, c.consent),
          },
          {
            id: 'restriction',
            label: r.roDetailRestriction,
            value: injuryOff ? (
              <LockedRow>{r.roNotShared}</LockedRow>
            ) : (
              (restrictionLine(app, c.injuries) ?? c.restriction ?? r.roNoneDeclared)
            ),
          },
        ]}
      />
      {top && <p className="ro-sig">{signalTitle(r, top)}</p>}
    </>
  );
}
