/**
 * Program editor: ONE standalone tool, used by the Coach dashboard (mode `coach`) and the athlete app (mode `self`).
 * Public API only; everything else in this folder is private. See README.md and docs/PROGRAM-EDITOR-TOOL.md.
 */

// Document and pure operations
export * from './model/doc';
export * from './model/ops';
export { diffPrograms, type Change } from './model/diff';
export {
  canRedo,
  canUndo,
  emptyHistory,
  HISTORY_LIMIT,
  record,
  redo,
  undo,
  type History,
  type HistoryEntry,
} from './model/history';
export { applyEdit, type OpEvent, type OpMiddleware } from './model/pipeline';

// Check engine
export {
  BUILT_IN_RULES,
  CARDIO_BAND,
  FIX_BELOW,
  MUSCLE_BAND,
  RANGE_GROUP,
  RANGE_GROUPS,
  restrictionConflicts,
  runCheck,
  weeklyVolume,
  pushPull,
  withoutPicture,
  type BuiltInFindingKind,
  type Check,
  type CheckContext,
  type CheckEnv,
  type CheckRule,
  type Finding,
  type FindingKind,
  type MuscleVolume,
  type RangeGroup,
  type RangeState,
  type RuleInput,
  type Sev,
} from './check/engine';

// Host contract
export {
  DEFAULT_FEATURES,
  featuresOf,
  type ActivityKind,
  type CardioKind,
  type ExerciseFlag,
  type ExerciseLink,
  type BuiltInPane,
  type CanvasProps,
  type CatalogHit,
  type EditorActions,
  type EditorFeatures,
  type EditorMode,
  type EditorSlots,
  type ExercisePickerSlotProps,
  type EditorState,
  type ExerciseCatalog,
  type ExerciseFacts,
  type ExerciseSearch,
  type LibraryDay,
  type MuscleMapProps,
  type PaneId,
  type PanelSpec,
  type PreviewProps,
  type ProgramEditorHost,
} from './host';
export type { ProgramEditorLabels, ProgramEditorWords } from './labels';

// UI
export {
  ProgramEditor,
  type ChangeMeta,
  type EditorFocus,
  type EditorScene,
  type ProgramEditorProps,
} from './ui/ProgramEditor';
export {
  BandField,
  BandFields,
  BandRow,
  BandText,
  EditorPage,
  InfoBand,
  PageFrame,
  type EditorPageProps,
  type PageBand,
  type PageBandNote,
  type PageButton,
  type PageChrome,
  type PageMenuItem,
} from './ui/EditorPage';
export { ChangeList } from './ui/ChangeList';
export { WeekCanvas } from './ui/WeekCanvas';
export {
  CheckReport,
  findingText,
  gateLine,
  SEV_ICON,
  SEV_TONE,
  type CheckReportProps,
} from './ui/CheckReport';
export { firstName, fmtRest, prescriptionLine, repsText, stripText, targetText } from './ui/text';
