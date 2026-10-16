import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setLocale } from '../i18n';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shell } from '../App';
import { atDay, seedStore, workoutOn } from '../stories/fixtures';
import { StartSheet } from './StartSheet';

const shell = (): Shell => ({
  openOverlay: vi.fn(),
  replaceOverlay: vi.fn(),
  goTab: vi.fn(),
  goPlaybook: vi.fn(),
  openStart: vi.fn(),
  toast: vi.fn(),
  snack: vi.fn(),
  signOut: vi.fn(),
  queueLength: 0,
});

beforeEach(() => setLocale('en'));
afterEach(cleanup);

// SPO-5: the "trained today" ring holds a centred, proportional check.
describe('Start sheet · trained today (SPO-5)', () => {
  it('shows the ring with the check inside the ring middle, and the "another" row', () => {
    const w = workoutOn('done-today', 0);
    w.startedAt = atDay(0, 0, 1);
    w.finishedAt = atDay(0, 0, 51);
    seedStore({ workouts: [w] });
    render(<StartSheet shell={shell()} onClose={vi.fn()} />);
    const ring = document.body.querySelector('.ss-hero .uiring');
    expect(ring).not.toBeNull();
    expect(
      ring!.querySelector('.uiring-c > .ui-icon, .uiring-c > i, .uiring-c > svg'),
    ).not.toBeNull();
    expect(document.body.querySelector('.ss-hero-go')).toBeNull();
    expect(document.body.querySelector('.ss-another')).not.toBeNull();
  });
  it('ring middle fills the ring and centres its glyph at 24px (60px ring)', () => {
    const css = readFileSync(join(__dirname, 'ui/Ring.css'), 'utf8');
    const c = /\.uiring-c\s*\{([^}]*)\}/.exec(css)![1];
    expect(c).toMatch(/position:\s*absolute/);
    expect(c).toMatch(/inset:\s*0/);
    expect(c).toMatch(/display:\s*grid/);
    expect(c).toMatch(/place-items:\s*center/);
    expect(/\.uiring-c > \.ui-icon\s*\{([^}]*)\}/.exec(css)![1]).toMatch(
      /font-size:\s*var\(--fs-24\)/,
    );
  });
});
