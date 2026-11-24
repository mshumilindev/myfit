/**
 * The seam between the core and RPE / RIR (Advanced training): the effort entry. The core keeps no chips, hint or pill for it:
 * they live in the lazy chunk `effort/` and arrive through `effortHost` when it loads (`effort/effortBoot.ts`). While the module
 * is off (or its chunk has not arrived) nothing asks for or shows an effort. The app's own estimate (`rpe.ts`) is NOT changed:
 * rest, failure and the coach signals keep reading it, and stored values pass through a save untouched.
 * Imports stay light (types and the gate) so core modules can use this file.
 */
import type { ComponentType } from 'react';
import type { WidgetSize } from './components/ui/Widget';
import type { LocaleId } from './i18n';
import type { EditorSlots } from './tools/programEditor/host';
import { effortAvailable } from './addons/featureGates';

export interface EffortTrendRow {
  rpe: number;
  /** "Mon · Push day". */
  label: string;
}

/** What the Today shell passes to the Effort trend widget body. */
export interface EffortTrendProps {
  size: WidgetSize;
  locale: LocaleId;
  /** Newest first, at most 10. */
  rows: EffortTrendRow[];
  zone: { lo: number; hi: number };
  onOpen: () => void;
}

export interface EffortHost {
  /** The body of the Effort trend widget on Today. */
  TrendWidget: ComponentType<EffortTrendProps> | null;
  /** The 6–10 effort chips of the set editor (inside the effort row, before the failure chip). */
  Chips: ComponentType<{ rpe: number; failOn: boolean; onPick: (v: number) => void }> | null;
  /** The heading of the effort card. */
  Label: ComponentType | null;
  /** The line under the chips: what the value means, or the app's estimate. */
  Hint: ComponentType<{ rpe: number; est: number | null }> | null;
  /** The effort pill on a set row: the rated value, else the dashed estimate. */
  Tag: ComponentType<{ rpe: number | null; est: number | null }> | null;
  /** What the program editor adds for it: the target-effort stepper of a row. */
  editorSlots: Pick<EditorSlots, 'rowRpe'> | null;
  /** The effort stepper of a cardio set. */
  CardioStepper: ComponentType<{ value: number; onChange: (n: number) => void }> | null;
}

export const effortHost: EffortHost = {
  TrendWidget: null,
  Chips: null,
  Label: null,
  Hint: null,
  Tag: null,
  editorSlots: null,
  CardioStepper: null,
};

/** Is the module installed AND its chunk loaded? */
export function effortLive(): boolean {
  return effortAvailable() && effortHost.Chips !== null;
}
