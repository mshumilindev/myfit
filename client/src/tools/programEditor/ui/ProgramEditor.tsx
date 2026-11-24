import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, IconButton } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Chip } from '../../../components/ui/Chip';
import { ConfirmEffectsDialog } from '../../../components/ui/ConfirmEffectsDialog';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Notice } from '../../../components/ui/Notice';
import { Sheet } from '../../../components/ui/Overlays';
import { Snackbar } from '../../../components/ui/Snackbar';
import { UndoToast } from '../../../components/ui/UndoToast';
import { COACH_BREAKPOINT, useMinWidth } from '../../../components/ui/breakpoints';
import {
  featuresOf,
  type CanvasProps,
  type EditorActions,
  type EditorState,
  type PaneId,
  type ProgramEditorHost,
} from '../host';
import {
  DOW_OF_ISO,
  dayActivities,
  dayItems,
  dayMode,
  dayName,
  dowOf,
  programSets,
  trainingDays,
  type DayMode,
  type MuscleGroup,
  type ProgramDoc,
} from '../model/doc';
import {
  canRedo,
  canUndo,
  emptyHistory,
  record,
  redo as redoHistory,
  undo as undoHistory,
  type History,
} from '../model/history';
import {
  addActivity,
  addBareExercise,
  activityDefaults,
  activityHasContent,
  addCardio,
  addExerciseWithTargets,
  cleanExerciseName,
  removeActivity,
  addMarker,
  clearDay,
  copyDay,
  importDay,
  startDay,
  toMusclesMode,
} from '../model/ops';
import { applyEdit } from '../model/pipeline';
import { PaneBody, paneTitle, type PaneCtx } from './Panes';
import { WeekCanvas } from './WeekCanvas';
import { firstName } from './text';
import './ProgramEditor.css';

/** Where the editor lands once: a weekday and, when known, a row ("Fix in editor" from the check). */
export interface EditorFocus {
  day?: number;
  itemId?: string;
  /** Resolved to the first row with this exercise name. */
  rowName?: string;
  /** Change it to land on the same day / row again (a host's "fix this" button). */
  nonce?: number;
}

/** Stories and tests open a scene (a weekday, a selected row, a pane, a dialog); an app never provides it. */
export interface EditorScene extends EditorFocus {
  pane?: PaneId;
  dialog?: 'switch';
}

export interface ChangeMeta {
  kind: 'edit' | 'undo' | 'redo';
  /** The edit's short name ("muscles", "swap"...), when it has one. */
  label?: string;
}

export interface ProgramEditorProps {
  /** The program. The editor never keeps its own copy: every change goes out through `onChange`. */
  doc: ProgramDoc;
  onChange: (next: ProgramDoc, meta: ChangeMeta) => void;
  host: ProgramEditorHost;
  /** View only: nothing can be changed, panes are disabled fieldsets. */
  readOnly?: boolean;
  /** Who the program is for. The preview speaks to them ("What Yulia sees"). Empty: the person editing. */
  audience?: string;
  /** The other party of "with <partner>" days (a trainer), and the ISO weekdays done together. */
  partner?: string;
  partnerDays?: readonly number[];
  /** Land on a weekday / row once, when the editor opens. */
  focus?: EditorFocus | null;
  initial?: EditorScene;
  /** The width from which the inspector sits beside the canvas (default: the Coach breakpoint). */
  wideAt?: number;
  className?: string;
}

type Dialog =
  null | 'switch' | { addOnMuscles: string } | { rest: number } | { removeActivity: string };

/**
 * The program editor: a week of days, one day at a time, an inspector for the selected row, undo and redo. Controlled
 * by a plain `ProgramDoc`; knows nothing about where the program is stored. See `docs/PROGRAM-EDITOR-TOOL.md`.
 */
export function ProgramEditor({
  doc,
  onChange,
  host,
  readOnly = false,
  audience = '',
  partner = '',
  partnerDays = [],
  focus,
  initial,
  wideAt = COACH_BREAKPOINT,
  className,
}: ProgramEditorProps) {
  const p = host.labels;
  const t = host.words;
  const features = featuresOf(host);
  const wide = useMinWidth(wideAt);
  const env = useMemo(() => ({ weekOrder: host.weekOrder }), [host.weekOrder]);
  const days = useMemo(() => trainingDays(doc, env), [doc, env]);

  // ---- scene -----------------------------------------------------------------------------------------------
  const start = useMemo(() => {
    const named = initial?.rowName
      ? doc.items.find((i) => i.name === initial.rowName)
      : focus?.rowName
        ? doc.items.find((i) => i.name === focus.rowName)
        : undefined;
    const day = initial?.day ?? focus?.day ?? named?.day ?? null;
    const asked = initial?.itemId ?? focus?.itemId;
    const known = (id?: string) =>
      !!id &&
      (doc.items.some((i) => i.id === id) || (doc.activities ?? []).some((a) => a.id === id));
    const itemId = (known(asked) ? asked : undefined) ?? named?.id ?? '';
    return { day, itemId };
    // The scene is read once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [dayRaw, setDay] = useState<number | null>(start.day);
  const [sel, setSel] = useState(start.itemId);
  const [pane, setPane] = useState<PaneId>(initial?.pane ?? 'edit');
  const [sheet, setSheet] = useState(false);
  const [forceEx, setForceEx] = useState<ReadonlySet<number>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(initial?.dialog ?? null);
  const [toast, setToast] = useState<{ text: string; undo?: boolean; icon?: string } | null>(null);
  const [lastRemoved, setLastRemoved] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  const inspRef = useRef<HTMLElement>(null);
  // The inspector scrolls (sticky, max-height). When it holds nothing focusable (read-only, a preview) the region itself
  // takes the tab stop so a keyboard user can scroll it.
  const [inspStatic, setInspStatic] = useState(false);
  const [headFocus, setHeadFocus] = useState(0);

  const day = dayRaw != null && days.includes(dayRaw) ? dayRaw : (days[0] ?? 0);
  const mode: DayMode = !day ? 'exercises' : forceEx.has(day) ? 'exercises' : dayMode(doc, day);

  // ---- history ---------------------------------------------------------------------------------------------
  // `at` is the document the history belongs to. A document that arrives from outside (a reload after a conflict)
  // is not one we emitted: the history starts over instead of undoing into a stale program.
  const [hist, setHist] = useState<{ h: History; at: ProgramDoc }>(() => ({
    h: emptyHistory(),
    at: doc,
  }));
  const h = hist.at === doc ? hist.h : emptyHistory();
  if (hist.at !== doc) setHist({ h: emptyHistory(), at: doc });

  const edit = (fn: (d: ProgramDoc) => ProgramDoc, label?: string) => {
    if (readOnly) return;
    const next = applyEdit(doc, fn, host.middleware, label);
    if (next === doc) return;
    // Typing a name is one undo step, not one per key.
    const typing = label === 'dayName' && h.past[h.past.length - 1]?.label === 'dayName';
    setHist({ h: typing ? { past: h.past, future: [] } : record(h, doc, label), at: next });
    onChange(next, { kind: 'edit', label });
  };
  const undo = () => {
    const r = undoHistory(h, doc);
    if (!r || readOnly) return;
    setHist({ h: r.history, at: r.doc });
    onChange(r.doc, { kind: 'undo' });
  };
  const redo = () => {
    const r = redoHistory(h, doc);
    if (!r || readOnly) return;
    setHist({ h: r.history, at: r.doc });
    onChange(r.doc, { kind: 'redo' });
  };

  /* The inspector scrolls by keyboard only when it holds nothing focusable. Watch its DOM instead of re-checking on
     every render: it settles once per real change (children added or removed, a control enabled or disabled). */
  useEffect(() => {
    const el = inspRef.current;
    if (!el) return;
    const FOCUSABLE =
      'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])';
    const check = () => setInspStatic(!el.querySelector(FOCUSABLE));
    check();
    if (typeof MutationObserver === 'undefined') return;
    const mo = new MutationObserver(check);
    mo.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'tabindex', 'href'],
    });
    return () => mo.disconnect();
  }, [wide]);
  // A toast lasts 8 s (the undo window), then goes.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), toast.undo ? 8000 : 4000);
    return () => window.clearTimeout(id);
  }, [toast]);
  // After picking a row or a pane the inspector heading takes focus (keyboard and screen reader land on it).
  useEffect(() => {
    if (headFocus > 0) headRef.current?.focus();
  }, [headFocus]);

  // A host asks for another landing spot after the editor is open (primary action "fix this day"). Only a new
  // request moves the editor, not every change of the document.
  const focusKey = focus ? `${focus.day}|${focus.itemId}|${focus.rowName}|${focus.nonce}` : '';
  const [seenFocus, setSeenFocus] = useState(focusKey);
  if (seenFocus !== focusKey) {
    setSeenFocus(focusKey);
    const named = focus?.rowName ? doc.items.find((i) => i.name === focus.rowName) : undefined;
    const d = focus?.day ?? named?.day;
    if (focus && d && days.includes(d)) {
      setDay(d);
      setSel(focus.itemId ?? named?.id ?? '');
      setPane('edit');
      setSheet(false);
    }
  }

  // ---- actions ---------------------------------------------------------------------------------------------
  const select = (id: string) => {
    setSel(id);
    setPane('edit');
    setSheet(!wide);
    if (wide) setHeadFocus((n) => n + 1);
  };
  const goDay = (d: number) => {
    setDay(d);
    setSel('');
    setPane('edit');
    setSheet(false);
    setLastRemoved(null);
  };
  const openPane = (x: PaneId) => {
    setSel('');
    setPane(x);
    setSheet(!wide);
    if (wide) setHeadFocus((n) => n + 1);
  };
  const unforce = (d: number) =>
    setForceEx((s) => {
      const n = new Set(s);
      n.delete(d);
      return n;
    });

  const doAddExercise = (name: string) => {
    const r2 =
      host.newRows === 'targets'
        ? addExerciseWithTargets(doc, day, name, host.catalog)
        : addBareExercise(doc, day, name, host.catalog);
    edit(() => r2.program, 'add');
    setForceEx((s) => new Set(s).add(day));
    setSel(r2.id);
    setPane('edit');
    setSheet(!wide);
    setLastRemoved(null);
  };
  const addExercise = (name: string) => {
    if (mode === 'muscles' && (doc.targetMuscles[String(day)]?.length ?? 0) > 0)
      setDialog({ addOnMuscles: name });
    else doAddExercise(name);
  };
  const setMode = (m: DayMode) => {
    if (m === mode || readOnly) return;
    setSel('');
    setPane('edit');
    if (m === 'muscles') {
      if (dayItems(doc, day).length > 0) setDialog('switch');
      else unforce(day);
    } else setForceEx((s) => new Set(s).add(day));
  };
  const toggleDay = (d: number) => {
    if (readOnly) return;
    if (days.includes(d)) {
      const has = dayItems(doc, d).length > 0 || (doc.targetMuscles[String(d)]?.length ?? 0) > 0;
      if (has) setDialog({ rest: d });
      else edit((pr) => clearDay(pr, d), 'restDay');
    } else {
      edit((pr) => startDay(pr, d, p.dowFull[DOW_OF_ISO[d - 1]]), 'startDay');
      setDay(d);
      setSel('');
      setPane('edit');
    }
  };
  const confirmMuscles = () => {
    edit((d) => toMusclesMode(d, day, host.catalog), 'muscles');
    unforce(day);
    setDialog(null);
    setSheet(false);
    setToast({ text: p.edMusclesSet(dayName(doc, day)), undo: true, icon: 'person-simple' });
  };

  const actions: EditorActions = {
    edit,
    selectDay: goDay,
    select,
    clearSelection: () => {
      setSel('');
      setPane('edit');
      setSheet(false);
    },
    openPane,
    addExercise,
    setMode,
    toggleDay,
    undo,
    redo,
  };

  const state: EditorState = {
    doc,
    day,
    mode,
    selectedId: sel,
    pane,
    readOnly,
    audience,
    partner,
    partnerDays,
    wide,
    labels: p,
    words: t,
    host,
  };

  const ctx: PaneCtx = {
    p,
    t,
    host,
    features,
    draft: doc,
    day,
    mode,
    audience,
    partner,
    readOnly,
    size: wide ? 'sm' : 'md',
    selectedId: sel,
    edit,
    setPane,
    select,
    clear: actions.clearSelection,
    library: host.library ?? [],
    addExercise,
    addCardio: (name) => {
      edit((d) => addCardio(d, day, name), 'cardio');
      setPane('edit');
    },
    addMarker: (kind) => {
      edit(
        (d) => addMarker(d, day, kind, { warmup: p.edWarmMarker, cooldown: p.edCoolMarker }),
        'marker',
      );
      setPane('edit');
    },
    copyDayTo: (to) => {
      edit((d) => copyDay(d, day, to), 'copyDay');
      setPane('edit');
      setSheet(false);
      setToast({
        text: p.edCopiedDay(dayName(doc, day), dayName(doc, to) || p.dowFull[dowOf(to)]),
      });
    },
    importEntry: (e) => {
      edit((d) => importDay(d, day, e.program, e.day), 'import');
      unforce(day);
      setToast({ text: p.edCopiedDay(e.dayName || e.name, dayName(doc, day)) });
    },
    onRemoved: (d, wasLast) => setLastRemoved(wasLast ? d : null),
    createExercise: (raw) => {
      const typed = cleanExerciseName(raw);
      const name = typed ? (host.canonicalName?.(typed) ?? typed) : '';
      if (name) addExercise(name);
    },
    openPicker: () => setPicker(true),
    removeActivity: (id) => {
      const a = (doc.activities ?? []).find((x) => x.id === id);
      if (!a || readOnly) return;
      // Asking only when there is something to lose; Undo covers the rest.
      if (activityHasContent(a)) setDialog({ removeActivity: id });
      else doRemoveActivity(id);
    },
  };

  const doRemoveActivity = (id: string) => {
    const a = (doc.activities ?? []).find((x) => x.id === id);
    edit((d) => removeActivity(d, id), 'activity');
    setSel('');
    setPane('edit');
    setSheet(false);
    if (a)
      setToast({
        text: p.edActRemoved(t.actType[a.type] ?? a.type),
        undo: true,
        icon: 'trash',
      });
  };

  const addActivityOfType = (type: string) => {
    const before = new Set((doc.activities ?? []).map((a) => a.id));
    let created = '';
    edit((d) => {
      const next = addActivity(d, { day, type, ...activityDefaults(type) });
      created = (next.activities ?? []).find((a) => !before.has(a.id))?.id ?? '';
      return next;
    }, 'activity');
    if (created) {
      setSel(created);
      setPane('edit');
    }
  };

  const custom = host.slots?.panes?.[pane];
  const hasRow = !!doc.items.find((i) => i.id === sel);
  const hasAct = !!dayActivities(doc, day).find((a) => a.id === sel);
  const title = custom ? custom.title(state) : paneTitle(ctx, pane, hasRow, hasAct);
  const paneNode = custom ? (
    custom.render(state, actions)
  ) : (
    <PaneBody c={ctx} pane={pane} onAddActivity={addActivityOfType} />
  );

  const Canvas: React.ComponentType<CanvasProps> = host.slots?.canvas ?? WeekCanvas;

  const note =
    lastRemoved === day && !readOnly ? (
      <Notice
        tone="neutral"
        icon="info"
        trail={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              unforce(day);
              setLastRemoved(null);
              setMode('muscles');
            }}
          >
            {p.edDefineByMuscles}
          </Button>
        }
      >
        {p.edLastRemoved(dayName(doc, day))}
      </Notice>
    ) : undefined;

  const first = firstName(audience);
  const sheetOpen = !wide && sheet && (hasRow || hasAct || pane !== 'edit' || mode === 'muscles');

  return (
    <div className={['pe-root', className].filter(Boolean).join(' ')} data-mode={host.mode}>
      <div className="pe-split">
        <div className="pe-main">
          <div
            className="pe-toolbar"
            role={features.history && !readOnly ? 'toolbar' : undefined}
            aria-label={features.history && !readOnly ? p.edHistory : undefined}
          >
            {features.history && !readOnly && (
              <span className="pe-hist">
                <IconButton
                  icon="arrow-counter-clockwise"
                  label={p.edUndo}
                  variant="ghost"
                  size="sm"
                  disabled={!canUndo(h)}
                  onClick={undo}
                />
                <IconButton
                  icon="arrow-clockwise"
                  label={p.edRedo}
                  variant="ghost"
                  size="sm"
                  disabled={!canRedo(h)}
                  onClick={redo}
                />
              </span>
            )}
            <span className="pe-summary">
              {p.edWeekSummary(
                programSets(doc),
                (doc.activities ?? []).reduce((n, a) => n + a.minutes, 0),
              )}
            </span>
          </div>
          {days.length === 0 ? (
            <Card>
              <EmptyState titleAs="h2" icon="barbell" title={p.edNoDays} body={p.edNoDaysBody}>
                {!readOnly && (
                  <div className="pe-newdays">
                    {DOW_OF_ISO.map((d, i) => (
                      <Chip
                        key={d}
                        onClick={() => {
                          edit((pr) => startDay(pr, i + 1, p.dowFull[d]), 'startDay');
                          setDay(i + 1);
                        }}
                      >
                        {p.dowShort[d]}
                      </Chip>
                    ))}
                  </div>
                )}
              </EmptyState>
            </Card>
          ) : (
            <Canvas state={state} actions={actions} note={note} />
          )}
        </div>
        {wide && (
          <aside
            className="pe-inspector"
            aria-label={p.edInspEditor}
            ref={inspRef}
            tabIndex={inspStatic ? 0 : undefined}
          >
            <Card pad="none" className="pe-insp">
              <div className="pe-insp-h">
                <h2 ref={headRef} tabIndex={-1}>
                  {title}
                </h2>
                <span>{dayName(doc, day)}</span>
              </div>
              <div className="pe-insp-b">{paneNode}</div>
            </Card>
          </aside>
        )}
      </div>

      {sheetOpen && (
        <Sheet
          onClose={() => {
            setSheet(false);
            setPane('edit');
          }}
          padded
        >
          <div className="pe-sheet">
            <h2 className="pe-sheet-t">{title}</h2>
            {paneNode}
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                setSheet(false);
                setPane('edit');
              }}
            >
              {p.edDone}
            </Button>
          </div>
        </Sheet>
      )}

      {picker &&
        host.slots?.exercisePicker &&
        (() => {
          const Picker = host.slots.exercisePicker;
          return (
            <Picker
              dayLabel={dayName(doc, day)}
              taken={dayItems(doc, day).map((i) => i.name)}
              onPick={(name) => {
                setPicker(false);
                addExercise(name);
              }}
              onCreate={(name) => {
                setPicker(false);
                ctx.createExercise(name);
              }}
              onMarker={(kind) => {
                setPicker(false);
                ctx.addMarker(kind);
              }}
              onCardio={(machine) => {
                setPicker(false);
                ctx.addCardio(machine);
              }}
              onClose={() => setPicker(false)}
            />
          );
        })()}
      {dialog && typeof dialog === 'object' && 'removeActivity' in dialog && (
        <ConfirmEffectsDialog
          icon="trash"
          title={p.edActRemoveTitle(
            t.actType[
              (doc.activities ?? []).find((a) => a.id === dialog.removeActivity)?.type ?? ''
            ] ?? '',
          )}
          body={p.edActRemoveBody}
          cancelLabel={p.edKeepDay}
          confirmLabel={p.edActRemoveBtn}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            const id = dialog.removeActivity;
            setDialog(null);
            doRemoveActivity(id);
          }}
        />
      )}
      {dialog === 'switch' && (
        <ConfirmEffectsDialog
          icon="person-simple"
          title={p.edSwitchTitle}
          body={`${p.edSwitchBody(dayItems(doc, day).length, dayName(doc, day))} ${p.edSwitchKept(
            (() => {
              const set = new Set<MuscleGroup>();
              for (const it of dayItems(doc, day))
                for (const m of host.catalog.facts(it.name).muscles.slice(0, 2)) set.add(m);
              return [...set]
                .slice(0, 6)
                .map((m) => t.muscleGroups[m] ?? m)
                .join(' · ');
            })(),
            first,
          )}`}
          effects={dayItems(doc, day).map((it) => ({
            icon: it.kind === 'strength' ? 'barbell' : it.kind === 'warmup' ? 'flame' : 'snowflake',
            text: it.name,
          }))}
          cancelLabel={p.edKeepEx}
          confirmLabel={p.edSwitchBtn}
          onCancel={() => setDialog(null)}
          onConfirm={confirmMuscles}
        />
      )}
      {dialog && typeof dialog === 'object' && 'rest' in dialog && (
        <ConfirmEffectsDialog
          icon="moon"
          title={p.edRestTitle(p.dowFull[DOW_OF_ISO[dialog.rest - 1]])}
          body={p.edRestBody}
          effects={dayItems(doc, dialog.rest).map((it) => ({ icon: 'barbell', text: it.name }))}
          cancelLabel={p.edKeepDay}
          confirmLabel={p.edMakeRest}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            const d = dialog.rest;
            setDialog(null);
            edit((pr) => clearDay(pr, d), 'restDay');
            setSel('');
          }}
        />
      )}
      {dialog && typeof dialog === 'object' && 'addOnMuscles' in dialog && (
        <ConfirmEffectsDialog
          icon="barbell"
          title={p.edAddOnMusclesTitle}
          body={p.edAddOnMusclesBody}
          cancelLabel={p.edCancel}
          cancelVariant="secondary"
          confirmLabel={p.edAddExercise}
          confirmVariant="primary"
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            const name = dialog.addOnMuscles;
            setDialog(null);
            doAddExercise(name);
          }}
        />
      )}

      {toast?.undo ? (
        <UndoToast
          position="fixed"
          icon={toast.icon}
          text={toast.text}
          undoLabel={p.edUndo}
          countdownLabel={p.edUndoCountdown(8)}
          onUndo={() => {
            undo();
            setToast(null);
          }}
        />
      ) : (
        toast && <Snackbar position="fixed" icon={toast.icon} text={toast.text} />
      )}
    </div>
  );
}
