import type { Tone } from '../../../components/ui/tones';
import type { OutcomeResult } from '../../domain/decisions';
import type { SignalKind } from '../../domain/types';

export type Filter = 'all' | OutcomeResult;
export type Range = 'all' | '30' | '90';
export const FILTERS: Filter[] = ['all', 'improved', 'measuring', 'declined', 'no-clear-change'];
export const KINDS: SignalKind[] = [
  'stall',
  'rhythm',
  'injury',
  'machine',
  'spike',
  'ready',
  'pr',
  'nodata',
];
export const PAGE = 12;

/** One colour per outcome, shared by the stacked bar and its legend. */
export const OUTCOME_TONE: Record<OutcomeResult, Tone> = {
  improved: 'ok',
  'no-clear-change': 'neutral',
  declined: 'danger',
  measuring: 'rest',
};
