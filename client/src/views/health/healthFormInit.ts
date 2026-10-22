/* Initial field values of the Health form (pure). Leaf module. */
import type { HealthFormSpec } from '../../health';
import { bodyPart as findBodyPart } from '../../injury';
import type { IllnessKind, Injury, InjurySide, RestPeriod } from '../../types';
import type { HealthType } from './parts';

export type Expand = 'start' | 'end' | 'type' | null;

export interface Init {
  type: HealthType;
  name: string;
  start: number;
  end: number;
  open: boolean;
  expand: Expand;
  part: string | null;
  side: InjurySide;
  healed: boolean;
  healedDay: number;
  kind: IllnessKind;
}

export function initialState(
  spec: HealthFormSpec,
  period: RestPeriod | null,
  inj: Injury | null,
  today: number,
): Init {
  const base: Init = {
    type: 'off',
    name: '',
    start: today,
    end: today,
    open: false,
    expand: null,
    part: null,
    side: 'left',
    healed: false,
    healedDay: today,
    kind: 'cold',
  };
  if (spec.kind === 'edit' && period) {
    return {
      ...base,
      type: period.mode,
      name: period.name ?? '',
      kind: period.illnessKind ?? 'other',
      start: period.startDay,
      end: period.open ? Math.max(today, period.startDay) : period.endDay,
      open: period.open === true,
    };
  }
  if (spec.kind === 'edit-injury' && inj) {
    return {
      ...base,
      type: 'injury',
      start: inj.startDay,
      part: inj.bodyPart && findBodyPart(inj.bodyPart) ? inj.bodyPart : null,
      side: inj.side ?? 'left',
      healed: inj.healedDay != null,
      healedDay: inj.healedDay ?? today,
    };
  }
  if (spec.kind !== 'new') return base;
  if (spec.type === 'injury') return { ...base, type: 'injury' };
  if (spec.ctx === 'start') {
    if (spec.type === 'illness') return { ...base, type: 'illness', expand: null };
    return { ...base, type: spec.type, end: today + 6, expand: 'end' };
  }
  return { ...base, type: spec.type, start: today - 1, end: today - 1, expand: 'start' };
}
