import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { StartSheet } from './StartSheet';
import { StartFab } from '../stories/StartFab';
import { storyShell } from '../stories/fixtures';

// The × above the open Start drawer never goes missing (owner rule, SPO-470): not in the app, not in a story or a preview.
afterEach(cleanup);

const twin = () => document.body.querySelector('.tabbar-fab-layer');

describe('the × above the Start drawer', () => {
  it('an open Start drawer next to the hub always has the × twin, visible and pressable', async () => {
    render(
      <>
        <StartFab />
        <StartSheet shell={storyShell} inline onClose={() => undefined} />
      </>,
    );
    await waitFor(() => expect(twin()).not.toBeNull());
    await new Promise((r) => setTimeout(r, 30));
    expect(twin()?.className).not.toContain('is-covered');
    expect(twin()?.querySelector('button')?.getAttribute('aria-label')).toBe('Close');
  });

  it('every story of the Start drawer shows it with the ×: the shared decorator adds it, the fab stories bring their own bar', () => {
    const src = readFileSync(join(__dirname, 'StartSheet.stories.tsx'), 'utf8');
    expect(src).toMatch(/ctx\.args\.inline \? <StartFab \/> : null/);
    // a story that renders the drawer itself (inline={false}) must carry its own TabBar with the open fab
    expect(src).toMatch(/function DrawerWithFab[\s\S]*<TabBar[\s\S]*closeLabel:[\s\S]*<StartSheet/);
    const rendered = src.match(/render: \(\) =>/g) ?? [];
    const flagged = src.match(/args: \{ inline: false \}/g) ?? [];
    expect(flagged.length).toBe(rendered.length);
  });
});
