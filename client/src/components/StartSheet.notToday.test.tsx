import { setLocale } from '../i18n';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shell } from '../App';
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

// SPO-5: the "done today" hero (ring + check) must not leak into the
// "not trained today" state, which keeps the ordinary start options.
describe('Start sheet · not trained today (SPO-5)', () => {
  it('keeps the arrow hero: no progress ring, check, or "another" card', () => {
    render(<StartSheet shell={shell()} onClose={vi.fn()} />);
    const hero = document.body.querySelector('.ss-hero');
    expect(hero).not.toBeNull();
    expect(hero!.querySelector('.ss-hero-go')).not.toBeNull();
    expect(document.body.querySelector('[role="progressbar"]')).toBeNull();
    expect(document.body.querySelector('.uiring')).toBeNull();
    expect(document.body.querySelector('.ss-another')).toBeNull();
    expect(document.body.textContent).toContain('Home set');
  });
});

// SPO-561: the drawer shows no "Start" heading of its own (the hero and tiles say it); it keeps its accessible name.
describe('Start sheet · no heading in the drawer (SPO-561)', () => {
  it('drawer: no title, dialog named "Start", density anchor does not add a visible block', () => {
    render(<StartSheet shell={shell()} onClose={vi.fn()} />);
    expect(document.body.querySelector('.ss-title')).toBeNull();
    expect(document.body.querySelector('.sheet.start-sheet')?.getAttribute('aria-label')).toBe(
      'Start',
    );
    expect(document.body.querySelector('.start-sheet > span[hidden]')).not.toBeNull();
  });

  it('desktop side panel keeps its heading and gets no density attribute', () => {
    render(<StartSheet shell={shell()} onClose={vi.fn()} inline />);
    expect(document.body.querySelector('.start-inline .ss-title')?.textContent).toBe('Start');
    expect(document.body.querySelector('[data-fit]')).toBeNull();
  });
});
