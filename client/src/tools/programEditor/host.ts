/**
 * Everything the program editor needs from the world, as ONE interface. The tool owns the document, the operations,
 * the check engine and the screens; the host owns facts about exercises, words in the user's language, where the
 * draft is stored and what happens on Save / Send. Nothing in this folder imports a host module (an architecture
 * test enforces it), so the same tool runs in the Coach dashboard (mode `coach`), in the athlete app (mode `self`)
 * and in a story with a handful of literals.
 */
import type { ComponentType, ReactNode } from 'react';
import type { ProgramDoc, MuscleGroup, ProgramItemDoc } from './model/doc';
import type { ProgramEditorLabels, ProgramEditorWords } from './labels';
import type { CheckRule, CheckContext, Finding } from './check/engine';
import type { OpMiddleware } from './model/pipeline';

/* ---- exercises -------------------------------------------------------------------------------------------- */

export type {
  ExerciseFlag,
  ExerciseFacts,
  CatalogHit,
  ExerciseSearch,
  ExerciseCatalog,
  ActivityKind,
} from './host.catalog';
import type { ExerciseCatalog, ActivityKind } from './host.catalog';

/** A cardio machine the host offers (the athlete's own program adds cardio by machine). */
export interface CardioKind {
  name: string;
  icon?: string;
}

/** A link on an exercise row the host owns ("Details", "History"). */
export interface ExerciseLink {
  label: string;
  icon?: string;
  onClick: () => void;
}

/** A day to copy from: a template, or a day of another program. */
export interface LibraryDay {
  key: string;
  kind: 'template' | 'client';
  /** Program name. */
  name: string;
  /** Day name inside it ("Upper A"). */
  dayName: string;
  exercises: number;
  sets: number;
  by?: string;
  clientName?: string;
  program: ProgramDoc;
  /** Which weekday (1..7) of `program`. */
  day: number;
}

/* ---- extension points ------------------------------------------------------------------------------------- */

export type BuiltInPane = 'edit' | 'swap' | 'pair' | 'add' | 'actadd' | 'copy' | 'lib' | 'view';
/** A built-in pane or the id of a pane the host registered in `slots.panes`. */
export type PaneId = BuiltInPane | (string & {});

/** What the editor tells the canvas and the panes. Stable between releases: this is the contract for new panels. */
export interface EditorState {
  doc: ProgramDoc;
  /** The weekday shown (ISO). 0 when the program has no training day yet. */
  day: number;
  mode: 'muscles' | 'exercises';
  selectedId: string;
  pane: PaneId;
  readOnly: boolean;
  audience: string;
  partner: string;
  /** ISO weekdays done together with the partner (a coach day). */
  partnerDays: readonly number[];
  wide: boolean;
  labels: ProgramEditorLabels;
  words: ProgramEditorWords;
  host: ProgramEditorHost;
}

/** Everything a canvas or a panel may do. Every edit goes through `edit` so history and middleware see it. */
export interface EditorActions {
  edit(fn: (doc: ProgramDoc) => ProgramDoc, label?: string): void;
  selectDay(day: number): void;
  select(id: string): void;
  clearSelection(): void;
  openPane(pane: PaneId): void;
  addExercise(name: string): void;
  setMode(mode: 'muscles' | 'exercises'): void;
  /** A weekday becomes a training day, or (after asking, when it has content) a rest day. */
  toggleDay(day: number): void;
  undo(): void;
  redo(): void;
}

export interface CanvasProps {
  state: EditorState;
  actions: EditorActions;
  /** Strings that fit under the day strip (host passes them through `ProgramEditorProps.dayNote`). */
  note?: ReactNode;
}

/** An inspector panel the host adds. `title` shows in the inspector header (or the phone sheet). */
export interface PanelSpec {
  title: (s: EditorState) => string;
  render: (s: EditorState, a: EditorActions) => ReactNode;
}

export interface MuscleMapProps {
  selected: MuscleGroup[];
  onToggle?: (m: MuscleGroup) => void;
  locked?: boolean;
  labels: { front: string; back: string };
  className?: string;
}

export interface PreviewProps {
  /** The document (null when only one row is previewed). */
  doc: ProgramDoc | null;
  day: number;
  /** The row to preview, or null for the whole day. */
  item: ProgramItemDoc | null;
  audience: string;
  labels: ProgramEditorLabels;
  words: ProgramEditorWords;
  host: ProgramEditorHost;
}

/** What the host's picker gets: it calls exactly one of the callbacks, then the tool closes it. */
export interface ExercisePickerSlotProps {
  /** Day name for the title ("Add to Upper A"). */
  dayLabel: string;
  /** Names already on the day (marked, never blocked). */
  taken: readonly string[];
  /** The picker's own search text, offered as a custom exercise. */
  onPick: (name: string) => void;
  /** A name nobody has: added as a custom exercise (the tool normalises it). */
  onCreate: (name: string) => void;
  onMarker: (kind: 'warmup' | 'cooldown') => void;
  onCardio: (machine: string) => void;
  onClose: () => void;
}

export interface EditorSlots {
  /** Replaces the whole week + day canvas (the "professional constructor" entry point). */
  canvas?: ComponentType<CanvasProps>;
  /** Extra inspector panels, opened with `actions.openPane('<id>')`. */
  panes?: Record<string, PanelSpec>;
  /** The anatomy figure (the tool draws a chip grid without it). */
  muscleMap?: ComponentType<MuscleMapProps>;
  /** Replaces the built-in "what the client sees" preview of a row or a day. */
  preview?: ComponentType<PreviewProps>;
  /** Replaces the Add pane's "Browse all exercises" overlay with the host's own picker (the app's full exercise picker). */
  exercisePicker?: ComponentType<ExercisePickerSlotProps>;
  /** A small tag beside a day in the week strip (the athlete's "With your trainer"). `day` is ISO 1..7. */
  dayTag?: ComponentType<{ day: number }>;
}

export interface EditorFeatures {
  /** "Copy from a template or another program" */
  library: boolean;
  /** Copy a day onto another weekday. */
  copyDay: boolean;
  /** Planned activities beside the lifting. */
  activities: boolean;
  /** Warm-up / cool-down markers. */
  markers: boolean;
  /** Supersets. */
  supersets: boolean;
  /** Sets/reps/weight/RPE/rest targets and "just the exercise" rows. */
  targets: boolean;
  /** A day defined by target muscles instead of exercises. */
  muscleDays: boolean;
  /** "What <name> sees" preview. */
  preview: boolean;
  /** Undo / redo buttons. */
  history: boolean;
  /** Seven weekday toggles that turn a day into a training day (or back into rest, after asking). */
  weekSetup: boolean;
  /** An editable name on the day card. */
  dayNames: boolean;
  /** Cardio rows (needs `host.cardio`). */
  cardio: boolean;
  /** "Create <typed name>" in the Add pane: an exercise the catalog does not know, added by name. */
  customExercise: boolean;
}

/** `coach`: a trainer writes for someone else (preview, partner days). `self`: a person writes their own program. */
export type EditorMode = 'coach' | 'self';

export const DEFAULT_FEATURES: Record<EditorMode, EditorFeatures> = {
  coach: {
    library: true,
    copyDay: true,
    activities: true,
    markers: true,
    supersets: true,
    targets: true,
    muscleDays: true,
    preview: true,
    history: true,
    weekSetup: false,
    dayNames: false,
    cardio: false,
    customExercise: true,
  },
  self: {
    library: true,
    copyDay: true,
    activities: true,
    markers: true,
    supersets: true,
    targets: true,
    muscleDays: true,
    preview: false,
    history: true,
    weekSetup: true,
    dayNames: true,
    cardio: true,
    customExercise: true,
  },
};

export interface ProgramEditorHost {
  mode: EditorMode;
  catalog: ExerciseCatalog;
  /** Words of the user's language (the host's dictionary; five locales live there, not here). */
  labels: ProgramEditorLabels;
  words: ProgramEditorWords;
  /** Planned-activity catalog, picker order. */
  activities: readonly ActivityKind[];
  /** Equipment ids offered as chips on a row. */
  equipment: readonly string[];
  /** Training-week order of ISO weekdays; default Monday first. */
  weekOrder?: readonly number[];
  /** Cardio machines for "Add cardio" (feature `cardio`). */
  cardio?: readonly CardioKind[];
  /** What a new exercise starts as: `bare` (just the exercise; the Coach default) or `targets` (3 x 10; the athlete default). */
  newRows?: 'bare' | 'targets';
  /** The starting target of a warm-up exercise: reps or seconds (stretches and holds are timed). */
  warmupTarget?: (name: string) => { reps?: number; durationSec?: number };
  /** Links on an exercise row (details, history): the host navigates, the tool only draws them. */
  exerciseLinks?: (name: string) => readonly ExerciseLink[];
  /** The catalog spelling of a typed name ("bench press" -> "Barbell Bench Press"); unknown names come back trimmed. */
  canonicalName?: (name: string) => string;
  /** Does a warm-up exercise take a load (band, dumbbell...)? The warm-up drawer shows the weight field for those. */
  warmupWeighted?: (name: string) => boolean;
  /** The unit a person reads that exercise's weight in; the document always stores kg. Default kg. */
  weightUnit?: (name: string) => 'kg' | 'lb';
  /** Days to copy from. Local; never blocks. */
  library?: readonly LibraryDay[];
  /** Turn on / off parts of the UI. Unset keys follow the mode's defaults (`DEFAULT_FEATURES`). */
  features?: Partial<EditorFeatures>;
  /** Restrictions and other host facts the check reads. */
  checkContext?: CheckContext;
  /** Receives the built-in rules and returns the rules to run (add, remove, reorder). */
  checkRules?: (builtIn: readonly CheckRule[]) => readonly CheckRule[];
  /** Words for a finding the built-in text does not know (a custom rule). */
  describeFinding?: (f: Finding) => { title: string; body: string } | undefined;
  /** Runs on every edit, in order. Can normalise, guard (return the previous doc to veto) or audit. */
  middleware?: readonly OpMiddleware[];
  slots?: EditorSlots;
}

/** Features after the mode's defaults and the host's overrides. */
export const featuresOf = (h: Pick<ProgramEditorHost, 'mode' | 'features'>): EditorFeatures => ({
  ...DEFAULT_FEATURES[h.mode],
  ...h.features,
});
