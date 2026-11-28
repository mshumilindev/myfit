import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * devflow must stay detachable from the host project (docs/plans/SPO-639-devflow-product-plan.md): it imports nothing
 * from outside its own folder, and the host-specific words may only decrease (baseline below, per file) until the
 * config carries them all.
 */
const ROOT = join(__dirname, '..', 'devflow');
const HOST_WORDS = /SPO-\d+|myfit|spotter|mshumilindev|docs\/specs|docs\/plans|\.claude\//gi;
const BASELINE: Record<string, number> = {
  'core/capture-rollup.mjs': 1,
  'core/journal.mjs': 1,
  'core/wf-core.mjs': 3,
  'core/wf-linear.mjs': 1,
  'core/wf-metrics.mjs': 1,
  'core/wf-stop.mjs': 4,
  'core/wf-views.mjs': 1,
  'bin/dash-close.mjs': 2,
  'bin/devflow.mjs': 4,
  'bin/journal-hook.mjs': 6,
  'bin/wf-bar.mjs': 3,
  'bin/wf-context-hook.mjs': 3,
  'bin/wf-metrics.mjs': 3,
  'bin/wf-stop-hook.mjs': 4,
  'bin/wf-sync.mjs': 3,
  'bin/wf-views.mjs': 2,
  'bin/wf.mjs': 4,
  'dashboard/server/collector.mjs': 16,
  'dashboard/server/guard.mjs': 1,
  'dashboard/server/linear.mjs': 3,
  'dashboard/server/main.mjs': 1,
  'dashboard/server/server.mjs': 1,
};

function files(dir: string, base = ''): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    const rel = base ? `${base}/${f}` : f;
    return statSync(p).isDirectory() ? files(p, rel) : f.endsWith('.mjs') ? [rel] : [];
  });
}

describe('devflow detachment', () => {
  const all = files(ROOT);
  it('imports only node: modules and its own files', () => {
    for (const f of all) {
      const text = readFileSync(join(ROOT, f), 'utf8');
      for (const m of text.matchAll(/from\s+'([^']+)'/g)) {
        const spec = m[1];
        const ok = spec.startsWith('node:') || (spec.startsWith('.') && !spec.includes('../../'));
        expect(ok, `${f} imports ${spec}`).toBe(true);
      }
    }
  });
  it('host-specific words never grow past the baseline (the config carries them)', () => {
    for (const f of all) {
      const n = (readFileSync(join(ROOT, f), 'utf8').match(HOST_WORDS) ?? []).length;
      expect(n, `${f}`).toBeLessThanOrEqual(BASELINE[f] ?? 0);
    }
  });
});
