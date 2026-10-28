import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeTw,
  reconcileTwBundle,
  reconcileTwPref,
  readTwAt,
  stampTw,
  applyTwRemote,
  onTwEdit,
  emitTwEdit,
  subscribeTwLocal,
  TW_SEALED_IDS,
} from './widgetSync';

describe('widget values synced to the account (SPO-388)', () => {
  beforeEach(() => localStorage.clear());

  it('keeps only well-formed values for each widget', () => {
    expect(normalizeTw('weekly-goal', 4)).toBe(4);
    expect(normalizeTw('weekly-goal', null)).toBeNull();
    expect(normalizeTw('weekly-goal', 'x')).toBeUndefined();
    expect(normalizeTw('weekly-goal', 99)).toBeUndefined();
    expect(normalizeTw('rep-prs', 'Barbell Squat')).toBe('Barbell Squat');
    expect(normalizeTw('rep-prs', 5)).toBeUndefined();
    expect(
      normalizeTw('one-rm-calc', { weight: 100, reps: 5, lift: 'bench', label: null }),
    ).toEqual({ weight: 100, reps: 5, lift: 'bench', label: null });
    expect(normalizeTw('one-rm-calc', { weight: 'x' })).toBeUndefined();
    expect(normalizeTw('pr-forecast', { squat: 140, bad: 'x' })).toEqual({ squat: 140 });
    const lr = [{ name: 'Row', l: 30, r: 28, at: 5 }, { name: 1 }, null];
    expect(normalizeTw('lr-balance', lr)).toEqual([{ name: 'Row', l: 30, r: 28, at: 5 }]);
    expect(normalizeTw('unknown', 1)).toBeUndefined();
  });

  it('weekly goal: newer wins, a missing account value is filled from the device', () => {
    expect(reconcileTwPref(0, null)).toEqual({});
    expect(reconcileTwPref(10, null)).toEqual({ push: true });
    expect(reconcileTwPref(10, 20)).toEqual({ apply: true });
    expect(reconcileTwPref(30, 20)).toEqual({ push: true });
    expect(reconcileTwPref(20, 20)).toEqual({});
  });

  it('bundle: applies newer remote entries, pushes when the device is ahead or the account lacks one', () => {
    const local = { 'rep-prs': 10, 'lr-balance': 50 };
    const d = reconcileTwBundle(local, {
      values: {
        'rep-prs': 'Bench',
        'lr-balance': [],
        'one-rm-calc': { weight: 80, reps: 5, lift: null, label: null },
      },
      at: { 'rep-prs': 20, 'lr-balance': 40, 'one-rm-calc': 5 },
    });
    expect(Object.keys(d.apply).sort()).toEqual(['one-rm-calc', 'rep-prs']);
    expect(d.apply['rep-prs']).toEqual({ value: 'Bench', at: 20 });
    expect(d.push).toBe(true); // lr-balance is newer here
    expect(reconcileTwBundle({}, null)).toEqual({ apply: {}, push: false });
    expect(reconcileTwBundle({ 'rep-prs': 3 }, null).push).toBe(true);
  });

  it('bundle: a bad remote value is ignored, not applied', () => {
    const d = reconcileTwBundle({}, { values: { 'rep-prs': 5 }, at: { 'rep-prs': 9 } });
    expect(d.apply).toEqual({});
  });

  it('stamps are stored apart and applying a remote value updates the local key and subscribers', () => {
    const seen = vi.fn();
    const off = subscribeTwLocal(seen);
    stampTw('rep-prs', 7);
    expect(readTwAt()['rep-prs']).toBe(7);
    applyTwRemote('rep-prs', 'Bench', 99);
    expect(JSON.parse(localStorage.getItem('spotter.tw.rep-prs')!)).toBe('Bench');
    expect(readTwAt()['rep-prs']).toBe(99);
    expect(seen).toHaveBeenCalled();
    off();
  });

  it('edit listeners hear only synced widgets', () => {
    const fn = vi.fn();
    const off = onTwEdit(fn);
    emitTwEdit('weekly-goal', 3, 1);
    emitTwEdit('rest-timer', { a: 1 }, 1);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    expect(TW_SEALED_IDS).toContain('lr-balance');
  });
});
