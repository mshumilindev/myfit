import { useCallback, useMemo, useReducer } from 'react';

/** One prompt of a multi-step red action. Only the LAST step may ask for a typed word. */
export interface ConfirmStepDef {
  id: string;
  /** The word that must be typed before this step can continue (compared trimmed, ignoring case). */
  typeWord?: string;
}

export interface StepConfirmState {
  index: number;
  typed: string;
  done: boolean;
}

export type StepConfirmAction =
  { type: 'type'; value: string } | { type: 'next' } | { type: 'reset' };

export const MAX_CONFIRM_STEPS = 3;

/** Programmer error guard: 1..3 steps, a typed word only on the last. */
export function assertSteps(steps: readonly ConfirmStepDef[]): void {
  if (steps.length < 1 || steps.length > MAX_CONFIRM_STEPS) {
    throw new RangeError(`a red action takes 1..${MAX_CONFIRM_STEPS} steps, got ${steps.length}`);
  }
  steps.forEach((s, i) => {
    if (s.typeWord != null && i !== steps.length - 1) {
      throw new RangeError(`only the last step may ask for a typed word (step ${s.id})`);
    }
    if (s.typeWord != null && s.typeWord.trim() === '') {
      throw new RangeError(`typed word of step ${s.id} is empty`);
    }
  });
}

export const initialStepConfirm: StepConfirmState = { index: 0, typed: '', done: false };

export function typedMatches(word: string, typed: string): boolean {
  return typed.trim().toLowerCase() === word.trim().toLowerCase();
}

/** The current step's button is enabled: no word needed, or the typed text matches it. */
export function canAdvance(steps: readonly ConfirmStepDef[], s: StepConfirmState): boolean {
  if (s.done) return false;
  const word = steps[s.index]?.typeWord;
  return word == null || typedMatches(word, s.typed);
}

/** Pure state machine: `next` moves on only when `canAdvance`; past the last step it sets `done` (confirm). */
export function stepConfirmReducer(
  steps: readonly ConfirmStepDef[],
  s: StepConfirmState,
  a: StepConfirmAction,
): StepConfirmState {
  switch (a.type) {
    case 'type':
      return s.done ? s : { ...s, typed: a.value };
    case 'next':
      if (!canAdvance(steps, s)) return s;
      return s.index >= steps.length - 1
        ? { ...s, done: true }
        : { index: s.index + 1, typed: '', done: false };
    case 'reset':
      return initialStepConfirm;
  }
}

export interface StepConfirm {
  step: ConfirmStepDef;
  index: number;
  count: number;
  isLast: boolean;
  typed: string;
  setTyped: (v: string) => void;
  canAdvance: boolean;
  /** Advance; `true` only when this call completed the last step (run the red action then). */
  next: () => boolean;
  reset: () => void;
}

/** State of a 1..3 step red-action confirmer; the dialog is `StepConfirmDialog`. */
export function useStepConfirm(steps: readonly ConfirmStepDef[]): StepConfirm {
  assertSteps(steps);
  const [state, dispatch] = useReducer(
    (s: StepConfirmState, a: StepConfirmAction) => stepConfirmReducer(steps, s, a),
    initialStepConfirm,
  );
  const ok = canAdvance(steps, state);
  const last = state.index === steps.length - 1;
  const next = useCallback((): boolean => {
    if (!ok) return false;
    dispatch({ type: 'next' });
    return last;
  }, [ok, last]);
  const setTyped = useCallback((value: string) => dispatch({ type: 'type', value }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);
  return useMemo(
    () => ({
      step: steps[state.index],
      index: state.index,
      count: steps.length,
      isLast: last,
      typed: state.typed,
      setTyped,
      canAdvance: ok,
      next,
      reset,
    }),
    [steps, state.index, state.typed, last, ok, next, setTyped, reset],
  );
}
