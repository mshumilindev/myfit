/**
 * "Check before sending" for the Coach: the engine lives in the program editor tool (`tools/programEditor/check`); this
 * file feeds it the Coach catalog and turns the client's injury consent into the restrictions the tool may read.
 * Same names and shapes as before, so the draft store, the screens and their tests did not change.
 */
import {
  pushPull as toolPushPull,
  restrictionConflicts,
  runCheck as toolRunCheck,
  weeklyVolume as toolWeeklyVolume,
  withoutPicture as toolWithoutPicture,
  type Check,
} from '../../tools/programEditor';
import type { Program } from '../../views/programs/model';
import type { Level } from '../domain/types';
import { coachCheckEnv, toDoc } from './toolHostBase';

export {
  CARDIO_BAND,
  FIX_BELOW,
  MUSCLE_BAND,
  RANGE_GROUPS,
  restrictionConflicts,
  type Check,
  type Finding,
  type FindingKind,
  type MuscleVolume,
  type RangeGroup,
  type RangeState,
  type Sev,
} from '../../tools/programEditor';

export interface CheckContext {
  /** The level the client shares injuries at. Off = restrictions are not checked. */
  injury: Level;
  /** Restrictions the client declared (only read when `injury` is not off). */
  restrictions: readonly string[];
}

/** The restrictions the tool may read: only the ones the client SHARED (injury consent not off). */
export const sharedRestrictions = (ctx: CheckContext): readonly string[] =>
  ctx.injury === 'off' ? [] : ctx.restrictions;

export function runCheck(p: Program, ctx: CheckContext): Check {
  return toolRunCheck(toDoc(p), coachCheckEnv(sharedRestrictions(ctx)));
}
export const weeklyVolume = (p: Program) => toolWeeklyVolume(toDoc(p), coachCheckEnv());
export const pushPull = (p: Program) => toolPushPull(toDoc(p), coachCheckEnv());
export const withoutPicture = (p: Program) => toolWithoutPicture(toDoc(p), coachCheckEnv());
void restrictionConflicts;
