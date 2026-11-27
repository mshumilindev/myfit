import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from '../../addons/enabledSet';
import '../../timeBlocks/timeBlocksBoot';
import { useCoachEditorHost } from './toolHost';

beforeEach(() => addonsPref.set(['advanced-training', 'time-blocks']));
afterEach(() => addonsPref.reset());

describe('the trainer program editor offers Time blocks (SPO-608, phase 2)', () => {
  it('has the dayBlocks slot while the module is installed, and none without it', () => {
    const on = renderHook(() => useCoachEditorHost());
    expect(on.result.current.slots?.dayBlocks).toBeTypeOf('function');
    on.unmount();
    addonsPref.set([]);
    const off = renderHook(() => useCoachEditorHost());
    expect(off.result.current.slots?.dayBlocks).toBeUndefined();
  });
});
