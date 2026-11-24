/**
 * Boot of the RPE / RIR chunk: puts its pieces into the core's `effortHost` and announces it is ready. Imported lazily (and only)
 * by `addons/useAddonRuntime.ts` while the module is installed.
 */
import { effortHost } from '../effortApi';
import { provide, trackerReady } from '../trackerRt';
import { RowRpe } from './RowRpe';
import { CardioStepper, Chips, EffortHint, EffortTag, Label } from './pieces';

provide(effortHost, {
  Chips,
  Label,
  Hint: EffortHint,
  Tag: EffortTag,
  CardioStepper,
  editorSlots: { rowRpe: RowRpe },
});
trackerReady('effort');
