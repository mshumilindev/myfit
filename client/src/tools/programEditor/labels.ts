/**
 * The words the program editor needs, as a TYPE. The tool ships no dictionary: the host passes an object of this shape
 * (the Coach host passes its `coachProgram` dictionary, which satisfies it structurally; five locales live there).
 * Keys keep the host dictionary's names so a dictionary can be handed over as it is.
 */
export interface ProgramEditorLabels {
  ckAbove: string;
  ckActRow: (day: string, meta: string) => string;
  ckActivities: string;
  ckAddPictures: string;
  ckBandNote: (max: number) => string;
  ckBarAria: (g: string, sets: string, a: number, b: number, state: string) => string;
  ckBareBody: (first: string) => string;
  ckBareTitle: (n: number) => string;
  ckBelow: string;
  ckBeside: string;
  ckCardioOff: (a: number, b: number) => string;
  ckCardioOk: (a: number, b: number, rec: number) => string;
  ckCardioRow: string;
  ckCardioTitle: (m: number) => string;
  ckChecks: (n: number) => string;
  ckEmptyBody: string;
  ckEmptyTitle: (day: string) => string;
  ckFindings: string;
  ckFine: string;
  ckFixInEditor: string;
  ckInRange: string;
  ckMin: (n: number) => string;
  ckMusclesDayBody: (list: string, first: string) => string;
  ckMusclesDayTitle: (day: string) => string;
  ckNoRange: string;
  ckNoSets: string;
  ckNoTarget: string;
  ckOnceBody: string;
  ckOnceOkBody: string;
  ckOnceOkTitle: string;
  ckOnceTitle: (list: string) => string;
  ckOpenBody: (list: string, first: string) => string;
  ckOpenTitle: (n: number) => string;
  ckPPBody: (ratio: string) => string;
  ckPPOkBody: string;
  ckPPOkTitle: (pull: number, push: number) => string;
  ckPPTitle: (pull: number, push: number) => string;
  ckPicBody: (names: string, first: string) => string;
  ckPicTitle: (n: number) => string;
  ckPull: string;
  ckPullMuscles: string;
  ckPush: string;
  ckPushMuscles: string;
  ckPushPull: string;
  ckRange: (a: number, b: number) => string;
  ckRangeBody: (sets: string, a: number, b: number, bare: readonly string[]) => string;
  ckRangeHigh: (g: string) => string;
  ckRangeLow: (g: string) => string;
  ckRecoveryNote: string;
  ckRecoveryRow: string;
  ckRestrBody: (r: string, first: string) => string;
  ckRestrTitle: (ex: string) => string;
  ckSetsAWeek: string;
  ckSetsMeta: string;
  ckSetsPerMuscle: string;
  ckSevLabel: { fix: string; review: string; note: string; ok: string };
  ckSummary: (n: number, total: number, notes: boolean) => string;
  ckToFix: string;
  ckToReview: string;
  dowFull: {
    Mon: string;
    Tue: string;
    Wed: string;
    Thu: string;
    Fri: string;
    Sat: string;
    Sun: string;
  };
  dowShort: {
    Mon: string;
    Tue: string;
    Wed: string;
    Thu: string;
    Fri: string;
    Sat: string;
    Sun: string;
  };
  edActAddTo: (day: string) => string;
  edActBody: string;
  edActConditioning: string;
  edActCounts: (first: string, kind: string) => string;
  edActRecovery: string;
  edActivitiesBeside: string;
  edActivity: string;
  edActivityMin: (m: number) => string;
  edActivityN: (n: number) => string;
  edAddActivity: string;
  edAddExercise: string;
  edAddOnMusclesBody: string;
  edAddOnMusclesTitle: string;
  edAddSets: string;
  edAddSwitch: string;
  edAddTo: (day: string) => string;
  edAdded: string;
  edAddedAs: string;
  edAll: string;
  edArms: string;
  edBackDay: string;
  edBackTo: (what: string) => string;
  edBareBody: (first: string) => string;
  edBrowse: string;
  edCancel: string;
  edCardio: string;
  edChooseEx: string;
  edChooseMuscle: string;
  edClearSearch: string;
  edColExercise: string;
  edColSets: string;
  edColTarget: string;
  edCoolMarker: string;
  edCopiedDay: (a: string, b: string) => string;
  edCopyBody: string;
  edCopyDay: string;
  edCopyDayTo: (day: string) => string;
  edCopyTemplate: string;
  edDayCardSummary: (e: number, s: number) => string;
  edDayMode: string;
  edDayTabs: string;
  edDefineByMuscles: string;
  edDefinedByMuscles: string;
  edDiffAdd: (name: string, day: string, sets: number, reps: number) => string;
  edDiffChange: (name: string, day: string, what: string) => string;
  edDiffNone: string;
  edDiffRemove: (name: string, day: string) => string;
  edDiffWhat: Record<
    | 'sets'
    | 'reps'
    | 'weight'
    | 'rpe'
    | 'rest'
    | 'bare'
    | 'name'
    | 'note'
    | 'dropLast'
    | 'group'
    | 'day'
    | 'equipment'
    | 'warmup'
    | 'cardio'
    | 'dayName'
    | 'muscles'
    | 'activities',
    string
  >;
  edDone: string;
  edDown: string;
  edDropLast: string;
  edDuration: string;
  edEffort: string;
  edEffortOnly: string;
  edEquipment: string;
  edExercises: string;
  edFromExercises: string;
  edInspActivity: string;
  edInspAdd: string;
  edInspAddAct: string;
  edInspCopyDay: string;
  edInspEditor: string;
  edInspExercise: string;
  edInspLibrary: string;
  edInspMuscles: string;
  edInspSees: (first: string) => string;
  edInspSuperset: string;
  edInspSwap: string;
  edJustEx: string;
  edKeepEx: string;
  edLastRemoved: (day: string) => string;
  edLegs: string;
  edLibBody: (day: string) => string;
  edLibClients: string;
  edLibCopied: string;
  edLibCopy: string;
  edLibEmpty: string;
  edLibInto: (day: string) => string;
  edLibSource: string;
  edLibTemplates: string;
  edMapBack: string;
  edMapFront: string;
  edMarkerBody: string;
  edMarkerNote: string;
  edMore: string;
  edMoveDown: string;
  edMoveUp: string;
  edMuscleGroups: string;
  edMuscleMap: string;
  edMuscles: string;
  edMusclesChosen: (n: number) => string;
  edMusclesSet: (day: string) => string;
  edNoDays: string;
  edNoDaysBody: string;
  edNoMatch: (q: string) => string;
  edNoSetsYet: string;
  edNoTarget: string;
  edNotSet: string;
  edNotePh: string;
  edNoteTo: string;
  edPairWith: string;
  edPickMuscle: string;
  edPicksNote: (first: string) => string;
  edPrevBareCap: (first: string) => string;
  edPrevFoot: (first: string) => string;
  edPrevJust: string;
  edPrevKg: string;
  edPrevNoTarget: string;
  edPrevProgram: string;
  edPrevReps: string;
  edPrevRest: (t: string) => string;
  edPrevRpe: (n: number) => string;
  edPrevSession: string;
  edPrevSetN: (n: number) => string;
  edPrevTargetCap: (first: string) => string;
  edPrevTargets: string;
  edPrevView: string;
  edPreview: (first: string) => string;
  edRecovery: string;
  edRemove: string;
  edRemoveMarker: string;
  edReplaces: (n: number) => string;
  edReps: string;
  edRest: string;
  edRestBetween: string;
  edRestHint: string;
  edRowAria: (name: string, what: string) => string;
  edRowType: string;
  edRpeHint: string;
  edSearchEx: string;
  edSelectRow: string;
  edSelectRowBody: string;
  edSets: string;
  edSetsReps: string;
  edShownAbove: string;
  edSolo: string;
  edSoloDay: string;
  edSuggested: string;
  edSuperWith: string;
  edSwap: string;
  edSwapFor: (name: string) => string;
  edSwapNone: string;
  edSwitchBody: (n: number, day: string) => string;
  edSwitchBtn: string;
  edSwitchKept: (list: string, first: string) => string;
  edSwitchTitle: string;
  edTable: (day: string) => string;
  edTapBody: string;
  edTargetMuscles: string;
  edTargetRpe: string;
  edTargetWeight: string;
  edTargetWord: string;
  edTargetsOpt: string;
  edTrainingDays: string;
  edUndo: string;
  edUndoCountdown: (s: number) => string;
  edUngroup: (name: string) => string;
  edUp: string;
  edWarmMarker: string;
  edWeekSummary: (sets: number, minutes: number) => string;
  edWhatSees: (first: string) => string;
  edWhen: string;
  edWhenAfter: string;
  edWhenAny: string;
  edWhenBefore: string;
  edWhenText: { any: string; before: string; after: string };
  edWithTargets: string;
  edWithTrainer: (trainer: string) => string;
  edWithoutSets: (n: number) => string;
  ptExSets: (e: number, s: number) => string;
  edHistory: string;
  edRedo: string;
  edTrainOn: (day: string) => string;
  edRestTitle: (day: string) => string;
  edRestBody: string;
  edMakeRest: string;
  edKeepDay: string;
  edDayNameAria: (day: string) => string;
  edNameDay: string;
  edWarmTitle: string;
  edWarmAdd: string;
  edWarmPick: string;
  edWarmNone: string;
  edWarmReps: string;
  edWarmSecs: string;
  edWarmRemove: (name: string) => string;
  edAddCardio: string;
  edCardioWhich: string;
  edCardioMin: string;
  edInspCardio: string;
  edCreateEx: (name: string) => string;
  edCreateExNote: string;
  edBrowseAll: string;
  edWarmEdit: (name: string) => string;
  edWarmWeight: string;
  edWarmWeightNone: string;
  edWarmSecShort: string;
  edActRemoveTitle: (name: string) => string;
  edActRemoveBody: string;
  edActRemoveBtn: string;
  edActRemoved: (name: string) => string;
}

/** Muscle, activity and equipment words (the host's main dictionary). */
export interface ProgramEditorWords {
  muscleGroups: Record<string, string>;
  actType: Record<string, string>;
  actEffortLevel: Record<string, string>;
  equipmentLabel: (id: string) => string;
}
