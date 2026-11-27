import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** SPO-639 W8: a verifier prompt may not change without a recorded recalibration (hash in docs/evals/verifier-calibration.json). */
const record = JSON.parse(readFileSync('docs/evals/verifier-calibration.json', 'utf8'))
  .agents as Record<string, { hash: string; seeded: string; result: string }>;
const agents = readdirSync('.claude/agents').filter(
  (f) => f.startsWith('verify-') && f.endsWith('.md'),
);

describe('verifier calibration record', () => {
  it('every verifier has a calibration entry and every entry has a verifier', () => {
    expect(Object.keys(record).sort()).toEqual(agents.map((f) => f.replace(/\.md$/, '')).sort());
  });
  it.each(agents)('%s prompt matches the calibrated hash', (f) => {
    const hash = createHash('sha256')
      .update(readFileSync(`.claude/agents/${f}`))
      .digest('hex');
    expect(
      hash,
      `${f} changed: recalibrate on a seeded defect, then update docs/evals/verifier-calibration.json`,
    ).toBe(record[f.replace(/\.md$/, '')].hash);
  });
  it('each entry names the seeded defect and a result', () => {
    for (const e of Object.values(record)) {
      expect(e.seeded.length).toBeGreaterThan(5);
      expect(e.result).toMatch(/FAIL|PASS/);
    }
  });
  it.each(agents)('%s stays read-only: no Write, Edit or Agent tools', (f) => {
    const tools = /^tools:\s*(.+)$/m.exec(readFileSync(`.claude/agents/${f}`, 'utf8'))?.[1] ?? '';
    for (const forbidden of ['Write', 'Edit', 'NotebookEdit', 'Agent'])
      expect(tools).not.toContain(forbidden);
    expect(tools).toContain('Read');
  });
});
