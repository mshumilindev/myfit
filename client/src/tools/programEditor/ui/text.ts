/** Small pure text helpers the screens share (the words come from the host's labels). */
import { isBare, type ProgramItemDoc } from '../model/doc';
import type { ProgramEditorLabels } from '../labels';

export const fmtRest = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** "60 kg . RPE 8" (empty when the row carries no target). */
export function targetText(it: ProgramItemDoc, p: ProgramEditorLabels): string {
  if (it.kind !== 'strength' || isBare(it)) return '';
  return [
    it.targetWeight ? `${it.targetWeight} kg` : '',
    it.targetRpe ? p.edPrevRpe(it.targetRpe) : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export const repsText = (it: ProgramItemDoc): string =>
  it.kind !== 'strength' || isBare(it) ? '' : `${it.sets} × ${it.reps}`;

/** The strip a client sees above the set: "3 x 6 . 60 kg . RPE 8 . rest 2:30". */
export function stripText(it: ProgramItemDoc, p: ProgramEditorLabels): string {
  if (it.kind !== 'strength' || isBare(it)) return '';
  return [
    repsText(it),
    it.targetWeight ? `${it.targetWeight} kg` : '',
    it.targetRpe ? p.edPrevRpe(it.targetRpe) : '',
    it.restSec ? p.edPrevRest(fmtRest(it.restSec)) : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Prescription line for a phone row: "3 x 6 . target 60 kg . RPE 8", or the quiet bare line. */
export function prescriptionLine(it: ProgramItemDoc, p: ProgramEditorLabels): string {
  if (isBare(it)) return p.edNoSetsYet;
  const t = targetText(it, p);
  return t ? `${repsText(it)} · ${p.edTargetWord} ${t}` : repsText(it);
}

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;
