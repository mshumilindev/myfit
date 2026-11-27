import { describe, expect, it } from 'vitest';
import { MARKER, syncProgress } from '../scripts/lib/wf-linear.mjs';

type Call = { query: string; headers: Record<string, string> };

function fakeFetch(comments: { id: string; body: string }[], calls: Call[]) {
  return async (_url: string, init: { body: string; headers: Record<string, string> }) => {
    const { query } = JSON.parse(init.body);
    calls.push({ query, headers: init.headers });
    const data = query.includes('issue(id')
      ? { issue: { id: 'uuid-1', comments: { nodes: comments } } }
      : { ok: { success: true } };
    return { ok: true, status: 200, json: async () => ({ data }) };
  };
}

describe('wf-linear syncProgress', () => {
  it('skips quietly without a key and makes no request', async () => {
    const calls: Call[] = [];
    const r = await syncProgress({
      task: 'SPO-639',
      report: 'x',
      env: {},
      fetchImpl: fakeFetch([], calls) as never,
    });
    expect(r).toBe('skipped-no-key');
    expect(calls).toHaveLength(0);
  });

  it('creates the pinned comment when none exists', async () => {
    const calls: Call[] = [];
    const r = await syncProgress({
      task: 'SPO-639',
      report: 'r',
      env: { LINEAR_API_KEY: 'test-key' },
      fetchImpl: fakeFetch([{ id: 'c0', body: 'other' }], calls) as never,
    });
    expect(r).toBe('created');
    expect(calls[1].query).toContain('commentCreate');
    expect(calls[1].headers.Authorization).toBe('test-key');
  });

  it('updates the existing marked comment instead of adding a new one', async () => {
    const calls: Call[] = [];
    const r = await syncProgress({
      task: 'SPO-639',
      report: 'r',
      env: { LINEAR_API_KEY: 'test-key' },
      fetchImpl: fakeFetch([{ id: 'c9', body: `${MARKER}\nold` }], calls) as never,
    });
    expect(r).toBe('updated');
    expect(calls[1].query).toContain('commentUpdate');
  });

  it('never puts the key into a thrown error', async () => {
    const bad = async () => ({ ok: false, status: 401, json: async () => ({}) });
    await expect(
      syncProgress({
        task: 'SPO-639',
        report: 'r',
        env: { LINEAR_API_KEY: 'secret-abc' },
        fetchImpl: bad as never,
      }),
    ).rejects.toThrow(/^(?!.*secret-abc).*$/);
  });
});
