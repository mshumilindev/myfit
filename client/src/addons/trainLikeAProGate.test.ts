import { beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { addonsPref } from './enabledSet';
import { trainLikeAProAvailable } from './featureGates';
import { addonById } from './manifest';
import { EXCLUSION } from './exclusion';
import { trainLikeAProHost, useTrainLikeAProHost } from '../trainLikeAProRt';
import { trackerReady } from '../trackerRt';

beforeEach(() => {
  cleanup();
  addonsPref.reset();
});

describe('Train like a pro add-on gate (SPO-307)', () => {
  it('is an add-on of Gym for every role that has Gym, in the manifest and the exclusion contract', () => {
    const a = addonById('train-like-a-pro');
    expect(a?.kind).toBe('addon');
    expect(a?.requires).toBe('gym');
    expect(a?.roles).toEqual(['member', 'trainer', 'admin']);
    expect(EXCLUSION['train-like-a-pro']?.via).toContain('gate');
  });
  it('is off until installed (nothing of it may show)', () => {
    expect(trainLikeAProAvailable()).toBe(false);
  });
  it('turns on when installed and off again when removed', () => {
    addonsPref.set(['train-like-a-pro']);
    expect(trainLikeAProAvailable()).toBe(true);
    addonsPref.reset();
    expect(trainLikeAProAvailable()).toBe(false);
  });
  it('gives the core no host while it is not installed, even after the chunk has loaded', () => {
    trackerReady('train-like-a-pro');
    const { result } = renderHook(() => useTrainLikeAProHost());
    expect(result.current).toBeNull();
  });
  it('gives the host once installed and the chunk is ready, and takes it away on removal', () => {
    trackerReady('train-like-a-pro');
    addonsPref.set(['train-like-a-pro']);
    const { result } = renderHook(() => useTrainLikeAProHost());
    expect(result.current).toBe(trainLikeAProHost);
    act(() => addonsPref.reset());
    expect(result.current).toBeNull();
  });
  it('is for member, trainer and admin once installed, and never for a manager', () => {
    trackerReady('train-like-a-pro');
    addonsPref.set(['gym', 'train-like-a-pro']);
    for (const role of ['member', 'trainer', 'admin']) {
      localStorage.setItem('spotter.role', role);
      expect(trainLikeAProAvailable(), role).toBe(true);
      const { result } = renderHook(() => useTrainLikeAProHost());
      expect(result.current, role).toBe(trainLikeAProHost);
      cleanup();
    }
    localStorage.setItem('spotter.role', 'manager');
    expect(trainLikeAProAvailable()).toBe(false);
    addonsPref.reset();
    for (const role of ['trainer', 'admin']) {
      localStorage.setItem('spotter.role', role);
      expect(trainLikeAProAvailable(), role).toBe(false);
    }
    localStorage.setItem('spotter.role', 'member');
  });
});
