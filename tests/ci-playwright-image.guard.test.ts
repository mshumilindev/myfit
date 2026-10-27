/**
 * CI runs Playwright jobs in Playwright's own container image (SPO-369/370): browsers and system libraries are baked in,
 * so a job never waits on `apt-get` (that step took 10-773 s at random and made the layout shards uneven).
 * The image tag MUST equal the locked @playwright/test version, otherwise the browser revision does not match
 * ("Executable doesn't exist"). This guard fails the moment a Playwright bump and the workflow drift apart.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const ciRaw = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
// comments explain the old problem and may name the old command; only real steps count
const ci = ciRaw
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n');
const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')) as {
  packages: Record<string, { version?: string }>;
};
const locked = lock.packages['node_modules/@playwright/test']?.version;
const images = [...ci.matchAll(/image:\s*mcr\.microsoft\.com\/playwright:v([\d.]+)-(\w+)/g)];

describe('CI Playwright image', () => {
  it('@playwright/test is locked', () => expect(locked).toMatch(/^\d+\.\d+\.\d+$/));

  it('every Playwright job uses the image whose tag equals the locked version', () => {
    expect(images.length).toBeGreaterThanOrEqual(3); // layout-shard, client-e2e, passkeys-e2e
    for (const [, version] of images) expect(version).toBe(locked);
  });

  it('no job installs system libraries with apt on the runner again', () => {
    expect(ci).not.toMatch(/playwright install(-deps)?[^\n]*--with-deps|playwright install-deps/);
  });

  it('every job that runs Playwright is in the container', () => {
    const jobs = ci.split(/\n {2}(?=[a-z][\w-]*:\n)/);
    const running = jobs.filter((j) => /npx playwright test|npm run audit:/.test(j));
    expect(running.length).toBeGreaterThanOrEqual(3);
    for (const job of running)
      expect(job).toMatch(/container:\s*\n\s+image: mcr\.microsoft\.com\/playwright:/);
  });
});
