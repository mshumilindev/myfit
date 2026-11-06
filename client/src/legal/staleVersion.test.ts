import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../api';
import { isStaleVersionRefusal, refreshBuildOnStale, resetStaleVersionGuard } from './staleVersion';

beforeEach(() => resetStaleVersionGuard());

describe('isStaleVersionRefusal', () => {
  it('is true only for a 400 whose message says stale-version', () => {
    expect(isStaleVersionRefusal(new HttpError(400, 'stale-version'))).toBe(true);
    expect(isStaleVersionRefusal(new HttpError(400, 'policy-ack: 400 stale-version'))).toBe(true);
  });
  it('is false for other refusals, other statuses and non-errors', () => {
    expect(isStaleVersionRefusal(new HttpError(400, 'bad-textHash'))).toBe(false);
    expect(isStaleVersionRefusal(new HttpError(500, 'stale-version'))).toBe(false);
    expect(isStaleVersionRefusal(new HttpError(409, 'duplicate'))).toBe(false);
    expect(isStaleVersionRefusal(new Error('stale-version'))).toBe(false);
    expect(isStaleVersionRefusal(null)).toBe(false);
    expect(isStaleVersionRefusal(undefined)).toBe(false);
  });
});

describe('refreshBuildOnStale', () => {
  it('asks for a newer build and returns the result', async () => {
    const update = vi.fn().mockResolvedValue('updated');
    await expect(refreshBuildOnStale(update)).resolves.toBe('updated');
    expect(update).toHaveBeenCalledTimes(1);
  });
  it('checks at most once per page load, so a refusal never turns into a loop', async () => {
    const update = vi.fn().mockResolvedValue('current');
    await expect(refreshBuildOnStale(update)).resolves.toBe('current');
    await expect(refreshBuildOnStale(update)).resolves.toBe('skipped');
    await expect(refreshBuildOnStale(update)).resolves.toBe('skipped');
    expect(update).toHaveBeenCalledTimes(1);
  });
  it('never throws: a failing check resolves "failed"', async () => {
    const update = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(refreshBuildOnStale(update)).resolves.toBe('failed');
  });
});
