/**
 * Boot of the Periodization chunk: puts its pieces into the core's `periodizationHost`, starts the sync of the typed maxes and
 * announces it is ready. Imported lazily (and only) by `addons/useAddonRuntime.ts` while the module is installed.
 */
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { periodizationHost } from '../periodizationApi';
import { provide, trackerReady } from '../trackerRt';
import { activeWeekPlan, cycleNote, loadKg, repsLabel, repsMinOf } from './cycle';
import { cloneCycle, rowExtras, sanitizeCycle } from './cycleData';
import { EDITOR_STRINGS } from './editor/editorStrings';
import { CycleWrap, RowLoad, RowReps, WeekBar } from './editor/CycleEditor';
import { maxFor } from './maxes';
import { MaxesPage } from './MaxesPage';
import { getTypedMaxes, startMaxesSync } from './maxesSync';
import { STRINGS } from './strings';
import { TargetLine } from './TargetLine';

provide(periodizationHost, {
  maxFor,
  weekPlan: activeWeekPlan,
  sanitizeCycle,
  cloneCycle,
  rowExtras,
  load: loadKg,
  repsLabel,
  repsMin: repsMinOf,
  TargetLine,
  cycleNote: (p, week, locale) => {
    const w = EDITOR_STRINGS[locale];
    return cycleNote(p, week, {
      cycleAt: w.cycleAt,
      labels: { deload: w.deload, test: w.test, peak: w.peak },
    });
  },
  editorSlots: { wrap: CycleWrap, weekBar: WeekBar, rowLoad: RowLoad, rowReps: RowReps },
  MaxesPage,
  moreItem: (locale, open) => ({
    id: 'maxes',
    icon: 'barbell',
    label: STRINGS[locale].name,
    onSelect: open,
  }),
  exportFiles: () => [
    {
      name: 'maxes.json',
      about: 'The maxes you typed, per exercise (kg).',
      content: { kind: 'json', value: getTypedMaxes() },
      rows: Object.keys(getTypedMaxes().maxes).length,
    },
  ],
});
trackerReady('periodization');

// The listener follows the signed-in person.
let stop: (() => void) | undefined;
onAuthStateChanged(auth, (u) => {
  stop?.();
  stop = u ? startMaxesSync(u.uid) : undefined;
});
