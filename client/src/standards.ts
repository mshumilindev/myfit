/**
 * Standards (Заліки) — maps the user's lifts to two reference systems, both
 * DERIVED from history and DYNAMIC to the user's own bodyweight + sex:
 *   1. Sport classification (розряди III → МСМК) — raw amateur norms by
 *      bodyweight class. Source: WPF kRAWa. Lifts: powerlifting total, squat,
 *      bench, deadlift, strict curl.
 *   2. Strength level (Beginner → Elite) — bodyweight-ratio standards for many
 *      common lifts. Source: Strength Level community data (ratios calibrated at
 *      men 90 kg / women 60 kg). Lifts: presses, rows, hinges, machines, etc.
 */
import { canonicalExerciseName } from './data/exercises';
import { est1rm, isStrengthExercise, setTypeOf } from './store';
import type { Workout } from './types';

export type Sex = 'M' | 'F';
export type System = 'rank' | 'level';

export type RankId = 'III' | 'II' | 'I' | 'KMS' | 'MS' | 'MSMK';
export const RANKS: RankId[] = ['III', 'II', 'I', 'KMS', 'MS', 'MSMK'];
export type LevelId = 'beg' | 'nov' | 'int' | 'adv' | 'eli';
export const LEVELS: LevelId[] = ['beg', 'nov', 'int', 'adv', 'eli'];

// --- Sport-classification tables. Row: [bwUpper, III, II, I, КМС, МС, МСМК] ---
type Row = [number, number, number, number, number, number, number];

const TOTAL_M: Row[] = [
  [52, 230, 265, 300, 340, 382.5, 435],
  [56, 250, 292.5, 325, 367.5, 415, 472.5],
  [60, 267.5, 307.5, 347.5, 395, 445, 505],
  [67.5, 297.5, 342.5, 387.5, 437.5, 492.5, 565],
  [75, 320, 367.5, 415, 475, 535, 612.5],
  [82.5, 337.5, 387.5, 437.5, 505, 572.5, 655],
  [90, 352.5, 405, 457.5, 517.5, 595, 667.5],
  [100, 365, 422.5, 477.5, 540, 617.5, 695],
  [110, 377.5, 435, 492.5, 555, 637.5, 717.5],
  [125, 400, 457.5, 515, 582.5, 660, 740],
  [140, 410, 467.5, 527.5, 595, 675, 760],
  [999, 425, 480, 540, 610, 697.5, 777.5],
];
const TOTAL_F: Row[] = [
  [44, 120, 140, 160, 182.5, 215, 245],
  [48, 132.5, 155, 180, 225, 245, 272.5],
  [52, 150, 180, 220, 242.5, 267.5, 307.5],
  [56, 175, 200, 230, 265, 285, 332.5],
  [60, 195, 210, 240, 270, 300, 340],
  [67.5, 200, 225, 250, 285, 330, 360],
  [75, 210, 230, 265, 300, 345, 395],
  [82.5, 235, 250, 290, 320, 360, 412.5],
  [90, 245, 260, 300, 332.5, 380, 427.5],
  [100, 250, 280, 320, 360, 405, 445],
  [999, 265, 300, 340, 380, 425, 465],
];
const SQUAT_M: Row[] = [
  [52, 87.5, 102.5, 112.5, 130, 150, 172.5],
  [56, 95, 112.5, 122.5, 140, 160, 185],
  [60, 102.5, 117.5, 130, 147.5, 170, 197.5],
  [67.5, 112.5, 132.5, 145, 160, 190, 217.5],
  [75, 127.5, 147.5, 160, 182.5, 207.5, 237.5],
  [82.5, 132.5, 155, 167.5, 190, 220, 250],
  [90, 140, 162.5, 177.5, 202.5, 230, 262.5],
  [100, 147.5, 170, 185, 210, 240, 275],
  [110, 157.5, 180, 195, 220, 252.5, 287.5],
  [125, 165, 190, 205, 230, 262.5, 300],
  [140, 170, 195, 210, 237.5, 270, 307.5],
  [999, 175, 200, 215, 242.5, 275, 315],
];
const SQUAT_F: Row[] = [
  [44, 47.5, 57.5, 65, 72.5, 87.5, 102.5],
  [48, 50, 62.5, 70, 85, 97.5, 115],
  [52, 55, 70, 77.5, 90, 105, 125],
  [56, 60, 75, 85, 97.5, 112.5, 135],
  [60, 65, 80, 90, 102.5, 120, 140],
  [67.5, 70, 87.5, 97.5, 110, 130, 150],
  [75, 75, 92.5, 102.5, 115, 137.5, 162.5],
  [82.5, 80, 97.5, 107.5, 125, 145, 167.5],
  [90, 85, 102.5, 112.5, 130, 150, 175],
  [999, 90, 107.5, 117.5, 135, 155, 180],
];
const BENCH_M: Row[] = [
  [44, 42.5, 50, 62.5, 72.5, 82.5, 95],
  [48, 45, 55, 65, 75, 85, 100],
  [52, 52.5, 62.5, 72.5, 82.5, 92.5, 105],
  [56, 57.5, 67.5, 77.5, 87.5, 100, 115],
  [60, 65, 72.5, 82.5, 95, 110, 125],
  [67.5, 75, 85, 97.5, 110, 127.5, 147.5],
  [75, 85, 95, 110, 125, 137.5, 157.5],
  [82.5, 92.5, 102.5, 117.5, 132.5, 147.5, 167.5],
  [90, 100, 107.5, 125, 142.5, 155, 177.5],
  [100, 107.5, 112.5, 132.5, 150, 165, 187.5],
  [110, 115, 120, 140, 157.5, 172.5, 195],
  [125, 120, 125, 145, 162.5, 177.5, 202.5],
  [140, 125, 130, 150, 167.5, 185, 210],
  [999, 130, 135, 155, 175, 192.5, 217.5],
];
const BENCH_F: Row[] = [
  [44, 20, 25, 30, 37.5, 42.5, 50],
  [48, 25, 30, 35, 42.5, 47.5, 55],
  [52, 30, 35, 40, 47.5, 52.5, 62.5],
  [56, 35, 40, 45, 52.5, 57.5, 70],
  [60, 40, 45, 50, 57.5, 62.5, 75],
  [67.5, 45, 50, 55, 62.5, 67.5, 80],
  [75, 50, 55, 60, 67.5, 72.5, 85],
  [82.5, 55, 60, 65, 72.5, 77.5, 90],
  [90, 60, 65, 70, 77.5, 82.5, 95],
  [100, 65, 70, 75, 82.5, 87.5, 100],
  [999, 70, 77.5, 82.5, 90, 97.5, 107.5],
];
const DEAD_M: Row[] = [
  [44, 85, 95, 110, 120, 145, 175],
  [48, 90, 110, 115, 125, 150, 180],
  [52, 95, 105, 120, 135, 155, 185],
  [56, 105, 115, 130, 145, 165, 190],
  [60, 110, 120, 135, 152.5, 175, 200],
  [67.5, 125, 135, 150, 170, 195, 220],
  [75, 140, 150, 165, 182.5, 207.5, 237.5],
  [82.5, 147.5, 157.5, 172.5, 190, 220, 250],
  [90, 155, 165, 180, 202.5, 230, 262.5],
  [100, 167.5, 177.5, 192.5, 210, 240, 275],
  [110, 175, 185, 205, 215, 247.5, 282.5],
  [125, 195, 205, 220, 230, 260, 290],
  [140, 212.5, 220, 235, 245, 270, 300],
  [999, 225, 235, 250, 257.5, 287.5, 310],
];
const DEAD_F: Row[] = [
  [44, 55, 60, 65, 85, 100, 120],
  [48, 60, 65, 70, 90, 105, 125],
  [52, 70, 75, 75, 100, 110, 130],
  [56, 75, 80, 82.5, 105, 117.5, 145],
  [60, 80, 85, 90, 110, 125, 150],
  [67.5, 85, 87.5, 97.5, 112.5, 132.5, 160],
  [75, 87.5, 97.5, 110, 120, 142.5, 167.5],
  [82.5, 97.5, 105, 120, 130, 150, 175],
  [90, 110, 115, 125, 137.5, 160, 182.5],
  [100, 122.5, 127.5, 137.5, 150, 172.5, 190],
  [999, 137.5, 142.5, 152.5, 165, 187.5, 205],
];
const CURL_M: Row[] = [
  [52, 20, 25, 30, 35, 37.5, 40],
  [56, 25, 30, 35, 40, 42.5, 47.5],
  [60, 27.5, 35, 40, 45, 50, 55],
  [67.5, 32.5, 37.5, 45, 50, 56, 60],
  [75, 35, 40, 50, 55, 60, 67.5],
  [82.5, 37.5, 45, 52.5, 57.5, 65, 72.5],
  [90, 40, 47.5, 55, 62.5, 70, 77.5],
  [100, 45, 50, 57.5, 65, 72.5, 80],
  [110, 47.5, 52.5, 60, 67.5, 75, 82.5],
  [125, 50, 55, 62.5, 70, 80, 85],
  [140, 52.5, 60, 65, 75, 82.5, 87.5],
  [999, 56, 62, 69, 77, 85, 90],
];
const CURL_F: Row[] = [
  [44, 20, 20, 20, 20, 22.5, 25],
  [48, 25, 25, 25, 25, 27.5, 30],
  [52, 27.5, 27.5, 27.5, 27.5, 30, 32.5],
  [56, 20, 20, 25, 30, 32.5, 35],
  [60, 22.5, 22.5, 25, 32.5, 35, 37.5],
  [67.5, 20, 25, 27.5, 35, 37.5, 40],
  [75, 26, 26, 30, 35, 37.5, 42.5],
  [82.5, 24, 27.5, 32.5, 37.5, 42.5, 45],
  [90, 26, 30, 34, 40, 43, 46],
  [100, 28, 32, 36, 42, 45, 48],
  [999, 30, 34, 38, 44, 47, 50],
];

// --- Strength-level ratios (× bodyweight). [beg, nov, int, adv, eli] ---------
type Ratios = Record<Sex, [number, number, number, number, number]>;

// --- Canonical-name matchers -------------------------------------------------
const cn = (n: string) => canonicalExerciseName(n).toLowerCase();
const M = {
  squat: (n: string) => {
    const c = cn(n);
    return (
      c.includes('squat') &&
      (c.includes('barbell') || c.includes('full') || c.includes('back')) &&
      !c.includes('front') &&
      !c.includes('hack') &&
      !c.includes('split') &&
      !c.includes('goblet') &&
      !c.includes('bulgarian') &&
      !c.includes('sissy') &&
      !c.includes('overhead') &&
      !c.includes('jump')
    );
  },
  bench: (n: string) => {
    const c = cn(n);
    return (
      c.includes('bench press') &&
      !c.includes('incline') &&
      !c.includes('decline') &&
      !c.includes('dumbbell') &&
      !c.includes('close') &&
      !c.includes('smith')
    );
  },
  dead: (n: string) => {
    const c = cn(n);
    return (
      c.includes('deadlift') &&
      !c.includes('romanian') &&
      !c.includes('stiff') &&
      !c.includes('single') &&
      !c.includes('dumbbell') &&
      !c.includes('deficit') &&
      !c.includes('rack')
    );
  },
  curl: (n: string) => {
    const c = cn(n);
    return (
      c.includes('curl') &&
      (c.includes('barbell') || c.includes('ez') || c.includes('bicep')) &&
      !c.includes('leg') &&
      !c.includes('preacher') &&
      !c.includes('reverse') &&
      !c.includes('spider') &&
      !c.includes('hammer') &&
      !c.includes('wrist') &&
      !c.includes('concentration') &&
      !c.includes('cable')
    );
  },
  ohp: (n: string) => {
    const c = cn(n);
    return (
      (c.includes('overhead press') ||
        c.includes('military press') ||
        (c.includes('standing') && c.includes('shoulder press') && c.includes('barbell'))) &&
      !c.includes('dumbbell')
    );
  },
  row: (n: string) => {
    const c = cn(n);
    return (
      (c.includes('bent over') && c.includes('row')) ||
      (c.includes('barbell') &&
        c.includes('row') &&
        !c.includes('cable') &&
        !c.includes('upright') &&
        !c.includes('seated') &&
        !c.includes('dumbbell') &&
        !c.includes('t-bar'))
    );
  },
  frontSquat: (n: string) => cn(n).includes('front squat'),
  rdl: (n: string) => {
    const c = cn(n);
    return c.includes('romanian') || c.includes('stiff-leg') || c.includes('stiff leg');
  },
  inclineBar: (n: string) => {
    const c = cn(n);
    return (
      c.includes('incline') &&
      c.includes('bench press') &&
      !c.includes('dumbbell') &&
      !c.includes('smith')
    );
  },
  hipThrust: (n: string) => cn(n).includes('hip thrust'),
  dbBench: (n: string) => {
    const c = cn(n);
    return (
      c.includes('dumbbell') &&
      c.includes('bench press') &&
      !c.includes('incline') &&
      !c.includes('decline')
    );
  },
  inclineDb: (n: string) => {
    const c = cn(n);
    return (
      c.includes('incline') &&
      c.includes('dumbbell') &&
      (c.includes('press') || c.includes('bench'))
    );
  },
  dbShoulder: (n: string) => {
    const c = cn(n);
    return (
      c.includes('dumbbell') &&
      (c.includes('shoulder press') ||
        (c.includes('seated') && c.includes('press') && !c.includes('bench')))
    );
  },
  latPulldown: (n: string) => cn(n).includes('pulldown'),
  legPress: (n: string) => cn(n).includes('leg press'),
  closeGrip: (n: string) => {
    const c = cn(n);
    return (c.includes('close-grip') || c.includes('close grip')) && c.includes('bench');
  },
  lateralRaise: (n: string) => {
    const c = cn(n);
    return c.includes('lateral raise') || c.includes('side lateral');
  },
  legExt: (n: string) => cn(n).includes('leg extension'),
  legCurl: (n: string) => cn(n).includes('leg curl'),
  cableRow: (n: string) => {
    const c = cn(n);
    return c.includes('cable row') && (c.includes('seated') || true) && !c.includes('upright');
  },
};

export interface Discipline {
  key: string;
  name: string;
  desc: string;
  system: System;
  match?: (n: string) => boolean; // absent for composite 'total'
  composite?: boolean;
  tables?: Record<Sex, Row[]>; // rank system
  ratios?: Ratios; // level system
}

export const DISCIPLINES: Discipline[] = [
  // --- Sport classification (розряди) ---
  {
    key: 'total',
    name: 'Powerlifting total',
    desc: 'Squat + bench + deadlift — your best in each, summed (троєборство).',
    system: 'rank',
    composite: true,
    tables: { M: TOTAL_M, F: TOTAL_F },
  },
  {
    key: 'squat',
    name: 'Squat',
    desc: 'Barbell back squat — raw classification (присідання).',
    system: 'rank',
    match: M.squat,
    tables: { M: SQUAT_M, F: SQUAT_F },
  },
  {
    key: 'bench',
    name: 'Bench press',
    desc: 'Flat barbell bench press — raw classification (жим лежачи).',
    system: 'rank',
    match: M.bench,
    tables: { M: BENCH_M, F: BENCH_F },
  },
  {
    key: 'deadlift',
    name: 'Deadlift',
    desc: 'Barbell deadlift — raw classification (станова тяга).',
    system: 'rank',
    match: M.dead,
    tables: { M: DEAD_M, F: DEAD_F },
  },
  {
    key: 'strictCurl',
    name: 'Strict curl',
    desc: 'Standing barbell biceps curl — raw classification (підйом на біцепс).',
    system: 'rank',
    match: M.curl,
    tables: { M: CURL_M, F: CURL_F },
  },
  // --- Strength level (Beginner → Elite) ---
  {
    key: 'ohp',
    name: 'Overhead press',
    desc: 'Standing barbell shoulder press.',
    system: 'level',
    match: M.ohp,
    ratios: { M: [0.42, 0.59, 0.78, 1.0, 1.23], F: [0.2, 0.33, 0.52, 0.72, 0.95] },
  },
  {
    key: 'row',
    name: 'Barbell row',
    desc: 'Bent-over barbell row.',
    system: 'level',
    match: M.row,
    ratios: { M: [0.62, 0.83, 1.1, 1.39, 1.71], F: [0.3, 0.48, 0.72, 0.98, 1.3] },
  },
  {
    key: 'frontSquat',
    name: 'Front squat',
    desc: 'Barbell front squat.',
    system: 'level',
    match: M.frontSquat,
    ratios: { M: [0.76, 1.0, 1.29, 1.62, 1.97], F: [0.52, 0.73, 1.0, 1.32, 1.65] },
  },
  {
    key: 'rdl',
    name: 'Romanian deadlift',
    desc: 'Barbell Romanian / stiff-leg deadlift.',
    system: 'level',
    match: M.rdl,
    ratios: { M: [0.83, 1.16, 1.54, 1.99, 2.46], F: [0.52, 0.78, 1.12, 1.5, 1.93] },
  },
  {
    key: 'inclineBar',
    name: 'Incline bench',
    desc: 'Incline barbell bench press.',
    system: 'level',
    match: M.inclineBar,
    ratios: { M: [0.64, 0.84, 1.09, 1.36, 1.63], F: [0.23, 0.42, 0.65, 0.93, 1.27] },
  },
  {
    key: 'closeGrip',
    name: 'Close-grip bench',
    desc: 'Close-grip barbell bench press.',
    system: 'level',
    match: M.closeGrip,
    ratios: { M: [0.71, 0.92, 1.17, 1.43, 1.72], F: [0.33, 0.52, 0.77, 1.05, 1.37] },
  },
  {
    key: 'hipThrust',
    name: 'Hip thrust',
    desc: 'Barbell hip thrust.',
    system: 'level',
    match: M.hipThrust,
    ratios: { M: [0.76, 1.23, 1.87, 2.62, 3.46], F: [0.58, 1.05, 1.67, 2.45, 3.32] },
  },
  {
    key: 'legPress',
    name: 'Leg press',
    desc: 'Machine leg press (sled).',
    system: 'level',
    match: M.legPress,
    ratios: { M: [1.41, 2.04, 2.83, 3.76, 4.77], F: [0.82, 1.45, 2.33, 3.4, 4.62] },
  },
  {
    key: 'legExt',
    name: 'Leg extension',
    desc: 'Machine leg extension.',
    system: 'level',
    match: M.legExt,
    ratios: { M: [0.59, 0.88, 1.23, 1.66, 2.12], F: [0.37, 0.63, 0.98, 1.43, 1.92] },
  },
  {
    key: 'legCurl',
    name: 'Leg curl',
    desc: 'Machine leg curl.',
    system: 'level',
    match: M.legCurl,
    ratios: { M: [0.49, 0.71, 1.0, 1.33, 1.69], F: [0.32, 0.52, 0.78, 1.12, 1.47] },
  },
  {
    key: 'latPulldown',
    name: 'Lat pulldown',
    desc: 'Cable lat pulldown.',
    system: 'level',
    match: M.latPulldown,
    ratios: { M: [0.58, 0.78, 1.02, 1.29, 1.58], F: [0.38, 0.55, 0.77, 1.0, 1.27] },
  },
  {
    key: 'cableRow',
    name: 'Seated cable row',
    desc: 'Seated cable row.',
    system: 'level',
    match: M.cableRow,
    ratios: { M: [0.59, 0.8, 1.07, 1.36, 1.67], F: [0.35, 0.53, 0.75, 1.03, 1.32] },
  },
  {
    key: 'dbBench',
    name: 'Dumbbell bench',
    desc: 'Flat dumbbell bench press (per dumbbell).',
    system: 'level',
    match: M.dbBench,
    ratios: { M: [0.24, 0.36, 0.49, 0.64, 0.82], F: [0.12, 0.2, 0.32, 0.47, 0.63] },
  },
  {
    key: 'inclineDb',
    name: 'Incline dumbbell press',
    desc: 'Incline dumbbell press (per dumbbell).',
    system: 'level',
    match: M.inclineDb,
    ratios: { M: [0.28, 0.37, 0.49, 0.61, 0.76], F: [0.12, 0.2, 0.32, 0.43, 0.58] },
  },
  {
    key: 'dbShoulder',
    name: 'Dumbbell shoulder press',
    desc: 'Seated/standing dumbbell shoulder press (per dumbbell).',
    system: 'level',
    match: M.dbShoulder,
    ratios: { M: [0.2, 0.28, 0.39, 0.51, 0.66], F: [0.1, 0.17, 0.25, 0.33, 0.45] },
  },
  {
    key: 'lateralRaise',
    name: 'Lateral raise',
    desc: 'Dumbbell lateral raise (per dumbbell).',
    system: 'level',
    match: M.lateralRaise,
    ratios: { M: [0.07, 0.12, 0.2, 0.3, 0.41], F: [0.05, 0.1, 0.15, 0.22, 0.28] },
  },
];

function bestFor(workouts: Workout[], match: (n: string) => boolean): number {
  let best = 0;
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (!isStrengthExercise(ex) || !match(ex.name)) continue;
      for (const s of ex.sets) {
        if (setTypeOf(s) === 'warmup') continue;
        best = Math.max(best, est1rm(s.weight ?? 0, s.reps));
      }
    }
  }
  return best;
}

function pickRow(table: Row[], bw: number): Row {
  return table.find((r) => bw <= r[0]) ?? table[table.length - 1];
}
function classLabel(table: Row[], row: Row): string {
  if (row[0] < 999) return `${row[0]}`;
  const prev = table[table.length - 2];
  return prev ? `${prev[0]}+` : '';
}
const round25 = (x: number) => Math.round(x / 2.5) * 2.5;

export interface DiscResult {
  key: string;
  name: string;
  desc: string;
  system: System;
  tierIds: string[]; // RankId[] or LevelId[]
  thresholds: number[];
  trained: boolean;
  best: number;
  classLabel: string; // rank only
  achievedIdx: number; // -1 = below first tier
  nextIdx: number | null;
  toGo: number | null;
  progress: number;
}

export interface StandardsResult {
  bodyKg: number;
  results: DiscResult[];
}

export function computeStandards(finished: Workout[], bodyKg: number, sex: Sex): StandardsResult {
  const squat = bestFor(finished, M.squat);
  const bench = bestFor(finished, M.bench);
  const dead = bestFor(finished, M.dead);
  const bw = bodyKg > 0 ? bodyKg : 0;

  const results = DISCIPLINES.map((d): DiscResult => {
    let best = 0;
    let trained = false;
    if (d.composite) {
      trained = squat > 0 && bench > 0 && dead > 0;
      best = trained ? squat + bench + dead : 0;
    } else if (d.match) {
      best = bestFor(finished, d.match);
      trained = best > 0;
    }

    let thresholds: number[];
    let classLbl = '';
    let tierIds: string[];
    if (d.system === 'rank' && d.tables) {
      const table = d.tables[sex];
      const row = pickRow(table, bw > 0 ? bw : table[Math.floor(table.length / 2)][0]);
      thresholds = row.slice(1) as number[];
      classLbl = classLabel(table, row);
      tierIds = RANKS;
    } else {
      const refBw = bw > 0 ? bw : sex === 'F' ? 60 : 80;
      thresholds = (d.ratios![sex] as number[]).map((r) => round25(r * refBw));
      tierIds = LEVELS;
    }

    let achievedIdx = -1;
    for (let i = 0; i < thresholds.length; i++) if (best >= thresholds[i]) achievedIdx = i;
    const nextIdx = achievedIdx < tierIds.length - 1 ? achievedIdx + 1 : null;
    const toGo = nextIdx != null ? Math.max(0, thresholds[nextIdx] - best) : null;
    const bandLo = achievedIdx >= 0 ? thresholds[achievedIdx] : 0;
    const bandHi = nextIdx != null ? thresholds[nextIdx] : thresholds[thresholds.length - 1];
    const progress =
      nextIdx != null ? Math.max(0, Math.min(1, (best - bandLo) / (bandHi - bandLo || 1))) : 1;

    return {
      key: d.key,
      name: d.name,
      desc: d.desc,
      system: d.system,
      tierIds,
      thresholds,
      trained,
      best,
      classLabel: classLbl,
      achievedIdx,
      nextIdx,
      toGo,
      progress,
    };
  });

  return { bodyKg: bw, results };
}
