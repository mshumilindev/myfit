/**
 * Program builder (design V06 "Big tiles"): mobile is four calm steps — basics,
 * week, days (rail + Prev/Next), review — and desktop one page of three columns
 * (program & week · the day · its muscle map). Saves straight to Firestore (the
 * author's own document); status changes, assign and delete go through the
 * callable functions.
 */
import { useMemo, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { callFn, currentUid, getRole, trackMutation } from '../../api';
import { db } from '../../firebase';
import { useT } from '../../i18n';
import type { Shell } from '../../App';
import { programToCsv, type ProgramItemLike } from '../../data/programCsv';
import { knownExercises } from '../../store';
import { ConfirmDialog, Icon, Sheet, useIsDesktop } from '../../ui';
import { ProgramCsvDialog } from '../ProgramCsvDialog';
import { useWeekStartDay, weekOrder } from '../../weekStart';
import { DayEditor, type DayNav } from './DayEditor';
import {
  clearDay,
  dayItems,
  dayMode,
  dayMuscles,
  dayName,
  duplicateOf,
  isDayComplete,
  isTrainingDay,
  normalizeItems,
  readiness,
  setDayName,
  toSaved,
  trainingDays,
  type Program,
  type ProgramItem,
} from './model';
import { ActionMenu, IconButton, Stepper, ToggleRow, type MenuItem } from './pieces';

export type BuilderStep = 'basics' | 'week' | 'day' | 'review';

export function ProgramBuilder({
  initial,
  saved,
  startStep,
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
  startStep: BuilderStep;
  /** A program someone else wrote (e.g. my trainer's) — view only. */
  readOnly?: boolean;
  /** My programs — the "Duplicate" source list. */
  library: Program[];
  shell: Shell;
  onClose: () => void;
  onSaved: (p: Program) => void;
  onDeleted: () => void;
  onAssign?: (p: Program) => void;
}) {
  const { t } = useT();
  const desktop = useIsDesktop();
  const role = getRole();
  const [draft, setDraft] = useState<Program>(initial);
  const [isSaved, setIsSaved] = useState(saved);
  // Unsaved changes = the draft differs from what was last saved (a change
  // typed and then undone is not dirty).
  const [savedSnap, setSavedSnap] = useState(() => (saved ? snapshot(initial) : ''));
  const [step, setStep] = useState<BuilderStep>(startStep);
  const days = trainingDays(draft);
  const [day, setDay] = useState<number>(() => trainingDays(initial)[0] ?? 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRest, setConfirmRest] = useState<number | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);

  const update = (fn: (p: Program) => Program) => {
    if (readOnly) return;
    setDraft(fn);
  };
  const dirty = !isSaved || snapshot(draft) !== savedSnap;
  const ready = readiness(draft);
  const weekDays = weekOrder(useWeekStartDay());
  const weekdayAbbr = (d: number) => (t.weekDayNames[d - 1] ?? '').slice(0, 3);

  // --- persistence -----------------------------------------------------------------

  async function save(status?: Program['status']): Promise<Program | null> {
    const uid = currentUid();
    if (!uid) return null;
    setBusy(true);
    setError(null);
    try {
      const doc0 = toSaved(draft, uid, t.progNew);
      await trackMutation(setDoc(doc(db, 'programs', doc0.id), doc0));
      let next = doc0;
      if (status && status !== doc0.status) {
        await callFn('setProgramStatus', { id: doc0.id, status });
        next = { ...doc0, status };
      }
      setDraft({ ...next, items: normalizeItems(next.items) });
      setIsSaved(true);
      setSavedSnap(snapshot(next));
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
    update((p) => {
      const incoming = items.map((it) => ({ ...it, id: crypto.randomUUID() }) as ProgramItem);
      const importedDays = new Set(incoming.map((i) => i.day));
      const dayNames = { ...p.dayNames };
      for (const d of importedDays)
        if (!dayNames[String(d)]) dayNames[String(d)] = t.weekDayNames[d - 1] ?? t.progDay(d);
      const targetMuscles = { ...p.targetMuscles };
      for (const d of importedDays) delete targetMuscles[String(d)];
      return { ...p, dayNames, targetMuscles, items: normalizeItems([...p.items, ...incoming]) };
    });
    setStep('week');
  }

  async function assign() {
    if (!onAssign) return;
    const p = dirty || !isSaved ? await save() : draft;
    if (p) onAssign(p);
  }

  const leave = () => (dirty && !readOnly ? setConfirmDiscard(true) : onClose());
  // Always there: with unsaved changes it asks first, otherwise it simply goes
  // back to the Programs home.
  const discardButton = !readOnly && (
    <IconButton
      icon="x"
      label={t.pgDiscard}
      className="pg-discard"
      onClick={() => (dirty ? setConfirmDiscard(true) : onClose())}
    />
  );

  // --- the week ---------------------------------------------------------------------

  function toggleDay(d: number) {
    if (isTrainingDay(draft, d)) {
      const hasContent =
        dayItems(draft, d).length > 0 || (draft.targetMuscles[String(d)]?.length ?? 0) > 0;
      if (hasContent) setConfirmRest(d);
      else update((p) => clearDay(p, d));
    } else {
      update((p) => setDayName(p, d, t.weekDayNames[d - 1] ?? t.progDay(d)));
    }
  }

  const daySummary = (d: number): string => {
    if (dayMode(draft, d) === 'exercises') {
      const items = dayItems(draft, d);
      const lifts = items.filter((i) => i.kind === 'strength').length;
      return t.pgExercisesN(lifts) + (items.some((i) => i.kind === 'cardio') ? t.pgPlusCardio : '');
    }
    const all = dayMuscles(draft, d);
    const ms: typeof all = all.includes('fullbody') ? ['fullbody'] : all;
    return ms.length
      ? t.pgMusclesList(ms.map((m) => t.muscleGroups[m]).join(', '))
      : t.pgPickMuscles;
  };

  const readinessLine = ready.ok
    ? t.pgReadyAll(days.length)
    : ready.reason === 'no-days'
      ? t.pgNeedsDays
      : ready.reason === 'unnamed'
        ? t.pgNeedsName(t.weekDayNames[ready.day - 1] ?? '')
        : t.pgNeedsContent(t.weekDayNames[ready.day - 1] ?? '');

  // --- menu ------------------------------------------------------------------------

  const canAssign = !!onAssign && (role === 'trainer' || role === 'admin');
  const menuItems: MenuItem[] = [
    ...(canAssign
      ? [{ label: t.pgAssignToMembers, icon: 'user-focus', onClick: () => void assign() }]
      : []),
    {
      label: t.progDuplicate,
      icon: 'copy',
      onClick: () => {
        setDraft(duplicateOf(draft, t.progDuplicateName(draft.name)));
        setIsSaved(false);
      },
    },
    {
      label: t.csvExport,
      icon: 'download-simple',
      onClick: exportCsv,
      disabled: draft.items.length === 0,
    },
    ...(isSaved && draft.status === 'active'
      ? [{ label: t.progArchive, icon: 'archive', onClick: () => void setStatus('archived') }]
      : []),
    ...(isSaved
      ? [{ label: t.delete, icon: 'trash', danger: true, onClick: () => setConfirmDelete(true) }]
      : []),
  ];

  const primaryAction = () => {
    if (draft.status === 'active') return void save();
    if (!ready.ok) {
      if (ready.reason === 'no-days') setStep('week');
      else {
        setDay(ready.day);
        setStep('day');
      }
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
            ? t.pgNeedsName(t.weekDayNames[ready.day - 1] ?? '')
            : t.pgFillDay(t.weekDayNames[ready.day - 1] ?? '');

  const statusLabel =
    draft.status === 'active'
      ? t.progStatusActive
      : draft.status === 'archived'
        ? t.progStatusArchived
        : t.progStatusDraft;

  // --- pieces ----------------------------------------------------------------------

  const basicsFields = (
    <div className="pg-basics">
      <label className="pg-field">
        <span className="pg-label">{t.progName}</span>
        <input
          className="pg-name"
          value={draft.name}
          placeholder={t.pgNamePlaceholder}
          autoFocus={!isSaved && !draft.name}
          readOnly={readOnly}
          maxLength={80}
          onChange={(e) => update((p) => ({ ...p, name: e.target.value }))}
        />
      </label>
      <div className="pg-field">
        <span className="pg-label">{t.progWeeks}</span>
        {draft.weeks === 0 ? (
          <div className="pg-ongoing">
            <b>∞</b>
            <span>{t.progOpenEnded}</span>
          </div>
        ) : (
          <Stepper
            big={!desktop}
            value={draft.weeks}
            label={desktop ? undefined : t.progWeeksWord(draft.weeks)}
            decLabel={t.pgFewer(t.progWeeks)}
            incLabel={t.pgMoreOf(t.progWeeks)}
            disabled={readOnly}
            onDec={() => update((p) => ({ ...p, weeks: Math.max(1, p.weeks - 1) }))}
            onInc={() => update((p) => ({ ...p, weeks: Math.min(52, p.weeks + 1) }))}
          />
        )}
        <ToggleRow
          label={t.progNoEndDate}
          on={draft.weeks === 0}
          disabled={readOnly}
          onToggle={() => update((p) => ({ ...p, weeks: p.weeks === 0 ? 8 : 0 }))}
        />
      </div>
    </div>
  );

  const weekTiles = (
    <div className="pg-week">
      {weekDays.map((d) => {
        const on = isTrainingDay(draft, d);
        const complete = isDayComplete(draft, d);
        return (
          <div key={d} className={`pg-wtile${on ? ' on' : ''}`}>
            <button
              type="button"
              className="pg-wtile-toggle"
              role="switch"
              aria-checked={on}
              aria-label={t.pgTrainOn(t.weekDayNames[d - 1] ?? '')}
              disabled={readOnly}
              onClick={() => toggleDay(d)}
            >
              <span className="pg-wd">{weekdayAbbr(d)}</span>
              <span className={`pg-dot${on ? ' on' : ''}${on && !complete ? ' part' : ''}`}>
                {on && <Icon name="check" />}
              </span>
            </button>
            {on ? (
              <input
                className="pg-wtile-name"
                value={draft.dayNames[String(d)] ?? ''}
                placeholder={t.pgNameThisDay}
                maxLength={40}
                readOnly={readOnly}
                aria-label={t.pgDayName(t.weekDayNames[d - 1] ?? '')}
                onChange={(e) => update((p) => setDayName(p, d, e.target.value))}
              />
            ) : (
              <span className="pg-wtile-rest">{t.progRestShort}</span>
            )}
          </div>
        );
      })}
      <div className="pg-wcount">
        <b>{days.length}</b>
        <span>{t.progDaysAWeekWord(days.length)}</span>
      </div>
    </div>
  );

  const reviewRows = (
    <div className="pg-review">
      {weekDays.map((d) =>
        isTrainingDay(draft, d) ? (
          <button
            key={d}
            type="button"
            className="pg-rrow"
            onClick={() => {
              setDay(d);
              setStep('day');
            }}
          >
            <span className="pg-wd on">{weekdayAbbr(d)}</span>
            <span className="pg-rrow-txt">
              <b>{dayName(draft, d) || t.pgUnnamed}</b>
              <small>{daySummary(d)}</small>
            </span>
            {isDayComplete(draft, d) ? (
              <Icon name="check" className="pg-ok" />
            ) : (
              <Icon name="warning-circle" className="pg-warn" />
            )}
          </button>
        ) : (
          <div key={d} className="pg-rrow rest">
            <span className="pg-wd">{weekdayAbbr(d)}</span>
            <span className="pg-rrow-txt">{t.progRestShort}</span>
          </div>
        ),
      )}
    </div>
  );

  const dayIdx = days.indexOf(day);
  const navFor = (d: number | undefined, fallback: DayNav | null): DayNav | null =>
    d === undefined
      ? fallback
      : {
          label: dayName(draft, d) || t.pgUnnamed,
          sub: weekdayAbbr(d),
          onClick: () => setDay(d),
        };
  const prevNav = navFor(
    days[dayIdx - 1],
    desktop ? null : { label: t.pgWeek, onClick: () => setStep('week') },
  );
  const nextNav = navFor(days[dayIdx + 1], { label: t.pgReview, onClick: () => setStep('review') });

  const rail = (
    <nav className="pg-rail" aria-label={t.pgTrainingDays}>
      {days.map((d) => (
        <button
          key={d}
          type="button"
          className={`pg-rp${d === day ? ' on' : ''}`}
          aria-current={d === day ? 'step' : undefined}
          onClick={() => setDay(d)}
        >
          <b>
            {weekdayAbbr(d)}
            {d !== day && isDayComplete(draft, d) && <Icon name="check" className="pg-ok" />}
          </b>
          <span>{dayName(draft, d) || t.pgUnnamed}</span>
        </button>
      ))}
    </nav>
  );

  const dayEditor = days.includes(day) ? (
    <DayEditor
      key={day}
      program={draft}
      day={day}
      readOnly={readOnly}
      update={update}
      shell={shell}
      desktop={desktop}
      rail={desktop ? undefined : rail}
      prev={prevNav}
      next={nextNav}
    />
  ) : null;

  const actions = !readOnly && (
    <div className="pg-actions">
      {draft.status !== 'active' && (
        <button
          type="button"
          className="pg-quiet"
          disabled={busy || !dirty}
          onClick={() => void save()}
        >
          {t.pgSaveDraft}
        </button>
      )}
      <button
        type="button"
        className="btn btn-primary pg-cta"
        disabled={busy || !draft.name.trim() || (draft.status === 'active' && !dirty)}
        onClick={primaryAction}
      >
        {primaryLabel}
      </button>
    </div>
  );

  const menuButton = !readOnly && (
    <div className="pg-menu-wrap">
      <IconButton
        icon="dots-three"
        label={t.pgProgramOptions}
        expanded={menu}
        onClick={() => setMenu(true)}
      />
      {menu && <ActionMenu items={menuItems} onClose={() => setMenu(false)} />}
    </div>
  );

  const dialogs = (
    <>
      {error && (
        <div className="pg-error" role="alert">
          {error}
        </div>
      )}
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
      {confirmRest !== null && (
        <ConfirmDialog
          title={t.pgRestTitle(t.weekDayNames[confirmRest - 1] ?? '')}
          body={t.pgRestBody}
          confirmLabel={t.pgMakeRest}
          cancelLabel={t.keep}
          onCancel={() => setConfirmRest(null)}
          onConfirm={() => {
            update((p) => clearDay(p, confirmRest));
            setConfirmRest(null);
          }}
        />
      )}
      {confirmDiscard && (
        <ConfirmDialog
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
              {library.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="pg-list-row"
                  onClick={() => {
                    setDraft(duplicateOf(p, t.progDuplicateName(p.name)));
                    setDupOpen(false);
                    setStep('week');
                  }}
                >
                  <b>{p.name}</b>
                  <span>
                    {p.weeks === 0 ? t.progOpenEnded : t.progWeeksCount(p.weeks)} ·{' '}
                    {t.progDaysCount(trainingDays(p).length)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Sheet>
      )}
    </>
  );

  const startFrom = !isSaved && !readOnly && (
    <div className="pg-startfrom">
      <span className="pg-label">{t.pgOrStartFrom}</span>
      <div>
        <button type="button" className="pg-tile-btn" onClick={() => setCsvOpen(true)}>
          <Icon name="upload-simple" />
          {t.csvImport}
        </button>
        <button type="button" className="pg-tile-btn" onClick={() => setDupOpen(true)}>
          <Icon name="copy" />
          {t.progDuplicate}
        </button>
      </div>
    </div>
  );

  // --- desktop: one page, three columns --------------------------------------------

  if (desktop) {
    return (
      <div className="screen pg-page pg-desk">
        <header className="pg-desk-top">
          <button type="button" className="ov-back" onClick={leave}>
            <Icon name="caret-left" />
            {t.progTitle}
          </button>
          <span className="grow" />
          {discardButton}
          {!readOnly && draft.status !== 'active' && (
            <button
              type="button"
              className="pg-quiet"
              disabled={busy || !dirty}
              onClick={() => void save()}
            >
              {t.pgSaveDraft}
            </button>
          )}
          {menuButton}
          {!readOnly && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !draft.name.trim() || (draft.status === 'active' && !dirty)}
              onClick={primaryAction}
            >
              {primaryLabel}
            </button>
          )}
        </header>
        <div className="pg-desk-grid">
          <aside className="pg-desk-left">
            <span className={`pg-status ${draft.status}`}>{statusLabel}</span>
            {basicsFields}
            <span className="pg-note">{t.progDaysCount(days.length)}</span>
            {startFrom}
            <div className="pg-label">{t.pgWeek}</div>
            <div className="pg-weeklist">
              {weekDays.map((d) => {
                const on = isTrainingDay(draft, d);
                const sel = step !== 'review' && on && d === day;
                return (
                  <div key={d} className={`pg-wrow${on ? ' on' : ''}${sel ? ' sel' : ''}`}>
                    <button
                      type="button"
                      className="pg-wrow-main"
                      disabled={!on}
                      onClick={() => {
                        setDay(d);
                        setStep('day');
                      }}
                    >
                      <span className="pg-wd">{weekdayAbbr(d)}</span>
                      <span className="n">
                        {on ? dayName(draft, d) || t.pgUnnamed : t.progRestShort}
                      </span>
                      {on && isDayComplete(draft, d) && <Icon name="check" className="pg-ok" />}
                    </button>
                    {!readOnly && (
                      <button
                        type="button"
                        className={`pg-mini-switch${on ? ' on' : ''}`}
                        role="switch"
                        aria-checked={on}
                        aria-label={t.pgTrainOn(t.weekDayNames[d - 1] ?? '')}
                        onClick={() => {
                          toggleDay(d);
                          if (!on) {
                            setDay(d);
                            setStep('day');
                          }
                        }}
                      >
                        <span />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className={`pg-wrow-review${step === 'review' ? ' sel' : ''}`}
              onClick={() => setStep('review')}
            >
              <Icon name="list-checks" />
              {t.pgReview}
              <small className={ready.ok ? 'pg-ok' : 'pg-warn'}>{readinessLine}</small>
            </button>
          </aside>
          <main className="pg-desk-main">
            {step === 'review' || !dayEditor ? (
              <div className="pg-desk-review">
                <h2 className="pg-title">{draft.name || t.progNew}</h2>
                <p className="pg-meta">
                  {draft.weeks === 0 ? t.progOpenEnded : t.progWeeksCount(draft.weeks)} ·{' '}
                  {t.progDaysCount(days.length)} · {statusLabel}
                </p>
                {reviewRows}
                <p className={ready.ok ? 'pg-ready ok' : 'pg-ready'}>
                  <Icon name={ready.ok ? 'check' : 'warning-circle'} />
                  {readinessLine}
                </p>
                <p className="pg-note">{t.progNoWeightNote}</p>
              </div>
            ) : (
              dayEditor
            )}
          </main>
        </div>
        {dialogs}
      </div>
    );
  }

  // --- mobile: steps ---------------------------------------------------------------

  const topBar = (back: () => void, title?: string, withMenu = false) => (
    <header className="pg-top">
      <IconButton icon="caret-left" label={t.backAction} onClick={back} />
      <span className="pg-top-title">{title}</span>
      {discardButton}
      {withMenu && menuButton}
    </header>
  );

  if (step === 'basics') {
    return (
      <div className="screen pg-page pg-step">
        {topBar(isSaved ? () => setStep('review') : leave, isSaved ? draft.name : t.progNew)}
        {basicsFields}
        <div className="pg-foot">
          {startFrom}
          <button
            type="button"
            className="btn btn-primary pg-cta"
            disabled={!draft.name.trim()}
            onClick={() => setStep('week')}
          >
            {t.pgNext}
          </button>
        </div>
        {dialogs}
      </div>
    );
  }

  if (step === 'week') {
    return (
      <div className="screen pg-page pg-step">
        {topBar(() => setStep('basics'), draft.name)}
        <div>
          <h2 className="pg-h1">{t.pgWeek}</h2>
          <p className="pg-note">{t.pgWeekHint}</p>
        </div>
        {weekTiles}
        <div className="pg-foot">
          <button
            type="button"
            className="btn btn-primary pg-cta"
            disabled={days.length === 0}
            onClick={() => {
              setDay(days[0]);
              setStep('day');
            }}
          >
            {t.pgSetUpDays}
          </button>
        </div>
        {dialogs}
      </div>
    );
  }

  if (step === 'day' && dayEditor) {
    return (
      <div className="screen pg-page pg-step pg-step-day">
        {topBar(() => setStep('week'), draft.name)}
        {dayEditor}
        {dialogs}
      </div>
    );
  }

  // review (also the landing screen of a saved program)
  return (
    <div className="screen pg-page pg-step">
      {topBar(isSaved ? leave : () => setStep(days.length ? 'day' : 'week'), undefined, true)}
      <button
        type="button"
        className="pg-review-head"
        disabled={readOnly}
        onClick={() => setStep('basics')}
      >
        <h2 className="pg-title">{draft.name || t.progNew}</h2>
        <span className="pg-meta">
          {draft.weeks === 0 ? t.progOpenEnded : t.progWeeksCount(draft.weeks)} ·{' '}
          {t.progDaysCount(days.length)} ·{' '}
          <em className={`pg-status ${draft.status}`}>{statusLabel}</em>
        </span>
      </button>
      {reviewRows}
      {!readOnly && (
        <button type="button" className="pg-link-btn" onClick={() => setStep('week')}>
          <Icon name="calendar-blank" />
          {t.pgEditWeek}
        </button>
      )}
      <div className="pg-foot">
        <p className={ready.ok ? 'pg-ready ok' : 'pg-ready'}>
          <Icon name={ready.ok ? 'check' : 'warning-circle'} />
          {readinessLine}
        </p>
        {actions}
      </div>
      {dialogs}
    </div>
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
      ]),
  });
}
