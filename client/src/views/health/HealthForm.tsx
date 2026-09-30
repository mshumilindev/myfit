/**
 * One grouped-list form for every Health entry (F03–F06, F09; W02/W03 panel):
 * a Type row, date rows that expand the shared range calendar, the "Still
 * ongoing" switch, a length summary, what the period does, overlap states
 * (logged workouts inside the range; other periods on the same days), and a
 * pinned Cancel / primary bar. Injuries swap the dates for body part + side,
 * the day it happened and "Healed on …" / "Still healing → rehab plan".
 */
import '../Health.css';
import { BackButton } from '../../components/ui/BackButton';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useT } from '../../i18n';
import {
  dayKey,
  deleteInjury,
  deleteRestPeriod,
  logPastInjury,
  logRestPeriod,
  updateInjury,
  updateRestPeriod,
  useStore,
  type RestOverlapChoice,
} from '../../store';
import {
  dayOfTs,
  matchingPreset,
  modeSkipsWorkouts,
  overlappingPeriods,
  presetRange,
  rangeDays,
  validateRange,
  workoutsInRange,
  type HealthFormSpec,
  type RangePreset,
} from '../../health';
import { BODY_PARTS, bodyPart as findBodyPart } from '../../injury';
import { useWeekStartDay } from '../../weekStart';
import type { IllnessKind, InjurySide, RestMode } from '../../types';
import { ILLNESS_KINDS } from '../../illness';
import { Sheet } from '../../ui';
import { Button, IconButton } from '../../components/ui/Button';
import { Calendar } from '../../components/ui/Calendar';
import { Field } from '../../components/ui/Field';
import { GroupedList, ListPanel, ListRow } from '../../components/ui/GroupedList';
import { PresetChips } from '../../components/ui/PresetChips';
import { Segmented } from '../../components/ui/Segmented';
import { Notice } from '../../components/ui/Notice';
import { StickyActionBar } from '../../components/ui/StickyActionBar';
import { Switch } from '../../components/ui/Switch';
import type { Tone as KitTone } from '../../components/ui/tones';
import {
  Ic,
  KIT_TONE,
  fmtDay,
  fmtDM,
  fmtRange,
  fmtRangeList,
  iconOf,
  injuryLabel,
  periodLabel,
  illnessKindName,
  ILLNESS_KIND_ICON,
  toneOf,
  typeName,
  type HealthType,
} from './parts';

const PAST_PRESETS: RangePreset[] = ['today', 'yesterday', 'last3', 'thisWeek', 'lastWeek'];
const START_PRESETS: RangePreset[] = [
  'today',
  'next7',
  'thisWeek',
  'nextWeek',
  'tenDays',
  'twoWeeks',
];

/** A quick pick over the calendar (Today, Last 3 days, Next week …). */
interface CalPreset {
  id: string;
  label: string;
  on: boolean;
  pick: () => void;
}

/** A logged workout on a day: one gold marker. */
const GOLD_DOT: readonly KitTone[] = ['accent'];

export interface RehabPrefill {
  bodyPart: string;
  side: InjurySide;
  startDay: number;
}

type Expand = 'start' | 'end' | 'type' | null;

export function HealthForm(props: {
  spec: HealthFormSpec;
  now: number;
  web: boolean;
  onCancel: () => void;
  onDone: () => void;
  /** "Still healing → Continue to rehab plan": the existing Injury & Rehab flow. */
  onRehab: (p: RehabPrefill) => void;
  /** `sheet`: the edit form hosted in a drawer (History rows); default is the page. */
  presentation?: 'page' | 'sheet';
}) {
  const { t, locale } = useT();
  const store = useStore();
  const weekStart = useWeekStartDay();
  const { spec, now } = props;
  const today = dayKey(now);

  const editing =
    spec.kind === 'edit' ? store.restPeriods.find((p) => p.id === spec.periodId) : null;
  const editingInj =
    spec.kind === 'edit-injury' ? store.injuries.find((i) => i.id === spec.injuryId) : null;
  const ctx: 'start' | 'past' | 'edit' = spec.kind === 'new' ? spec.ctx : 'edit';

  const [init] = useState(() => initialState(spec, editing ?? null, editingInj ?? null, today));
  const [type, setType] = useState<HealthType>(init.type);
  const [name, setName] = useState(init.name);
  const [kind, setKind] = useState<IllnessKind>(init.kind);
  // "How long" (illness): the calendar only opens for "Earlier day".
  const [dur, setDur] = useState<'today' | 'open' | 'earlier'>(() =>
    init.start < today ? 'earlier' : init.open ? 'open' : 'today',
  );
  const [start, setStart] = useState(init.start);
  const [end, setEnd] = useState(init.end);
  const [open, setOpen] = useState(init.open);
  const [expand, setExpand] = useState<Expand>(init.expand);
  const [removeIds, setRemoveIds] = useState<Set<string>>(() => new Set());
  const [choice, setChoice] = useState<RestOverlapChoice | null>(null);
  const [part, setPart] = useState<string | null>(init.part);
  const [partOpen, setPartOpen] = useState(init.part === null);
  const [dateOpen, setDateOpen] = useState(spec.kind === 'new');
  const [side, setSide] = useState<InjurySide>(init.side);
  const [healed, setHealed] = useState(init.healed);
  const [healedDay, setHealedDay] = useState(init.healedDay);
  const [healedOpen, setHealedOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const isInjury = type === 'injury';
  const tone = toneOf(type);
  const mode: RestMode = isInjury ? 'off' : type;
  // Only full rest / active recovery can be planned ahead (not illness, injury).
  const allowFuture = ctx !== 'past' && (type === 'off' || type === 'active');
  const range = { startDay: start, endDay: open ? Math.max(start, end) : end, open };
  const endEff = open ? Math.max(today, start) : end;
  const days = rangeDays(range, today);

  const workoutDays = useMemo(() => {
    const s = new Set<number>();
    for (const w of store.workouts) if (w.finishedAt !== null) s.add(dayOfTs(w.startedAt));
    return s;
  }, [store.workouts]);

  // --- overlaps ---------------------------------------------------------------
  const inRange =
    isInjury || !modeSkipsWorkouts(mode) ? [] : workoutsInRange(range, store.workouts, today);
  const keptDays = new Set(
    inRange.filter((w) => !removeIds.has(w.id)).map((w) => dayOfTs(w.startedAt)),
  );
  const others = isInjury
    ? []
    : overlappingPeriods(range, store.restPeriods, editing?.id ?? null, { mode, today });
  const canMerge = others.length > 0 && others.every((o) => o.mode === mode);
  const effChoice = choice === 'merge' && !canMerge ? null : choice;

  // --- validation -------------------------------------------------------------
  let err: string | null = null;
  if (isInjury) {
    if (start > today || (healed && healedDay > today)) err = 'future';
    else if (healed && healedDay < start) err = 'healed-before-start';
  } else {
    err = validateRange(range, { today, allowFuture });
  }
  // Editing: "Save changes" waits until something actually changed.
  const dirty =
    type !== init.type ||
    name.trim() !== init.name.trim() ||
    (type === 'illness' && kind !== init.kind) ||
    start !== init.start ||
    open !== init.open ||
    (!open && end !== init.end) ||
    part !== init.part ||
    side !== init.side ||
    healed !== init.healed ||
    (healed && healedDay !== init.healedDay) ||
    removeIds.size > 0 ||
    choice !== null;
  const blocked = !!err || (isInjury && !part) || (others.length > 0 && !effChoice);

  // --- type options -----------------------------------------------------------
  const typeOptions: HealthType[] =
    spec.kind === 'edit'
      ? ['off', 'active', 'illness']
      : spec.kind === 'edit-injury'
        ? []
        : ['off', 'active', 'illness', 'injury'];

  const pickType = (next: HealthType) => {
    setType(next);
    setExpand(null);
    setChoice(null);
    if (next === 'injury') {
      setOpen(false);
      setDateOpen(true);
    } else if (next !== 'illness' && ctx === 'start' && open && start > today) {
      setOpen(false);
    }
  };

  // --- dates ------------------------------------------------------------------
  const presetIds = allowFuture ? START_PRESETS : PAST_PRESETS;
  const pctx = { today, weekStart, start };
  const onPreset = matchingPreset(presetIds, { startDay: start, endDay: open ? today : end }, pctx);
  const presets: CalPreset[] = presetIds.map((id) => ({
    id,
    label: t.hlPreset[id],
    on: onPreset === id,
    pick: () => {
      const r = presetRange(id, pctx);
      setStart(r.startDay);
      if (!open) setEnd(r.endDay);
    },
  }));
  const pickDay = (d: number) => {
    if (expand === 'end' && !open) {
      if (d < start) {
        setStart(d);
        setEnd(d);
      } else setEnd(d);
      return;
    }
    setStart(d);
    if (!open && end < d) setEnd(d);
  };
  const toggleOpen = (on: boolean) => {
    setOpen(on);
    if (on) {
      if (start > today) setStart(today);
      setEnd(Math.max(start > today ? today : start, today));
      if (expand === 'end') setExpand('start');
    } else if (end < start) setEnd(start);
  };

  // --- labels -------------------------------------------------------------------
  const fd = (d: number) => fmtDay(d, locale, today);
  const past = ctx === 'past' || (ctx === 'edit' && endEff < today && !open);
  const startLbl = ctx === 'start' ? t.hlStarts : t.hlStarted;
  const endLbl = ctx === 'start' ? t.hlEnds : past ? t.hlEnded : t.hlEnds;
  const typeLbl = typeName(type, t);
  const pickUp = fd(endEff + 1);
  let lenNote: string;
  if (open) lenNote = t.hlLenOngoing(today - start + 1);
  else if (ctx === 'edit' && expand === null) lenNote = t.hlLenEdit(days);
  else if (start > today) lenNote = t.hlLenFuture(days, start - today, pickUp);
  else if (start === today) lenNote = t.hlLenCurrent(days, pickUp);
  else if (endEff >= today) lenNote = t.hlLenRunning(days, today - start + 1, pickUp);
  else lenNote = `${t.hlLenPast(days)} ${t.hlGoldDot}`;

  const title =
    spec.kind === 'edit'
      ? t.hlEditPeriod
      : spec.kind === 'edit-injury'
        ? t.hlEditInjury
        : isInjury
          ? t.hlGotHurt
          : ctx === 'past'
            ? type === 'illness'
              ? t.hlWasUnwell
              : t.hlTookBreak
            : type === 'off'
              ? t.hlFullRest
              : typeLbl;

  // --- save ---------------------------------------------------------------------
  const injName = part
    ? injuryLabel(
        {
          id: '',
          reason: 'injury',
          bodyPart: part,
          side,
          muscles: [],
          stage: 'protect',
          startDay: start,
          createdAt: 0,
          checkins: [],
        },
        t,
      )
    : t.hlFilter.injury;

  const save = () => {
    setSaveErr(null);
    if (blocked) return;
    if (isInjury) {
      if (!part) return;
      if (spec.kind === 'edit-injury') {
        const r = updateInjury(
          spec.injuryId,
          { bodyPart: part, side, startDay: start, healedDay: healed ? healedDay : null },
          now,
        );
        if (!r.ok) return setSaveErr(r.reason);
        return props.onDone();
      }
      if (healed) {
        const r = logPastInjury({ bodyPart: part, side, startDay: start, healedDay }, now);
        if (!r.ok) return setSaveErr(r.reason);
        return props.onDone();
      }
      return props.onRehab({ bodyPart: part, side, startDay: start });
    }
    const input = {
      mode,
      startDay: start,
      endDay: open ? Math.max(start, today) : end,
      open,
      name,
      illnessKind: type === 'illness' ? kind : undefined,
      overlap: effChoice ?? undefined,
      removeWorkoutIds: inRange.filter((w) => removeIds.has(w.id)).map((w) => w.id),
      allowFuture,
    };
    const r = editing ? updateRestPeriod(editing.id, input, now) : logRestPeriod(input, now);
    if (!r.ok) return setSaveErr(r.reason);
    props.onDone();
  };

  let primary: string;
  if (ctx === 'edit') primary = t.hlSaveChanges;
  else if (isInjury) primary = healed ? t.hlSaveInjury : t.hlContinueRehab;
  else if (ctx === 'past') primary = type === 'illness' ? t.hlSaveIllness : t.hlSaveBreak;
  else if (type === 'illness')
    primary = start === today ? t.restStartIllness : t.hlStartFrom(fd(start));
  else primary = start > today ? t.hlSchedule(type) : t.hlStartMode(type);

  const doDelete = () => {
    if (editing) deleteRestPeriod(editing.id);
    if (editingInj) deleteInjury(editingInj.id);
    props.onDone();
  };

  // --- groups -------------------------------------------------------------------
  const kt = KIT_TONE[tone];
  const typeRow = (
    <ListRow
      icon={<Ic tone={tone} name={iconOf(type)} />}
      label={t.hlType}
      value={typeLbl}
      valueTone={kt}
      valueStrong
      chevron={typeOptions.length > 0}
      aria-expanded={typeOptions.length > 0 ? expand === 'type' : undefined}
      onClick={
        typeOptions.length > 0 ? () => setExpand(expand === 'type' ? null : 'type') : undefined
      }
    />
  );
  // The type dropdown is a drawer: the options are choices of their own, never
  // more rows of the form.
  const typeChoices =
    expand === 'type' ? (
      <Sheet onClose={() => setExpand(null)}>
        <div className="hl hl-drawer">
          <h1 className="hl-pt">{t.hlType}</h1>
          <GroupedList surface="raised" label={t.hlType}>
            {typeOptions.map((o) => (
              <ListRow
                key={o}
                icon={<Ic tone={toneOf(o)} name={iconOf(o)} />}
                label={typeName(o, t)}
                aria-pressed={o === type}
                check={o === type}
                checkTone={KIT_TONE[toneOf(o)]}
                onClick={() => pickType(o)}
              />
            ))}
          </GroupedList>
        </div>
      </Sheet>
    ) : null;

  const periodGroup = (
    <GroupedList header={t.hlPeriod}>
      {typeRow}
      {typeChoices}
      <ListRow label={t.hlName} labelFixed>
        <Field
          bare
          aria-label={t.hlName}
          type="text"
          value={name}
          maxLength={60}
          placeholder={
            type === 'illness'
              ? kind === 'other'
                ? t.hlNamePhIll
                : illnessKindName(kind, t)
              : t.hlNamePhRest
          }
          onChange={(e) => setName(e.target.value)}
        />
      </ListRow>
    </GroupedList>
  );

  // "What is it": the illness kind. Leaving the name empty falls back to it, and
  // a name the user typed is never touched when the kind changes.
  const kindGroup =
    type === 'illness' ? (
      <GroupedList surface="flat" header={t.illKindHeader}>
        <Segmented
          variant="buttons"
          stacked
          tone="illness"
          label={t.illKindHeader}
          value={kind}
          onChange={setKind}
          options={ILLNESS_KINDS.map((k) => ({
            value: k,
            label: illnessKindName(k, t),
            icon: ILLNESS_KIND_ICON[k],
          }))}
        />
        <Notice tone="illness" icon={kind === 'mental' ? 'brain' : 'thermometer-simple'}>
          {kind === 'mental' ? (
            <>
              <b>{t.illMentalLead}</b> {t.illMentalBody}
            </>
          ) : kind === 'cold' ? (
            t.illHintCold
          ) : kind === 'virus' ? (
            t.illHintVirus
          ) : kind === 'stomach' ? (
            t.illHintStomach
          ) : (
            t.illKindFoot
          )}
        </Notice>
      </GroupedList>
    ) : null;

  /** Accessible day label: "Sat 12 Sep", + ongoing / workout notes. */
  const dayLabel = (d: number) => {
    let label = fd(d);
    const inSel = d >= start && d <= endEff;
    if (open && inSel && d === endEff && d !== start) label = t.hlDayOngoing(label);
    if (inSel && keptDays.has(d)) return t.hlDayWorkoutKept(label);
    if (workoutDays.has(d)) return t.hlDayWorkout(label);
    return label;
  };
  const workoutMarks = (d: number) => (workoutDays.has(d) ? GOLD_DOT : undefined);
  const presetChips = (
    <PresetChips
      tone={kt}
      items={presets.map((p) => ({ id: p.id, label: p.label, selected: p.on, onClick: p.pick }))}
    />
  );

  const calendar = (target: 'start' | 'end') => (
    <ListPanel>
      <Calendar
        key={`${target}-${type}`}
        mode="range"
        tone={kt}
        weekStart={weekStart}
        today={today}
        range={{ start, end: open ? Math.max(today, start) : end, open }}
        initialDay={target === 'end' && !open ? end : start}
        max={open || !allowFuture ? today : undefined}
        markers={workoutMarks}
        isSkipped={(d) => keptDays.has(d)}
        dayLabel={dayLabel}
        presets={presetChips}
        onSelect={pickDay}
        months={props.web ? 2 : 1}
      />
    </ListPanel>
  );

  const pickDur = (next: 'today' | 'open' | 'earlier') => {
    setDur(next);
    setChoice(null);
    if (next === 'today') {
      setStart(today);
      setEnd(today);
      setOpen(false);
      setExpand(null);
    } else if (next === 'open') {
      setStart(today);
      setEnd(today);
      setOpen(true);
      setExpand(null);
    } else {
      if (start >= today) {
        setStart(today - 1);
        if (!open) setEnd(today - 1);
      }
      setExpand('start');
    }
  };
  const byDuration = type === 'illness';
  const showDateRows = !byDuration || dur === 'earlier';

  const datesFoot = err
    ? err === 'future' && type === 'illness'
      ? t.hlIllNoFuture
      : t.hlErr[err]
    : byDuration && dur === 'open'
      ? t.illnessNoEnd
      : lenNote;
  // Illness: "How long" is its own block (tabs), the date rows a second one that
  // only appears for "Earlier day".
  const durGroup = byDuration ? (
    <GroupedList
      surface="flat"
      header={t.illnessDur}
      footer={showDateRows ? undefined : datesFoot}
      footerError={!showDateRows && !!err}
      notes={ctx === 'start' && !err && !showDateRows ? [t.hlIllNoFuture] : undefined}
    >
      <Segmented
        variant="track"
        tone="illness"
        label={t.illnessDur}
        value={dur}
        onChange={pickDur}
        options={[
          { value: 'today', label: t.illnessDurToday },
          { value: 'open', label: t.illDurOpenShort },
          { value: 'earlier', label: t.illDurEarlier },
        ]}
      />
    </GroupedList>
  ) : null;

  const datesGroup = !showDateRows ? null : (
    <GroupedList
      header={t.hlDates}
      footer={datesFoot}
      footerError={!!err}
      notes={type === 'illness' && ctx === 'start' && !err ? [t.hlIllNoFuture] : undefined}
    >
      <ListRow
        label={startLbl}
        value={fd(start)}
        valueTone={expand === 'start' ? kt : undefined}
        valueStrong={expand === 'start'}
        aria-expanded={expand === 'start'}
        onClick={() => setExpand(expand === 'start' ? null : 'start')}
      />
      {expand === 'start' && calendar('start')}
      {open ? (
        <ListRow
          label={t.hlEnds}
          value={type === 'illness' ? t.hlEndsWhenRecovered : t.hlEndsWhenEnded}
        />
      ) : (
        <ListRow
          label={endLbl}
          value={fd(end)}
          valueTone={expand === 'end' ? kt : undefined}
          valueStrong={expand === 'end'}
          aria-expanded={expand === 'end'}
          onClick={() => setExpand(expand === 'end' ? null : 'end')}
        />
      )}
      {expand === 'end' && !open && calendar('end')}
      <ListRow
        as="label"
        label={t.hlStillOngoing}
        sub={
          !open && (end > today || start > today)
            ? t.hlOngoingBlocked
            : ctx === 'start' || open
              ? type === 'illness'
                ? t.hlOngoingSubIll
                : t.hlOngoingSubRest
              : undefined
        }
        trailing={
          <Switch
            checked={open}
            onChange={toggleOpen}
            tone={kt}
            // A period can't be "still ongoing" while its dates are still ahead.
            disabled={!open && (end > today || start > today)}
          />
        }
      />
    </GroupedList>
  );

  const doesGroup =
    ctx === 'start' && !isInjury ? (
      <GroupedList header={t.hlWhatItDoes}>
        <ListRow icon={<Ic tone="neu" name="shield" />} label={t.hlStreak} value={t.hlProtected} />
        <ListRow
          icon={<Ic tone="neu" name="pause" />}
          label={t.hlProgram}
          value={type === 'active' ? t.hlLighter : t.hlPaused}
        />
        <ListRow
          icon={<Ic tone="neu" name={type === 'active' ? 'bell' : 'bellOff'} />}
          label={t.hlReminders}
          value={type === 'active' ? t.hlOn : t.hlOff}
        />
      </GroupedList>
    ) : null;

  // Workouts inside the range (F04 new, F09 edit compact).
  const wLabel = (w: (typeof inRange)[number]) => w.dayName || t.laWorkoutLive;
  const wMin = (w: (typeof inRange)[number]) =>
    Math.max(1, Math.round(((w.finishedAt ?? w.startedAt) - w.startedAt) / 60000));
  const keptList = (): string => {
    const segs: [number, number][] = [];
    for (let d = start; d <= endEff; d++) {
      if (keptDays.has(d)) continue;
      const last = segs[segs.length - 1];
      if (last && last[1] === d - 1) last[1] = d;
      else segs.push([d, d]);
    }
    return fmtRangeList(segs, locale, today);
  };
  const workoutDaysLbl = [...new Set(inRange.map((w) => dayOfTs(w.startedAt)))]
    .map((d) => fmtDM(d, locale, today))
    .join(', ');
  const allRemoved = inRange.length > 0 && inRange.every((w) => removeIds.has(w.id));
  const overlapGroup =
    inRange.length > 0 ? (
      <GroupedList
        header={t.hlOverlapN(inRange.length)}
        footer={
          ctx !== 'edit'
            ? allRemoved
              ? t.hlRemoveFoot(inRange.length)
              : t.hlKeepFoot(typeLbl, keptList())
            : undefined
        }
      >
        {ctx === 'edit'
          ? inRange.map((w) => {
              const gone = removeIds.has(w.id);
              return (
                <ListRow
                  key={w.id}
                  icon={<Ic tone="gym" name="dumbbell" />}
                  label={`${fd(dayOfTs(w.startedAt))} · ${wLabel(w)}`}
                  sub={
                    gone
                      ? t.hlRemoveSub(mode, fmtDM(dayOfTs(w.startedAt), locale, today))
                      : t.hlSkipsThisDay(mode)
                  }
                  value={gone ? t.hlRemovedVal : t.hlKept}
                  chevron
                  aria-pressed={!gone}
                  onClick={() =>
                    setRemoveIds((s) => {
                      const n = new Set(s);
                      if (n.has(w.id)) n.delete(w.id);
                      else n.add(w.id);
                      return n;
                    })
                  }
                />
              );
            })
          : [
              ...inRange.map((w) => (
                <ListRow
                  key={w.id}
                  icon={<Ic tone="gym" name="dumbbell" />}
                  label={t.hlTrainedOn(fd(dayOfTs(w.startedAt)))}
                  sub={t.hlWorkoutMeta(wLabel(w), wMin(w))}
                />
              )),
              <ListRow
                key="keep"
                label={t.hlKeepSession(inRange.length)}
                sub={t.hlSkips(mode, workoutDaysLbl)}
                check={removeIds.size === 0}
                checkTone={kt}
                aria-pressed={removeIds.size === 0}
                onClick={() => setRemoveIds(new Set())}
              />,
              <ListRow
                key="remove"
                label={t.hlRemoveSession(inRange.length)}
                sub={t.hlRemoveSub(mode, workoutDaysLbl)}
                check={allRemoved}
                checkTone={kt}
                aria-pressed={allRemoved}
                onClick={() => setRemoveIds(new Set(inRange.map((w) => w.id)))}
              />,
            ]}
      </GroupedList>
    ) : null;

  const conflictGroup =
    others.length > 0 ? (
      <GroupedList
        header={t.hlConflict(others.map((o) => periodLabel(o, t)).join(', '))}
        footer={t.hlConflictFoot}
      >
        {others.map((o) => (
          <ListRow
            key={o.id}
            icon={<Ic tone={toneOf(o.mode)} name={iconOf(o.mode)} />}
            label={periodLabel(o, t)}
            sub={t.hlConflictSub(
              fmtRange(o.startDay, o.open ? Math.max(today, o.startDay) : o.endDay, locale, today),
            )}
          />
        ))}
        {canMerge && (
          <ListRow
            label={t.hlMerge}
            sub={t.hlMergeSub(
              fmtRange(
                Math.min(start, ...others.map((o) => o.startDay)),
                Math.max(endEff, ...others.map((o) => (o.open ? today : o.endDay))),
                locale,
                today,
              ),
            )}
            check={effChoice === 'merge'}
            checkTone={kt}
            aria-pressed={effChoice === 'merge'}
            onClick={() => setChoice('merge')}
          />
        )}
        <ListRow
          label={t.hlReplace}
          sub={t.hlReplaceSub}
          check={effChoice === 'replace'}
          checkTone={kt}
          aria-pressed={effChoice === 'replace'}
          onClick={() => setChoice('replace')}
        />
      </GroupedList>
    ) : null;

  // --- injury groups (F06) ------------------------------------------------------
  const injPresets: CalPreset[] = (
    [
      ['today', today],
      ['yesterday', today - 1],
      ['twoDaysAgo', today - 2],
      ['weekAgo', today - 7],
    ] as const
  ).map(([id, d]) => ({
    id,
    label: t.hlPreset[id],
    on: start === d,
    pick: () => setStart(d),
  }));
  const whereGroup = (
    <GroupedList header={t.hlWhere}>
      {typeRow}
      {typeChoices}
      <ListRow
        label={t.hlBodyPart}
        value={part ? (t.injBodyParts[part] ?? part) : '—'}
        valueTone={part ? 'injury' : undefined}
        valueStrong={!!part}
        aria-expanded={partOpen}
        onClick={() => setPartOpen(!partOpen)}
      />
      {partOpen && (
        <ListPanel>
          <PresetChips
            tone="injury"
            label={t.hlBodyPart}
            items={BODY_PARTS.map((b) => ({
              id: b.id,
              label: t.injBodyParts[b.id] ?? b.id,
              selected: part === b.id,
              onClick: () => setPart(b.id),
            }))}
          />
        </ListPanel>
      )}
      <ListRow
        label={t.hlSide}
        trailing={
          <Segmented
            className="hl-side"
            size="sm"
            label={t.hlSide}
            value={side}
            onChange={setSide}
            options={(['left', 'right', 'both'] as const).map((s) => ({
              value: s,
              label: t.injSide[s],
            }))}
          />
        }
      />
    </GroupedList>
  );
  const whenGroup = (
    <GroupedList header={t.hlWhenHappened}>
      <ListRow
        label={t.hlHappenedOn}
        value={fd(start)}
        valueTone={dateOpen ? 'injury' : undefined}
        valueStrong={dateOpen}
        aria-expanded={dateOpen}
        onClick={() => setDateOpen(!dateOpen)}
      />
      {dateOpen && (
        <ListPanel>
          <Calendar
            mode="single"
            tone="injury"
            weekStart={weekStart}
            today={today}
            value={start}
            max={today}
            dayLabel={fd}
            presets={
              <PresetChips
                tone="injury"
                items={injPresets.map((p) => ({
                  id: p.id,
                  label: p.label,
                  selected: p.on,
                  onClick: p.pick,
                }))}
              />
            }
            onSelect={(d) => setStart(d)}
            months={props.web ? 2 : 1}
          />
        </ListPanel>
      )}
    </GroupedList>
  );
  const howGroup = (
    <GroupedList
      header={t.hlHowNow}
      footerError={!!err}
      footer={
        err
          ? t.hlErr[err]
          : healed
            ? t.hlInjFootHealed(injName, fmtRange(start, healedDay, locale, today))
            : t.hlInjFootHealing(injName, fd(start))
      }
    >
      <ListRow
        label={t.hlHealed}
        sub={t.hlHealedSub}
        value={healed ? `${t.hlHealedOn} ${fd(healedDay)}` : t.hlHealedOnDots}
        valueTone={healed ? 'injury' : undefined}
        valueStrong={healed}
        check={healed}
        checkTone="injury"
        aria-pressed={healed}
        onClick={() => {
          if (!healed) {
            setHealed(true);
            setHealedOpen(true);
            if (healedDay < start) setHealedDay(Math.min(today, Math.max(start, healedDay)));
          } else setHealedOpen(!healedOpen);
        }}
      />
      {healed && healedOpen && (
        <ListPanel>
          <Calendar
            mode="single"
            tone="injury"
            weekStart={weekStart}
            today={today}
            value={healedDay}
            min={start}
            max={today}
            dayLabel={fd}
            onSelect={(d) => setHealedDay(d)}
          />
        </ListPanel>
      )}
      <ListRow
        label={t.hlStillHealing}
        sub={t.hlStillHealingSub}
        check={!healed}
        checkTone="injury"
        aria-pressed={!healed}
        onClick={() => {
          setHealed(false);
          setHealedOpen(false);
        }}
      />
      {!healed && spec.kind === 'new' && (
        <ListRow
          label={t.hlRehabPlan}
          sub={t.hlRehabPlanSub}
          chevron
          disabled={blocked}
          onClick={save}
        />
      )}
    </GroupedList>
  );

  // --- delete (F09) ---------------------------------------------------------------
  const delName = editing ? periodLabel(editing, t) : editingInj ? injuryLabel(editingInj, t) : '';
  const delRange = editing
    ? fmtRange(
        editing.startDay,
        editing.open ? Math.max(today, editing.startDay) : editing.endDay,
        locale,
        today,
      )
    : '';
  const delDays = editing ? rangeDays(editing, today) : 0;
  const delWorkouts = editing ? workoutsInRange(editing, store.workouts, today) : [];
  const deleteGroup =
    editing || editingInj ? (
      <GroupedList>
        <ListRow
          action
          tone="danger"
          label={editing ? t.hlDeletePeriod : t.hlDeleteInjury}
          aria-expanded={delOpen}
          onClick={() => setDelOpen(!delOpen)}
        />
        {delOpen && (
          <ListPanel className="hl-cexp">
            <p>
              {editingInj
                ? t.hlDeleteInjuryBody(delName)
                : delWorkouts.length > 0 && modeSkipsWorkouts(editing!.mode)
                  ? t.hlDeleteBodyKept(
                      delName,
                      delRange,
                      delDays,
                      fmtDM(dayOfTs(delWorkouts[0].startedAt), locale, today),
                    )
                  : t.hlDeleteBody(delName, delRange, delDays)}
            </p>
            <div className="row2">
              <Button variant="secondary" fullWidth onClick={() => setDelOpen(false)}>
                {t.hlKeepIt}
              </Button>
              <Button variant="danger" fullWidth onClick={doDelete}>
                {t.delete}
              </Button>
            </div>
          </ListPanel>
        )}
      </GroupedList>
    ) : null;

  const saveError = saveErr ? (
    <p className="hl-note err" role="alert">
      {saveErr === 'overlap' || saveErr === 'merge-mode'
        ? t.hlConflictFoot
        : (t.hlErr[saveErr] ?? '')}
    </p>
  ) : null;

  const bar = (
    <StickyActionBar
      variant={props.web ? 'panel' : 'page'}
      surface={props.web || props.presentation === 'sheet' ? 'surface' : 'bg'}
    >
      <Button variant="secondary" fullWidth onClick={props.onCancel}>
        {t.cancel}
      </Button>
      <Button
        variant="primary"
        fullWidth
        disabled={blocked || (ctx === 'edit' && !dirty)}
        onClick={save}
      >
        {primary}
      </Button>
    </StickyActionBar>
  );

  // Mobile order follows F03–F06/F09; web splits into dates | period + overlap.
  const left: ReactNode[] = isInjury
    ? [whereGroup, whenGroup]
    : [periodGroup, kindGroup, durGroup, datesGroup];
  const right: ReactNode[] = isInjury
    ? [howGroup, deleteGroup, saveError]
    : [doesGroup, overlapGroup, conflictGroup, deleteGroup, saveError];

  if (props.web) {
    const sub =
      spec.kind === 'new'
        ? (t.hlPanelSub[
            `${ctx}-${isInjury ? 'injury' : type === 'illness' ? 'illness' : 'rest'}`
          ] ?? '')
        : editing
          ? `${periodLabel(editing, t)} · ${typeName(editing.mode, t)} · ${delRange}`
          : editingInj
            ? injuryLabel(editingInj, t)
            : '';
    return (
      <section className="hl-panel" role="dialog" aria-labelledby="hl-p-t">
        <div className="hl-phead">
          <Ic tone={tone} name={iconOf(type)} />
          <div className="t">
            <b id="hl-p-t">{title}</b>
            <span>{sub}</span>
          </div>
          <IconButton icon="x" label={t.close} onClick={props.onCancel} />
        </div>
        <div className="hl-pcols">
          <div className="hl-pcol">{withKeys(left)}</div>
          <div className="hl-pcol">{withKeys(right)}</div>
        </div>
        {bar}
      </section>
    );
  }
  const mobileOrder: ReactNode[] = isInjury
    ? [whereGroup, whenGroup, howGroup, deleteGroup, saveError]
    : [
        periodGroup,
        kindGroup,
        durGroup,
        datesGroup,
        doesGroup,
        overlapGroup,
        conflictGroup,
        deleteGroup,
        saveError,
      ];
  if (props.presentation === 'sheet') {
    return (
      <Sheet onClose={props.onCancel} tone={kt}>
        <div className="hl hl-drawer">
          <h1 className="hl-pt">{title}</h1>
          <div className="hl-scroll">
            <div className="hl-cnt">{withKeys(mobileOrder)}</div>
          </div>
          {bar}
        </div>
      </Sheet>
    );
  }
  return (
    <div className="screen hl">
      <div className="hl-pbar">
        <BackButton label={t.backAction} onClick={props.onCancel} />
        <h1 className="hl-pt">{title}</h1>
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">{withKeys(mobileOrder)}</div>
      </div>
      {bar}
    </div>
  );
}

function withKeys(nodes: ReactNode[]): ReactNode[] {
  return nodes
    .filter((n) => n !== null && n !== undefined && n !== false)
    .map((n, i) => <Fragment key={i}>{n}</Fragment>);
}

interface Init {
  type: HealthType;
  name: string;
  start: number;
  end: number;
  open: boolean;
  expand: Expand;
  part: string | null;
  side: InjurySide;
  healed: boolean;
  healedDay: number;
  kind: IllnessKind;
}

function initialState(
  spec: HealthFormSpec,
  period: import('../../types').RestPeriod | null,
  inj: import('../../types').Injury | null,
  today: number,
): Init {
  const base: Init = {
    type: 'off',
    name: '',
    start: today,
    end: today,
    open: false,
    expand: null,
    part: null,
    side: 'left',
    healed: false,
    healedDay: today,
    kind: 'cold',
  };
  if (spec.kind === 'edit' && period) {
    return {
      ...base,
      type: period.mode,
      name: period.name ?? '',
      kind: period.illnessKind ?? 'other',
      start: period.startDay,
      end: period.open ? Math.max(today, period.startDay) : period.endDay,
      open: period.open === true,
    };
  }
  if (spec.kind === 'edit-injury' && inj) {
    return {
      ...base,
      type: 'injury',
      start: inj.startDay,
      part: inj.bodyPart && findBodyPart(inj.bodyPart) ? inj.bodyPart : null,
      side: inj.side ?? 'left',
      healed: inj.healedDay != null,
      healedDay: inj.healedDay ?? today,
    };
  }
  if (spec.kind !== 'new') return base;
  if (spec.type === 'injury') return { ...base, type: 'injury' };
  if (spec.ctx === 'start') {
    if (spec.type === 'illness') return { ...base, type: 'illness', expand: null };
    return { ...base, type: spec.type, end: today + 6, expand: 'end' };
  }
  return { ...base, type: spec.type, start: today - 1, end: today - 1, expand: 'start' };
}
