/**
 * Today › "Add it to your program" (design: Suggestion A). A pattern card when
 * the same activity keeps landing on the same weekday and the member's own
 * program doesn't plan it; an "Add to <day>" sheet; "Not now" options (ask in
 * two weeks / never for this activity / stop all) and an Undo after adding.
 * Shown only for a program the member wrote — a trainer's isn't edited here.
 */
import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';
import { useStore } from '../store';
import { useProgramMine } from '../data/programMine';
import { isOwnProgram, savePlannedActivities } from '../data/programActivities';
import { useProgramSuggestOff, setProgramSuggestOff } from '../activityPrefs';
import {
  MUTE_ALL,
  SNOOZE_DAYS,
  mutedTypes,
  pruneSnoozes,
  snoozeKey,
  suggestForProgram,
  type ProgramSuggestion,
} from '../programSuggest';
import { sanitizeActivities, type ProgramActivity } from '../views/programs/model';
import { useWeekStartDay, weekOrder } from '../weekStart';
import { activityType } from '../activities';
import { kitTone } from '../views/logActivity/shared';
import type { ActivityEffort } from '../types';
import { Banner } from './ui/Banner';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { GroupedList, ListRow } from './ui/GroupedList';
import { NumberStepper } from './ui/NumberStepper';
import { Segmented } from './ui/Segmented';
import { Sheet } from './ui/Overlays';
import { Snackbar } from './ui/Snackbar';
import './ProgramActivitySuggest.css';

/** The banner's colour family: the activity's own (orchid / green / blue). */
function toneOf(type: string): 'conditioning' | 'sport' | 'rest' {
  return kitTone(type) as 'conditioning' | 'sport' | 'rest';
}

const EFFORTS: ActivityEffort[] = ['light', 'moderate', 'hard'];
const UNDO_MS = 8000;

/**
 * The member's own active program, when its planned activities can be edited here
 * (a trainer's isn't; a sealed list this device can't open yet isn't guessed at).
 */
export function useEditableProgram() {
  const { assignment, active } = useProgramMine();
  const own =
    active &&
    isOwnProgram(assignment) &&
    !!assignment &&
    !(
      assignment.program.activitiesEnc !== undefined && assignment.program.activities === undefined
    );
  const planned = useMemo(() => sanitizeActivities(assignment?.program.activities), [assignment]);
  return { assignment, own, planned };
}

/** "Add to program" from anywhere (the Activity page): the same sheet, no suggestion. */
export function AddToProgramSheet({
  type,
  weekday,
  minutes,
  onClose,
}: {
  type: string;
  weekday: number;
  minutes: number;
  onClose: () => void;
}) {
  const { t } = useT();
  const weekStart = useWeekStartDay();
  const { assignment, own, planned } = useEditableProgram();
  if (!own || !assignment) return null;
  const free = weekOrder(weekStart).filter(
    (d) => !planned.some((p) => p.type === type && p.day === d),
  );
  return (
    <AddSheet
      s={{
        type,
        weekday: (free.includes(weekday as never) ? weekday : free[0]) as never,
        minutes,
        weeks: 0,
        of: 0,
      }}
      typeName={t.actType[type] ?? type}
      dayName={(d) => t.weekDayNames[d - 1] ?? ''}
      days={free}
      onAdd={(day, min, effort) => {
        void savePlannedActivities(assignment.program.id, [
          ...planned,
          { id: crypto.randomUUID(), day, type, minutes: min, effort, when: 'any' },
        ]);
        onClose();
      }}
      onClose={onClose}
    />
  );
}

export function ProgramActivitySuggest() {
  const { t } = useT();
  const store = useStore();
  const off = useProgramSuggestOff();
  const weekStart = useWeekStartDay();
  const [sheet, setSheet] = useState<'add' | 'later' | null>(null);
  const [undo, setUndo] = useState<{
    programId: string;
    before: ProgramActivity[];
    text: string;
  } | null>(null);
  const { assignment, own, planned } = useEditableProgram();
  const [now] = useState(() => Date.now());
  const suggestion = useMemo(
    () =>
      own
        ? suggestForProgram({
            activities: store.activities,
            planned,
            off,
            now,
            weekStart,
          })
        : null,
    [own, store.activities, planned, off, weekStart, now],
  );

  useEffect(() => {
    if (!undo) return;
    const id = window.setTimeout(() => setUndo(null), UNDO_MS);
    return () => window.clearTimeout(id);
  }, [undo]);

  const typeName = (k: string) => t.actType[k] ?? k;
  const dayName = (d: number) => t.weekDayNames[d - 1] ?? '';

  async function add(s: ProgramSuggestion, day: number, minutes: number, effort: ActivityEffort) {
    if (!assignment) return;
    const before = planned;
    const next: ProgramActivity[] = [
      ...before,
      { id: crypto.randomUUID(), day, type: s.type, minutes, effort, when: 'any' },
    ];
    setSheet(null);
    setUndo({
      programId: assignment.program.id,
      before,
      text: t.psgAdded(typeName(s.type), dayName(day)),
    });
    await savePlannedActivities(assignment.program.id, next);
  }

  const mute = (entry: string) => {
    setProgramSuggestOff([...pruneSnoozes(off, now), entry]);
    setSheet(null);
  };

  return (
    <>
      {suggestion && (
        <Banner
          tone={toneOf(suggestion.type)}
          icon={activityType(suggestion.type)?.icon ?? 'heartbeat'}
          kicker={t.psgKicker}
          title={t.psgTitle(typeName(suggestion.type), dayName(suggestion.weekday))}
          body={t.psgBody(suggestion.weeks, suggestion.of, suggestion.minutes)}
          primaryAction={{
            label: t.psgAddTo(dayName(suggestion.weekday)),
            onClick: () => setSheet('add'),
          }}
          skipAction={{ label: t.psgNotNow, onClick: () => setSheet('later') }}
        />
      )}
      {suggestion && sheet === 'add' && (
        <AddSheet
          s={suggestion}
          typeName={typeName(suggestion.type)}
          dayName={dayName}
          days={weekOrder(weekStart).filter(
            (d) => !planned.some((p) => p.type === suggestion.type && p.day === d),
          )}
          onAdd={(day, min, eff) => void add(suggestion, day, min, eff)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'later' && (
        <Sheet onClose={() => setSheet(null)}>
          <div className="psg-sheet">
            <h3>{t.psgNotNow}</h3>
            <GroupedList>
              {suggestion && (
                <>
                  <ListRow
                    label={t.psgLater(SNOOZE_DAYS)}
                    chevron
                    onClick={() =>
                      mute(snoozeKey(suggestion.type, now + SNOOZE_DAYS * 24 * 3600 * 1000))
                    }
                  />
                  <ListRow
                    label={t.psgNever(typeName(suggestion.type))}
                    chevron
                    onClick={() => mute(suggestion.type)}
                  />
                </>
              )}
              <ListRow
                label={t.psgStopAll}
                sub={t.psgStopAllSub}
                chevron
                onClick={() => mute(MUTE_ALL)}
              />
            </GroupedList>
            <MutedList off={off} typeName={typeName} />
          </div>
        </Sheet>
      )}
      {undo && (
        <Snackbar
          position="inline"
          text={undo.text}
          action={{
            label: t.undo,
            onClick: () => {
              void savePlannedActivities(undo.programId, undo.before);
              setUndo(null);
            },
          }}
        />
      )}
    </>
  );
}

/** Suggestions turned off for good, each with a way back on. */
function MutedList({ off, typeName }: { off: string[]; typeName: (k: string) => string }) {
  const { t } = useT();
  const types = mutedTypes(off);
  const all = off.includes(MUTE_ALL);
  if (!types.length && !all) return null;
  return (
    <GroupedList header={t.psgTurnedOff}>
      {all && (
        <ListRow
          label={t.psgAllOff}
          trailing={
            <Button
              variant="ghost"
              onClick={() => setProgramSuggestOff(off.filter((k) => k !== MUTE_ALL))}
            >
              {t.psgTurnOn}
            </Button>
          }
        />
      )}
      {types.map((k) => (
        <ListRow
          key={k}
          label={typeName(k)}
          trailing={
            <Button
              variant="ghost"
              onClick={() => setProgramSuggestOff(off.filter((x) => x !== k))}
            >
              {t.psgTurnOn}
            </Button>
          }
        />
      ))}
    </GroupedList>
  );
}

function AddSheet({
  s,
  typeName,
  dayName,
  days,
  onAdd,
  onClose,
}: {
  s: ProgramSuggestion;
  typeName: string;
  dayName: (d: number) => string;
  days: number[];
  onAdd: (day: number, minutes: number, effort: ActivityEffort) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [day, setDay] = useState<number>(s.weekday);
  const [minutes, setMinutes] = useState(s.minutes);
  const [effort, setEffort] = useState<ActivityEffort>('moderate');
  return (
    <Sheet onClose={onClose}>
      <div className="psg-sheet">
        <h3>{t.psgSheetTitle(typeName)}</h3>
        <div className="psg-days" role="group" aria-label={t.psgDay}>
          {days.map((d) => (
            <Chip key={d} selected={d === day} onClick={() => setDay(d)}>
              {dayName(d).slice(0, 3)}
            </Chip>
          ))}
        </div>
        <NumberStepper
          size="big"
          label={t.minShort}
          value={minutes}
          step={5}
          min={5}
          max={300}
          onChange={setMinutes}
        />
        <Segmented
          label={t.actEffort}
          value={effort}
          onChange={setEffort}
          options={EFFORTS.map((e) => ({ value: e, label: t.actEffortLevel[e] }))}
        />
        <p className="psg-note">{t.psgInfo}</p>
        <Button variant="primary" fullWidth onClick={() => onAdd(day, minutes, effort)}>
          {t.psgAddTo(dayName(day))}
        </Button>
      </div>
    </Sheet>
  );
}
