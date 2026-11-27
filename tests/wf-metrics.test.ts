/** SPO-639 (WF-H): flow metrics from the journal. */
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs without type declarations
import { renderMarkdown, summarize } from '../scripts/lib/wf-metrics.mjs';

const MIN = 60_000;
const log = [
  { type: 'start', ts: 0, task: 'T' },
  { type: 'add', ts: 0, item: 'a', kind: 'step' },
  { type: 'add', ts: 0, item: 'b', kind: 'step' },
  { type: 'add', ts: 0, item: 'c', kind: 'step' },
  { type: 'doing', ts: 10 * MIN, item: 'a' },
  { type: 'done', ts: 30 * MIN, item: 'a' },
  { type: 'doing', ts: 30 * MIN, item: 'b' },
  { type: 'done', ts: 90 * MIN, item: 'b' },
  { type: 'block', ts: 91 * MIN, item: 'c', needs: 'cpd' },
  { type: 'heartbeat', ts: 92 * MIN },
];

describe('wf metrics', () => {
  it('computes counts, medians and blocker categories', () => {
    const s = summarize(log);
    expect(s).toMatchObject({ tasks: 1, items: 3, done: 2, heartbeats: 1, blocks: { cpd: 1 } });
    expect(s.leadMedianMs).toBe(60 * MIN); // (30 + 90) / 2
    expect(s.cycleMedianMs).toBe(40 * MIN); // (20 + 60) / 2
  });

  it('handles an empty journal and odd counts', () => {
    expect(summarize([])).toMatchObject({ items: 0, leadMedianMs: null, cycleMedianMs: null });
    const odd = summarize([
      { type: 'add', ts: 0, item: 'x' },
      { type: 'done', ts: 5 * MIN, item: 'x' },
    ]);
    expect(odd.leadMedianMs).toBe(5 * MIN);
  });

  it('renders a markdown table with human durations and no free text', () => {
    const md = renderMarkdown(summarize(log));
    expect(md).toContain('| Lead time (медіана add→done) | 60 хв |');
    expect(md).toContain('| Cycle time (медіана doing→done) | 40 хв |');
    expect(md).toContain('cpd: 1');
    expect(renderMarkdown(summarize([]))).toContain('—');
  });
});
