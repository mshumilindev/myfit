import { useMemo, useState } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExerciseRow } from '../../components/ui/ExerciseRow';
import { FailedState } from '../../components/ui/FailedState';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { Notice } from '../../components/ui/Notice';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Tag } from '../../components/ui/Tag';
import { WeekdayToggle } from '../../components/ui/WeekdayToggle';
import { useT } from '../../i18n';
import { usePgT } from '../../i18n/coachProgram';
import { Icon } from '../../ui';
import {
  dayExercises,
  dayItems,
  dayMode,
  dayName,
  isBare,
  trainingDays,
} from '../../views/programs/model';
import { effectiveConsent } from '../domain/consent';
import type { CoachClient } from '../domain/types';
import { coachDayMonth } from '../format';
import { programPageRoute, type CoachRoute } from '../routes';
import { exerciseFacts } from './catalog';
import { useProgramDraft } from './draftStore';
import type { ProgramPort } from './port';
import { firstName, prescriptionLine, programSets } from './parts';
import { DOW_OF_ISO } from './types';
import './Program.css';

export interface ProgramTabProps {
  client: CoachClient;
  onNavigate: (r: CoachRoute) => void;
  port?: ProgramPort;
  trainerName?: string;
}

/** The check context of a client: restrictions count only when the client shares injuries. */
export const checkContextOf = (c: CoachClient) => {
  const ec = effectiveConsent(c.mode, c.consent);
  return { injury: ec.injury, restrictions: c.restriction ? [c.restriction] : [] } as const;
};

/** Client 360 > Program (S-03 Program tab): the program the client has now, by weekday, with trainer days and versions. */
export function ProgramTab({ client, onNavigate, port }: ProgramTabProps) {
  const { p, locale } = usePgT();
  const { t } = useT();
  const api = useProgramDraft(client.id, checkContextOf(client), port);
  const [open, setOpen] = useState<number | null>(null);
  const b = api.bundle;
  const first = firstName(client.name);

  const live = b?.live;
  const days = useMemo(() => (live ? new Set(trainingDays(live)) : new Set<number>()), [live]);
  const openFirst = open ?? (live ? (trainingDays(live)[0] ?? null) : null);

  if (!b || !live) {
    return api.error ? (
      <FailedState
        icon="cloud-slash"
        title={p.ptLoadFailedTitle}
        body={p.ptLoadFailedBody}
        retryLabel={p.ptTryAgain}
        onRetry={api.retry}
      />
    ) : (
      <SkeletonRows rows={5} />
    );
  }

  const trainer = firstName(b.trainerName);
  const withDays = b.trainerDays.map((d) => p.dowShort[d]).join(', ');
  const editorRoute: CoachRoute = programPageRoute(client.id, 'edit', 'client');
  const hasDraft = b.draft !== b.live || api.dirty;

  return (
    <div className="pg-tab">
      <div className="pg-tab-act">
        <Button
          variant="primary"
          iconTrailing="arrow-right"
          onClick={() => onNavigate(editorRoute)}
        >
          {p.ptOpenEditor}
        </Button>
      </div>
      <Card tone="accent" emphasis="hero" pad="lg" className="pg-prog">
        <div className="pg-prog-top">
          <Tag tone="ok">{p.ptActive(client.programWeek)}</Tag>
          <span className="pg-by">
            <Avatar name={b.trainerName} size={22} />
            {p.ptBy(b.trainerName)}
          </span>
        </div>
        <h2 className="pg-prog-name">{b.programName}</h2>
        <p className="pg-prog-meta">
          {p.ptNoEnd} · {p.ptDaysWeek(days.size)}
        </p>
      </Card>
      <WeekdayToggle
        readOnly
        label={p.ptDaysLabel}
        onToggle={() => undefined}
        days={DOW_OF_ISO.map((d) => ({
          id: d,
          label: p.dowShort[d],
          on: b.trainerDays.includes(d),
          ariaLabel: `${p.dowFull[d]}${b.trainerDays.includes(d) ? `, ${p.edTdWith(trainer)}` : ''}`,
        }))}
      />
      <p className="pg-note">{p.ptTrainerNote(trainer, withDays)}</p>

      <GroupedList label={p.ptDaysLabel} list>
        {DOW_OF_ISO.map((dow, i) => {
          const iso = i + 1;
          if (!days.has(iso))
            return (
              <li key={dow}>
                <ListRow dense time={p.dowShort[dow]} label={p.ptRest} dim />
              </li>
            );
          const mode = dayMode(live, iso);
          const items = dayExercises(live, iso);
          const isOpen = openFirst === iso;
          const sets = programSets(live, iso);
          return (
            <li key={dow}>
              <ListRow
                dense
                strong
                time={p.dowShort[dow]}
                label={
                  <>
                    {dayName(live, iso)}
                    {b.trainerDays.includes(dow) && (
                      <Tag tone="accent" className="pg-with">
                        {p.ptTrainWith(trainer)}
                      </Tag>
                    )}
                  </>
                }
                sub={
                  mode === 'muscles'
                    ? `${p.ptDefinedBy}: ${(live.targetMuscles[String(iso)] ?? []).map((m) => t.muscleGroups[m] ?? m).join(' · ')}`
                    : p.ptExSets(items.length, sets)
                }
                aria-expanded={isOpen}
                aria-label={`${p.dowFull[dow]}, ${dayName(live, iso)}`}
                trailing={<Icon name={isOpen ? 'caret-up' : 'caret-down'} />}
                onClick={() => setOpen(isOpen ? -1 : iso)}
              />
              {isOpen && mode === 'exercises' && (
                <ul className="pg-ex" aria-label={dayName(live, iso)}>
                  {dayItems(live, iso)
                    .filter((it) => it.kind === 'strength')
                    .map((it) => {
                      const f = exerciseFacts(it.name);
                      return (
                        <li key={it.id}>
                          <ExerciseRow
                            name={it.name}
                            image={f.image}
                            thumb={40}
                            sub={f.muscles
                              .slice(0, 2)
                              .map((m) => t.muscleGroups[m] ?? m)
                              .join(' · ')}
                            prescription={isBare(it) ? undefined : prescriptionLine(it, p)}
                          />
                        </li>
                      );
                    })}
                </ul>
              )}
            </li>
          );
        })}
      </GroupedList>

      <GroupedList header={p.ptVersions} label={p.ptVersions} list>
        {hasDraft && (
          <li>
            <ListRow
              dense
              strong
              label={p.ptDraft(b.draftVersion)}
              sub={b.versions.find((v) => v.n === b.draftVersion)?.summary || p.ptNoChange}
              onClick={() => onNavigate(editorRoute)}
              chevron
            />
          </li>
        )}
        {b.versions
          .filter((v) => v.at != null)
          .map((v) => (
            <li key={v.n}>
              <ListRow
                dense
                strong
                label={p.ptVersionOn(v.n, coachDayMonth(v.at!, locale))}
                sub={v.summary || p.ptNoChange}
              />
            </li>
          ))}
      </GroupedList>
      {b.liveVersion > 0 && (
        <Notice
          tone="neutral"
          icon={b.seen && b.seen.version >= b.liveVersion ? 'checks' : 'check'}
        >
          {b.seen && b.seen.version >= b.liveVersion
            ? p.ptSeen(first, coachDayMonth(b.seen.at, locale))
            : p.ptNotSeen(first, b.liveVersion)}
        </Notice>
      )}
      {b.sharedWith.length > 0 && (
        <Notice tone="neutral" icon="share-network">
          {p.edSharedShort(b.sharedWith.map((s) => firstName(s.name)).join(', '), first)}
        </Notice>
      )}
      {!days.size && (
        <EmptyState titleAs="h2" icon="barbell" title={p.edNoDays} body={p.edNoDaysBody}>
          <Button variant="primary" onClick={() => onNavigate(editorRoute)}>
            {p.ptOpenEditor}
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
