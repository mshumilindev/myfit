/**
 * The Programs screen of the athlete app: ONE page around the program editor tool (`tools/programEditor`, second host,
 * mode `self`). The page owns what is not editing: the program's name, length and status, "start from" (CSV import,
 * duplicate), save / activate / archive / delete / assign (Firestore + callable functions) and leaving. Everything
 * about the week and its days (days, exercises, sets, warm-up lists, activities, undo) is the tool.
 * The same page, read only, is the member's review of a trainer's program.
 */
import { useMemo, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { NumberStepper } from '../../components/ui/NumberStepper';
import { callFn, currentUid, getRole, getUsername, trackMutation } from '../../api';
import { db } from '../../firebase';
import { useT } from '../../i18n';
import { usePgT } from '../../i18n/coachProgram';
import type { Shell } from '../../App';
import { programToCsv, type ProgramItemLike } from '../../data/programCsv';
import { knownExercises } from '../../store';
import { ConfirmDialog, Sheet } from '../../ui';
import { ProgramCsvDialog } from '../ProgramCsvDialog';
import {
  BandField,
  BandFields,
  BandRow,
  BandText,
  type EditorFocus,
  type PageButton,
  type PageMenuItem,
} from '../../tools/programEditor';
import { useWeekStartDay, weekOrder } from '../../weekStart';
import { activitiesLocked, sealActivitiesInDoc } from './activitiesVault';
import {
  dayActivities,
  duplicateOf,
  normalizeItems,
  readiness,
  toSaved,
  trainingDays,
  type Program,
  type ProgramItem,
} from './model';
import { ActivityChips } from './ProgramActivities';
import { ToggleRow } from './pieces';
import { SelfProgramPage } from './selfEditor';

export function ProgramPage({
  initial,
  saved,
  readOnly,
  library,
  shell,
  onClose,
  onSaved,
  onDeleted,
  onAssign,
}: {
  initial: Program;
  /** Already stored in Firestore (vs a new draft). */
  saved: boolean;
  /** A program someone else wrote (e.g. my trainer's): view only. */
  readOnly?: boolean;
  /** My programs: the "Duplicate" source list. */
  library: Program[];
  shell: Shell;
  onClose: () => void;
  onSaved: (p: Program) => void;
  onDeleted: () => void;
  onAssign?: (p: Program) => void;
}) {
  const { t } = useT();
  const { p } = usePgT();
  const role = getRole();
  const [draft, setDraft] = useState<Program>(initial);
  const [isSaved, setIsSaved] = useState(saved);
  // Unsaved changes = the draft differs from what was last saved (a change typed and then undone is not dirty).
  const [savedSnap, setSavedSnap] = useState(() => (saved ? snapshot(initial) : ''));
  const [busy, setBusy] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [focus, setFocus] = useState<EditorFocus | null>(null);

  const update = (next: Program) => {
    if (readOnly) return;
    setDraft(next);
    setJustSaved(false);
  };
  const dirty = !isSaved || snapshot(draft) !== savedSnap;
  const ready = readiness(draft);
  const days = trainingDays(draft);
  const hostOptions = useMemo(
    () => ({ shell, activitiesLocked: activitiesLocked(draft) }),
    [shell, draft],
  );
  const weekDays = weekOrder(useWeekStartDay());
  const restWithActivities = weekDays.filter(
    (d) => !days.includes(d) && dayActivities(draft, d).length > 0,
  );
  const weekday = (d: number) => t.weekDayNames[d - 1] ?? '';

  // --- persistence -----------------------------------------------------------------

  async function save(status?: Program['status']): Promise<Program | null> {
    const uid = currentUid();
    if (!uid) return null;
    setBusy(true);
    setError(null);
    try {
      const doc0 = toSaved(draft, uid, t.progNew);
      await trackMutation(
        sealActivitiesInDoc(doc0).then((stored) => setDoc(doc(db, 'programs', doc0.id), stored)),
      );
      let next = doc0;
      if (status && status !== doc0.status) {
        await callFn('setProgramStatus', { id: doc0.id, status });
        next = { ...doc0, status };
      }
      setDraft({ ...next, items: normalizeItems(next.items) });
      setIsSaved(true);
      setSavedSnap(snapshot(next));
      setJustSaved(true);
      onSaved(next);
      return next;
    } catch {
      setError(t.pgSaveFailed);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: Program['status']) {
    if (dirty || !isSaved) {
      await save(status);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await callFn('setProgramStatus', { id: draft.id, status });
      const next = { ...draft, status };
      setDraft(next);
      setSavedSnap(snapshot(next));
      onSaved(next);
    } catch {
      setError(t.pgSaveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await callFn('deleteProgram', { id: draft.id });
      setConfirmDelete(false);
      onDeleted();
    } catch {
      setError(t.pgSaveFailed);
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const csv = programToCsv(
      draft.items.map((i): ProgramItemLike => ({
        day: i.day,
        position: i.position,
        name: i.name,
        kind: i.kind,
        sets: i.sets,
        reps: i.reps,
        durationMin: i.durationMin,
        equipment: i.equipment,
      })),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${draft.name.trim() || 'program'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importItems(items: ProgramItemLike[]) {
    const incoming = items.map((it) => ({ ...it, id: crypto.randomUUID() }) as ProgramItem);
    const importedDays = new Set(incoming.map((i) => i.day));
    const dayNames = { ...draft.dayNames };
    for (const d of importedDays)
      if (!dayNames[String(d)]) dayNames[String(d)] = t.weekDayNames[d - 1] ?? t.progDay(d);
    const targetMuscles = { ...draft.targetMuscles };
    for (const d of importedDays) delete targetMuscles[String(d)];
    update({
      ...draft,
      dayNames,
      targetMuscles,
      items: normalizeItems([...draft.items, ...incoming]),
    });
    setCsvOpen(false);
  }

  async function assign() {
    if (!onAssign) return;
    const p = dirty || !isSaved ? await save() : draft;
    if (p) onAssign(p);
  }

  const leave = () => (dirty && !readOnly ? setConfirmDiscard(true) : onClose());

  // --- readiness line + primary action ----------------------------------------------

  const readinessLine = ready.ok
    ? t.pgReadyAll(days.length)
    : ready.reason === 'no-days'
      ? t.pgNeedsDays
      : ready.reason === 'unnamed'
        ? t.pgNeedsName(weekday(ready.day))
        : t.pgNeedsContent(weekday(ready.day));

  const primaryAction = () => {
    if (draft.status === 'active') return void save();
    if (!ready.ok) {
      // Take the person to the day that blocks activation; with no days the editor already asks for one.
      if (ready.reason !== 'no-days') setFocus({ day: ready.day, nonce: Date.now() });
      return;
    }
    void setStatus('active');
  };
  const primaryLabel = busy
    ? t.saving
    : draft.status === 'active'
      ? t.save
      : ready.ok
        ? t.progActivate
        : ready.reason === 'no-days'
          ? t.pgPickDaysAction
          : ready.reason === 'unnamed'
            ? t.pgNeedsName(weekday(ready.day))
            : t.pgFillDay(weekday(ready.day));
  const statusLabel =
    draft.status === 'active'
      ? t.progStatusActive
      : draft.status === 'archived'
        ? t.progStatusArchived
        : t.progStatusDraft;

  // --- menu ------------------------------------------------------------------------

  const canAssign = !!onAssign && (role === 'trainer' || role === 'admin');
  const menuItems: PageMenuItem[] = [
    ...(canAssign
      ? [
          {
            id: 'assign',
            label: t.pgAssignToMembers,
            icon: 'user-focus',
            onSelect: () => void assign(),
          },
        ]
      : []),
    {
      id: 'duplicate',
      label: t.progDuplicate,
      icon: 'copy',
      onSelect: () => {
        setDraft(duplicateOf(draft, t.progDuplicateName(draft.name)));
        setIsSaved(false);
      },
    },
    {
      id: 'csv',
      label: t.csvExport,
      icon: 'download-simple',
      onSelect: exportCsv,
      disabled: draft.items.length === 0,
    },
    ...(isSaved && draft.status === 'active'
      ? [
          {
            id: 'archive',
            label: t.progArchive,
            icon: 'archive',
            onSelect: () => void setStatus('archived'),
          },
        ]
      : []),
    ...(isSaved
      ? [
          {
            id: 'delete',
            label: t.delete,
            icon: 'trash',
            onSelect: () => setConfirmDelete(true),
          },
        ]
      : []),
  ];

  // --- slots of the editor page ----------------------------------------------------

  const saveDisabled = busy || !draft.name.trim() || (draft.status === 'active' && !dirty);
  const actions: PageButton[] = readOnly
    ? []
    : [
        ...(draft.status !== 'active'
          ? [
              {
                id: 'save',
                label: t.pgSaveDraft,
                disabled: busy || !dirty,
                onClick: () => void save(),
              },
            ]
          : []),
        {
          id: 'primary',
          label: primaryLabel,
          variant: 'primary' as const,
          disabled: saveDisabled,
          onClick: primaryAction,
        },
      ];

  const state = busy ? t.saving : dirty && !readOnly ? p.edUnsaved : justSaved ? p.edSaved : '';

  const band = {
    label: p.edBandProgram,
    status: {
      label: statusLabel,
      tone: draft.status === 'active' ? ('ok' as const) : ('neutral' as const),
    },
    note: readOnly
      ? undefined
      : {
          id: 'pe-band-note',
          tone: ready.ok ? ('ok' as const) : ('illness' as const),
          icon: ready.ok ? 'check' : 'warning-circle',
          text: readinessLine,
        },
    children: (
      <AthleteBandBody
        draft={draft}
        readOnly={readOnly}
        showStartFrom={!isSaved && !readOnly}
        onChange={update}
        onImport={() => setCsvOpen(true)}
        onDuplicate={() => setDupOpen(true)}
      />
    ),
  };

  const notices = error ? (
    <Notice tone="danger" icon="warning" role="alert">
      {error}
    </Notice>
  ) : undefined;

  const footer = (
    <>
      {restWithActivities.length > 0 && (
        <GroupedList label={t.progRestShort}>
          {restWithActivities.map((d) => (
            <ListRow
              key={d}
              dense
              time={weekday(d).slice(0, 3)}
              label={t.progRestShort}
              sub={<ActivityChips list={dayActivities(draft, d)} />}
            />
          ))}
        </GroupedList>
      )}
      <BandText>{t.progNoWeightNote}</BandText>
    </>
  );

  return (
    <div className="screen pg-page">
      <SelfProgramPage
        chrome={{
          back: { label: t.progTitle, text: t.progTitle, onClick: leave },
          title: p.edTitle,
          subject: {
            name: getUsername() || draft.name || t.progNew,
            text: `${draft.name.trim() || t.progNew} · ${draft.weeks === 0 ? t.progOpenEnded : t.progWeeksCount(draft.weeks)} · ${t.progDaysCount(days.length)}`,
          },
          state,
          actions,
          menu: readOnly ? undefined : { label: p.edMoreActions, items: menuItems },
          notices,
          footer,
        }}
        band={band}
        program={draft}
        onChange={update}
        readOnly={readOnly}
        focus={focus}
        host={hostOptions}
      />

      {confirmDelete && (
        <ConfirmDialog
          danger
          title={t.deleteProgramTitle(draft.name)}
          body={t.deleteProgramBody}
          confirmLabel={t.delete}
          cancelLabel={t.keep}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void remove()}
        />
      )}
      {confirmDiscard && (
        <ConfirmDialog
          danger
          title={t.pgDiscardTitle}
          body={t.pgDiscardBody}
          confirmLabel={t.pgDiscard}
          cancelLabel={t.keep}
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={onClose}
        />
      )}
      {csvOpen && (
        <ProgramCsvDialog
          known={knownExercises().map((e) => e.name)}
          onClose={() => setCsvOpen(false)}
          onImport={importItems}
        />
      )}
      {dupOpen && (
        <Sheet onClose={() => setDupOpen(false)}>
          <div className="pg-sheet">
            <h3>{t.pgDuplicateFrom}</h3>
            <div className="pg-list">
              {library.length === 0 && <p className="pg-empty">{t.progEmpty}</p>}
              {library.map((lp) => (
                <ListRow
                  key={lp.id}
                  label={lp.name}
                  sub={`${lp.weeks === 0 ? t.progOpenEnded : t.progWeeksCount(lp.weeks)} · ${t.progDaysCount(trainingDays(lp).length)}`}
                  chevron
                  onClick={() => {
                    setDraft(duplicateOf(lp, t.progDuplicateName(lp.name)));
                    setDupOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/**
 * The athlete's content of the info band: the program's name and length, and (for a new program) "start from" CSV or a
 * copy. Exported for the Storybook host pair.
 */
export function AthleteBandBody({
  draft,
  readOnly,
  showStartFrom,
  onChange,
  onImport,
  onDuplicate,
}: {
  draft: Program;
  readOnly?: boolean;
  showStartFrom: boolean;
  onChange: (next: Program) => void;
  onImport: () => void;
  onDuplicate: () => void;
}) {
  const { t } = useT();
  return (
    <>
      <BandFields>
        <Field
          label={t.progName}
          value={draft.name}
          placeholder={t.pgNamePlaceholder}
          autoFocus={showStartFrom && !draft.name}
          readOnly={readOnly}
          maxLength={80}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
        <BandField label={draft.weeks === 0 ? t.progWeeks : undefined}>
          {draft.weeks === 0 ? (
            <BandText>∞ {t.progOpenEnded}</BandText>
          ) : (
            <NumberStepper
              size="md"
              label={t.progWeeks}
              value={draft.weeks}
              min={1}
              max={52}
              disabled={readOnly}
              onChange={(n) => onChange({ ...draft, weeks: n })}
            />
          )}
          <GroupedList>
            <ToggleRow
              label={t.progNoEndDate}
              on={draft.weeks === 0}
              disabled={readOnly}
              onToggle={() => onChange({ ...draft, weeks: draft.weeks === 0 ? 8 : 0 })}
            />
          </GroupedList>
        </BandField>
      </BandFields>
      {showStartFrom && (
        <BandRow
          title={t.pgOrStartFrom}
          trailing={
            <>
              <Button variant="secondary" size="sm" icon="upload-simple" onClick={onImport}>
                {t.csvImport}
              </Button>
              <Button variant="secondary" size="sm" icon="copy" onClick={onDuplicate}>
                {t.progDuplicate}
              </Button>
            </>
          }
        />
      )}
    </>
  );
}

export function useLibraryNames(programs: Program[]): Map<string, string> {
  return useMemo(() => new Map(programs.map((p) => [p.id, p.name])), [programs]);
}

/** Comparable form of a program's content (ignores timestamps/order noise). */
function snapshot(p: Program): string {
  return JSON.stringify({
    name: p.name.trim(),
    weeks: p.weeks,
    status: p.status,
    dayNames: Object.fromEntries(
      Object.entries(p.dayNames ?? {})
        .map(([k, v]) => [k, v.trim()] as const)
        .filter(([, v]) => v)
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
    targetMuscles: Object.fromEntries(
      Object.entries(p.targetMuscles ?? {})
        .filter(([, v]) => v.length)
        .map(([k, v]) => [k, [...v].sort()] as const)
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
    items: [...p.items]
      .filter((i) => i.name.trim())
      .sort((a, b) => a.day - b.day || a.position - b.position)
      .map((i) => [
        i.day,
        i.name.trim(),
        i.kind,
        i.sets,
        i.reps,
        i.durationMin ?? null,
        [...(i.equipment ?? [])].sort(),
        i.groupId ? `${i.groupOrder ?? 0}` : null,
        !!i.dropLast,
        i.warmupItems?.length
          ? i.warmupItems.map((w) => [w.name, w.reps ?? null, w.durationSec ?? null])
          : null,
        i.bare ?? false,
        i.targetWeight ?? null,
        i.targetRpe ?? null,
        i.restSec ?? null,
        i.note?.trim() ?? '',
      ]),
    activities: [...(p.activities ?? [])]
      .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id))
      .map((a) => [a.day, a.type, a.minutes, a.effort, a.when]),
  });
}
