import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// SPO-115 / SPO-120: Atlas is a theme of the shared chat frame, never a layout of its own.
const styles = readFileSync(join(__dirname, 'styles.css'), 'utf8');
const coachView = readFileSync(join(__dirname, 'views/CoachView.tsx'), 'utf8');

const blocks = [...styles.matchAll(/([^{}]*\.atl-thread[^{}]*)\{([^{}]*)\}/g)].map((m) => ({
  sel: m[1].trim(),
  body: m[2],
}));

describe('Atlas chat stays on the shared frame', () => {
  it('finds the Atlas thread rules', () => {
    expect(blocks.length).toBeGreaterThan(3);
  });
  it('no .atl-thread rule sets room or size on the shell containers', () => {
    const shell = blocks.filter((b) => /\.chs(-foot|-body|-head|-wrap|-page)?\b/.test(b.sel));
    expect(shell.length).toBeGreaterThan(0);
    for (const b of shell) {
      expect(b.body, b.sel).not.toMatch(
        /(^|[;\s])(padding|margin|width|max-width|inset|gap)[a-z-]*\s*:/,
      );
    }
  });
  it('is wrapped in ChatPage and ChatShell with the composer as the foot, like the client chat', () => {
    expect(coachView).toMatch(/<ChatPage>\s*<ChatShell/);
    expect(coachView).toMatch(/foot=\{/);
  });
});
