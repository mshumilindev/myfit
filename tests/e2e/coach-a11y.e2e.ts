/**
 * Coach axe run: WCAG 2 A/AA rules on every Coach route (axe-core, injected into the page).
 * Fails on `serious` / `critical` violations that are not in KNOWN (each entry needs a reason and an owner).
 * Lower impact findings are attached to the report, not failed. Run: `npm run e2e:coach`.
 */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { COACH_ROUTES, openCoach, seedTrainer } from './coach-helpers';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

/** Rule ids accepted for now: `rule -> why`. Keep this list short and shrink it. */
const KNOWN: Record<string, string> = {};

interface AxeNode {
  target: string[];
  html: string;
}
interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: AxeNode[];
}

test.beforeEach(async ({ page, baseURL }) => {
  await seedTrainer(page, baseURL!);
});

for (const hash of COACH_ROUTES) {
  test(`axe ${hash}`, async ({ page }, info) => {
    await openCoach(page, hash);
    await page.waitForTimeout(500);
    await page.addScriptTag({ content: AXE });
    const violations = (await page.evaluate(async () => {
      const axe = (
        window as unknown as {
          axe: { run: (c: unknown, o: unknown) => Promise<{ violations: unknown[] }> };
        }
      ).axe;
      const r = await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      });
      return r.violations;
    })) as AxeViolation[];

    const summary = violations.map((v) => `${v.impact} ${v.id} x${v.nodes.length}: ${v.help}`);
    await info.attach('axe-violations', {
      body: summary.join('\n') || 'none',
      contentType: 'text/plain',
    });
    const blocking = violations.filter(
      (v) => (v.impact === 'serious' || v.impact === 'critical') && !(v.id in KNOWN),
    );
    expect(
      blocking.map(
        (v) =>
          `${v.impact} ${v.id}: ${v.help} -> ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(' '))
            .join(' | ')}`,
      ),
      `axe violations on ${hash} @${info.project.name}`,
    ).toEqual([]);
  });
}
