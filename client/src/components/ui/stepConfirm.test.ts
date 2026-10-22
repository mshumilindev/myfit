import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  assertSteps,
  canAdvance,
  initialStepConfirm,
  stepConfirmReducer as reduce,
  typedMatches,
  useStepConfirm,
} from './stepConfirm';

const three = [{ id: 'a' }, { id: 'b' }, { id: 'c', typeWord: 'DELETE' }];

describe('step confirm state machine', () => {
  it('walks 1..3 and finishes only on the last step', () => {
    let s = initialStepConfirm;
    s = reduce(three, s, { type: 'next' });
    expect(s).toMatchObject({ index: 1, done: false });
    s = reduce(three, s, { type: 'next' });
    expect(s).toMatchObject({ index: 2, done: false });
    expect(canAdvance(three, s)).toBe(false);
    expect(reduce(three, s, { type: 'next' })).toBe(s);
    s = reduce(three, s, { type: 'type', value: ' delete ' });
    expect(canAdvance(three, s)).toBe(true);
    s = reduce(three, s, { type: 'next' });
    expect(s.done).toBe(true);
    expect(canAdvance(three, s)).toBe(false);
  });
  it('clears the typed text between steps and on reset', () => {
    const steps = [{ id: 'a' }, { id: 'b', typeWord: 'ok' }];
    let s = reduce(steps, initialStepConfirm, { type: 'type', value: 'zz' });
    s = reduce(steps, s, { type: 'next' });
    expect(s.typed).toBe('');
    s = reduce(steps, s, { type: 'type', value: 'ok' });
    expect(reduce(steps, s, { type: 'reset' })).toEqual(initialStepConfirm);
  });
  it('a wrong word keeps the button locked', () => {
    expect(typedMatches('DELETE', 'delet')).toBe(false);
    expect(typedMatches('DELETE', 'Delete')).toBe(true);
  });
  it('rejects 0 or 4 steps, a word before the last step, an empty word', () => {
    expect(() => assertSteps([])).toThrow(RangeError);
    expect(() => assertSteps([{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }])).toThrow(
      RangeError,
    );
    expect(() => assertSteps([{ id: '1', typeWord: 'x' }, { id: '2' }])).toThrow(RangeError);
    expect(() => assertSteps([{ id: '1', typeWord: ' ' }])).toThrow(RangeError);
    expect(() => assertSteps([{ id: '1' }])).not.toThrow();
  });
});

describe('useStepConfirm', () => {
  it('next() reports completion only for the last step', () => {
    const { result } = renderHook(() => useStepConfirm(three));
    expect(result.current).toMatchObject({ index: 0, count: 3, isLast: false });
    let r = false;
    act(() => void (r = result.current.next()));
    expect(r).toBe(false);
    act(() => void result.current.next());
    expect(result.current.isLast).toBe(true);
    act(() => void (r = result.current.next()));
    expect(r).toBe(false);
    act(() => result.current.setTyped('DELETE'));
    act(() => void (r = result.current.next()));
    expect(r).toBe(true);
    act(() => result.current.reset());
    expect(result.current.index).toBe(0);
  });
});
