import { Button } from '../../../components/ui/Button';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { Notice } from '../../../components/ui/Notice';
import { WeekdayToggle } from '../../../components/ui/WeekdayToggle';
import { BandRow, BandText, ChangeList } from '../../../tools/programEditor';
import type { PgStrings } from '../../../i18n/coachProgram';
import { trainingDays, type Program } from '../../../views/programs/model';
import type { Dow } from '../../domain/types';
import { coachDayMonth } from '../../format';
import type { LocaleId } from '../../../i18n';
import type { Change } from '../ops';
import { firstName } from '../parts';
import { DOW_OF_ISO, type ProgramBundle } from '../types';

export interface AssignmentCardProps {
  p: PgStrings;
  locale: LocaleId;
  bundle: ProgramBundle;
  draft: Program;
  trainerDays: readonly Dow[];
  clientName: string;
  wide: boolean;
  changes: readonly Change[];
  versionOpen: boolean;
  onVersionToggle: () => void;
  /** Trainer or admin: the days are controls. Anyone else: they are plain information. */
  canEdit: boolean;
  /** The assignment (trainer days) has changes the draft has not saved yet. */
  dirty: boolean;
  onToggleDay: (d: Dow) => void;
  /** Trainer days the program no longer trains on: take them off the assignment. */
  onClearStale: (days: readonly Dow[]) => void;
  onSetTimes: () => void;
  onCopyTo: (clientId: string) => void;
}

/** The Coach content of the info band: shared-program notice, trainer days (on the ASSIGNMENT, not the program) and the version row with its true diff. */
export function AssignmentCard(a: AssignmentCardProps) {
  const { p, bundle: b } = a;
  const first = firstName(a.clientName);
  const trainer = firstName(b.trainerName);
  const days = new Set(trainingDays(a.draft));
  const others = b.sharedWith;
  const withDays = DOW_OF_ISO.filter(
    (d) => a.trainerDays.includes(d) && days.has(DOW_OF_ISO.indexOf(d) + 1),
  );
  const soloDays = DOW_OF_ISO.filter(
    (d) => !a.trainerDays.includes(d) && days.has(DOW_OF_ISO.indexOf(d) + 1),
  );
  /** marked "with the trainer" while the program has no training on that day (the day was emptied after it was set) */
  const staleDays = DOW_OF_ISO.filter(
    (d) => a.trainerDays.includes(d) && !days.has(DOW_OF_ISO.indexOf(d) + 1),
  );
  const dayWord = (d: Dow) => (a.wide ? p.dowShort[d] : p.dowTwo[d]);
  const draftNote = b.versions.find((v) => v.n === b.draftVersion);

  const liveNote = b.versions
    .filter((v) => v.at != null)
    .slice(0, 1)
    .map(
      (v) =>
        `${p.edDiffLive(v.n)} · ${coachDayMonth(v.at!, a.locale)}${v.summary ? ` · ${v.summary}` : ''}`,
    );
  const notes = [...(draftNote?.summary ? [draftNote.summary] : []), ...liveNote];

  return (
    <>
      {others.length > 0 && (
        <BandRow
          icon="share-network"
          trailing={others.map((o) => (
            <Button
              key={o.clientId}
              variant="secondary"
              size="sm"
              icon="copy"
              disabled={o.version >= b.draftVersion}
              onClick={() => a.onCopyTo(o.clientId)}
            >
              {p.edCopyV(b.draftVersion, firstName(o.name))}
            </Button>
          ))}
        >
          <b>{p.edSharedProgram}</b>{' '}
          {a.wide
            ? p.edSharedLong(
                b.programName,
                others.map((o) => o.name).join(', '),
                first,
                firstName(others[0].name),
                others[0].version,
              )
            : p.edSharedShort(others.map((o) => firstName(o.name)).join(', '), first)}
        </BandRow>
      )}
      <BandRow
        layout="stack"
        title={p.edWithTrainer(trainer)}
        sub={a.canEdit ? p.edAsgEdit(first, trainer) : p.edOnlyTrainer(first)}
        trailing={
          a.canEdit ? (
            <Button variant="secondary" size="sm" icon="clock" onClick={a.onSetTimes}>
              {p.edSetTimes}
            </Button>
          ) : undefined
        }
      >
        <WeekdayToggle
          label={p.edTdLabel(trainer)}
          readOnly={!a.canEdit}
          onToggle={(id) => a.onToggleDay(id as Dow)}
          days={DOW_OF_ISO.map((d, i) => {
            const trains = days.has(i + 1);
            const on = trains && a.trainerDays.includes(d);
            return {
              id: d,
              label: dayWord(d),
              sub: !trains ? p.edTdRest : on ? p.edTdWith(trainer) : p.edTdSolo,
              on,
              disabled: !trains,
              ariaLabel: p.edTdDayAria(
                p.dowFull[d],
                !trains ? 'rest' : on ? 'with' : 'solo',
                trainer,
              ),
            };
          })}
        />
        {a.canEdit && (
          <BandText>
            <span role="status">{a.dirty ? p.edAsgPending : p.edAsgSaved(first)}</span>
          </BandText>
        )}
        {a.canEdit && staleDays.length > 0 && (
          <Notice
            tone="illness"
            icon="warning"
            trail={
              <Button variant="secondary" size="sm" onClick={() => a.onClearStale(staleDays)}>
                {p.edAsgStaleFix}
              </Button>
            }
          >
            {p.edAsgStale(staleDays.map((d) => p.dowShort[d]).join(', '), trainer)}
          </Notice>
        )}
        {!a.wide && (
          <BandText>
            {p.edTdSummary(
              trainer,
              withDays.map((d) => p.dowShort[d]).join(', '),
              soloDays.map((d) => p.dowShort[d]).join(', '),
            )}
          </BandText>
        )}
      </BandRow>
      <GroupedList
        surface="flat"
        label={p.edVersionRow(b.draftVersion, a.changes.length, b.liveVersion, first)}
      >
        {a.changes.length > 0 ? (
          <ListRow
            dense
            icon={<IconTile icon="clock-counter-clockwise" size={30} />}
            label={p.edVersionRow(b.draftVersion, a.changes.length, b.liveVersion, first)}
            aria-expanded={a.versionOpen}
            chevron
            onClick={a.onVersionToggle}
          />
        ) : (
          /* nothing to open: a plain line, not a row that looks pressable */
          <BandText>{p.edVersionRow(b.draftVersion, 0, b.liveVersion, first)}</BandText>
        )}
        {a.versionOpen && a.changes.length > 0 && (
          <ChangeList changes={a.changes} labels={p} notes={notes} />
        )}
      </GroupedList>
    </>
  );
}
