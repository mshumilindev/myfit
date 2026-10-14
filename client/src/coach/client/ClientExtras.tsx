import { useMemo, useState } from 'react';
import { Chip, ChipGroup } from '../../components/ui/Chip';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { Notice } from '../../components/ui/Notice';
import { Tag } from '../../components/ui/Tag';
import { Button } from '../../components/ui/Button';
import { useProgramMine, type ProgramAssignment } from '../../data/programMine';
import { useClientT } from '../../i18n/coachClient';
import { useT } from '../../i18n';
import { kgToLb } from '../../plates';
import { exerciseUnit } from '../../store';
import { Icon } from '../../ui';
import { coachClock } from '../format';
import { DOWS, type Dow } from '../domain/types';
import { firstName } from '../screens/format';
import { useClientCoach, useClientCoachEnabled, useTrainerLink } from './data/useClientCoach';
import { ClientRescheduleSheet, NextSessionTile, useMySessions } from './screens/ClientSchedule';
import type { ScheduleSlot } from '../schedule/types';
import { dayOfTs } from '../schedule/time';
import { shortWeekday } from '../schedule/labels';
import './ClientCoach.css';

/** Any Monday (1 Jan 2024) as a day key: weekday names come from the locale. */
const MONDAY = Math.floor(Date.UTC(2024, 0, 1) / 86_400_000);

/** Today (after the program card): the "With your trainer" tag, the next session tile, coach days for a member without a trainer. */
export function ClientTodayExtras() {
  const on = useClientCoachEnabled();
  const { cc } = useClientT();
  const { snapshot } = useClientCoach(undefined, on);
  const my = useMySessions();
  const [form, setForm] = useState<ScheduleSlot | null>(null);
  if (!on || !snapshot) return null;
  const link = snapshot.link;
  if (link.state === 'none') {
    const days = snapshot.selfCoachDays;
    return days.length > 0 ? (
      <div className="cc-strip">
        <Tag tone="neutral" icon={<Icon name="user" />}>
          {cc.tdCoachTag(days.join(', '))}
        </Tag>
      </div>
    ) : null;
  }
  if (!my || my.loading) return null;
  const todays = my.upcoming.find((s) => dayOfTs(s.start) === my.today);
  return (
    <div className="cc-strip">
      {todays && (
        <div className="cc-tags">
          <Tag tone="people" icon={<Icon name="user" />}>
            {cc.tdWithTag(coachClock(todays.start))}
          </Tag>
        </div>
      )}
      <NextSessionTile my={my} onRequest={(s) => setForm(s)} />
      {form && (
        <ClientRescheduleSheet
          my={my}
          slot={form}
          onClose={() => setForm(null)}
          onOpenChat={() => {
            window.location.hash = '#/trainer/chat';
          }}
        />
      )}
    </div>
  );
}

/** Programs (under "My program"): the program-updated notice with Got it, the days with the trainer, coach days (no trainer). */
export function ClientProgramExtras({
  assignment: given,
}: { assignment?: ProgramAssignment | null } = {}) {
  const on = useClientCoachEnabled();
  const { cc } = useClientT();
  const { locale } = useT();
  const { snapshot, store } = useClientCoach(undefined, on);
  const link = useTrainerLink();
  const mine = useProgramMine();
  const assignment = given === undefined ? mine.assignment : given;
  const [dismissed, setDismissed] = useState(false);
  if (!on || !snapshot) return null;
  const first = firstName(link?.trainer?.name ?? '');
  if (!link) {
    // no trainer in the app: the member marks the days with their own coach
    const days = snapshot.selfCoachDays;
    const names = Object.fromEntries(
      DOWS.map((d, i) => [d, shortWeekday(MONDAY + i, locale)]),
    ) as Record<Dow, string>;
    return (
      <GroupedList header={cc.tdCoachDaysHead} footer={cc.tdCoachDaysFoot}>
        <ListRow
          icon={<IconTile tone="people" size={30} icon="user" />}
          label={cc.tdCoachDaysRow}
          value={days.join(', ')}
        />
        <ChipGroup className="cc-daychips" role="group" aria-label={cc.tdCoachDaysRow}>
          {DOWS.map((d) => (
            <Chip
              key={d}
              selected={days.includes(d)}
              aria-pressed={days.includes(d)}
              onClick={() =>
                void store.port.setSelfCoachDays(
                  days.includes(d) ? days.filter((x) => x !== d) : [...days, d],
                )
              }
            >
              {names[d]}
            </Chip>
          ))}
        </ChipGroup>
      </GroupedList>
    );
  }
  const prog = snapshot.program;
  const items = assignment?.program.items ?? [];
  const bare = items.filter((i) => i.kind === 'strength' && (i.bare || i.sets <= 0)).length;
  return (
    <>
      {prog && !prog.acked && !dismissed && (
        <Notice
          tone="people"
          icon="list-checks"
          trail={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDismissed(true);
                store.ackProgram(prog.version);
              }}
            >
              {cc.pgAck}
            </Button>
          }
        >
          <b>{cc.pgUpdated(first)}</b> · {cc.pgUpdatedV(`v${prog.version}`)}. {prog.summary}
        </Notice>
      )}
      {snapshot.program && snapshot.program.trainerDays.length > 0 && (
        <Notice tone="people" icon="user">
          {snapshot.program.trainerDays.map((d) => `${d}`).join(', ')} · {cc.pgDaysNote(first)}
        </Notice>
      )}
      {snapshot.program && snapshot.program.activities.length > 0 && (
        <Notice tone="active" icon="person-simple-run">
          {cc.pgActivityNote(first)}
        </Notice>
      )}
      {bare > 0 && (
        <Notice tone="active" icon="info">
          {cc.pgBareNote}
        </Notice>
      )}
    </>
  );
}

/** Session: the trainer's target for the exercise on the card (from the program item the trainer wrote). */
export function ClientTargetStrip({
  exName,
  planItemId,
  assignment: given,
}: {
  exName: string;
  /** the program row the exercise was started from; wins over the name (one exercise can sit on two days) */
  planItemId?: string;
  assignment?: ProgramAssignment | null;
}) {
  const on = useClientCoachEnabled();
  const { cc } = useClientT();
  const link = useTrainerLink();
  const mine = useProgramMine();
  const assignment = given === undefined ? mine.assignment : given;
  const item = useMemo(
    () =>
      (planItemId ? assignment?.program.items.find((i) => i.id === planItemId) : undefined) ??
      assignment?.program.items.find(
        (i) => i.name.toLowerCase() === exName.toLowerCase() && i.kind === 'strength',
      ),
    [assignment, exName, planItemId],
  );
  if (!on || !link || !item || item.bare || item.sets <= 0) return null;
  const first = firstName(link.trainer?.name ?? '');
  // the program stores kg; the athlete reads this lift in the unit they train it in
  const load = item.targetWeight
    ? exerciseUnit(item.name) === 'lb'
      ? `${Math.round(kgToLb(item.targetWeight) * 10) / 10} lb`
      : `${item.targetWeight} kg`
    : cc.seBodyweight;
  const parts = [
    `${item.sets} × ${item.reps} · ${load}`,
    item.targetRpe ? `RPE ${item.targetRpe}` : null,
    item.restSec
      ? cc.seRest(`${Math.floor(item.restSec / 60)}:${String(item.restSec % 60).padStart(2, '0')}`)
      : null,
    item.dropLast ? cc.seDropLast : null,
  ].filter(Boolean);
  return (
    <div className="cc-strip">
      <Notice
        tone="people"
        icon="target"
        below={
          item.note ? (
            <span className="cc-note">
              <Icon name="pencil-simple" /> {item.note}
            </span>
          ) : undefined
        }
      >
        <b>{cc.seTarget(first)}</b> · {parts.join(' · ')}
      </Notice>
    </div>
  );
}

/** Program review, one row: the "With your trainer" tag on a weekday the trainer owns (`dow` is ISO, Monday = 1). */
export function ClientTrainerDayTag({ dow }: { dow: number }) {
  const on = useClientCoachEnabled();
  const { cc } = useClientT();
  const { snapshot } = useClientCoach(undefined, on);
  const link = useTrainerLink();
  if (!on || !link || !snapshot?.program) return null;
  if (!snapshot.program.trainerDays.includes(DOWS[dow - 1])) return null;
  return (
    <span className="cc-daytag">
      <Tag tone="people" icon={<Icon name="user" />}>
        {cc.pgWithTrainer}
      </Tag>
    </span>
  );
}
