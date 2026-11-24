import { currentHash } from '../route';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale, LOCALES } from '../i18n';
import type { MuscleReadiness } from '../recovery';
import type { MuscleGroup } from '../data/exercises';

let map = new Map<MuscleGroup, MuscleReadiness>();
vi.mock('../recovery', async (orig) => ({
  ...(await orig<typeof import('../recovery')>()),
  muscleReadiness: () => map,
}));

import { ReadinessLens, buildReadinessNudge, READINESS_LENS_HASH } from './Readiness';

const R = (
  muscle: MuscleGroup,
  state: MuscleReadiness['state'],
  readiness: number,
  daysSince: number | null,
  recoveryDays = 3,
): MuscleReadiness => ({ muscle, state, readiness, daysSince, recoveryDays, lastDose: 4 });
const mk = (...rs: MuscleReadiness[]) => new Map(rs.map((r) => [r.muscle, r]));
const t = () => LOCALES.en;

beforeEach(() => {
  setLocale('en');
  map = new Map();
});
afterEach(cleanup);

const NOW = Date.UTC(2026, 8, 1);

describe('buildReadinessNudge', () => {
  it('is null on a cold start (fewer than three trained muscles)', () => {
    map = mk(R('chest', 'ready', 1, 5), R('lats', 'ready', 1, 5), R('quads', 'ready', 1, null));
    expect(buildReadinessNudge([], NOW, t())).toBeNull();
  });

  it('builds a high-priority nudge whose title is the fresh lead when nothing is recovering', () => {
    map = mk(R('chest', 'ready', 1, 5), R('lats', 'ready', 1, 6), R('quads', 'stale', 1, 14));
    const n = buildReadinessNudge([], NOW, t())!;
    expect(n.id).toBe('readiness');
    expect(n.priority).toBe(80);
    expect(n.title).toBe(t().rdFreshLead);
  });

  it('leads with the ready muscles (max three) in the mixed state, ready-only (not stale)', () => {
    map = mk(
      R('chest', 'ready', 1, 5),
      R('lats', 'ready', 1, 6),
      R('quads', 'recovering', 0.2, 1),
      R('glutes', 'ready', 1, 4),
      R('biceps', 'ready', 1, 4),
      R('triceps', 'stale', 1, 20),
    );
    const n = buildReadinessNudge([], NOW, t())!;
    expect(n.title).toBe(t().rdMixedLead('Chest · Lats · Glutes'));
  });

  it('falls back to the bare mixed lead when only stale muscles are available', () => {
    map = mk(
      R('chest', 'stale', 1, 20),
      R('lats', 'stale', 1, 20),
      R('quads', 'recovering', 0.2, 1),
    );
    expect(buildReadinessNudge([], NOW, t())!.title).toBe(t().rdMixedBare);
  });

  it('says "cooked" when four or more muscles are still recovering', () => {
    map = mk(
      R('chest', 'recovering', 0.1, 0.5),
      R('lats', 'recovering', 0.2, 0.5),
      R('quads', 'nearly', 0.8, 1),
      R('glutes', 'recovering', 0.3, 1),
    );
    expect(buildReadinessNudge([], NOW, t())!.title).toBe(t().rdCookedLead);
  });

  it('body shows ready/recovering counts and a strip of the three most relevant muscles', () => {
    map = mk(
      R('chest', 'recovering', 0.1, 0.5),
      R('lats', 'nearly', 0.8, 2),
      R('quads', 'ready', 1, 5),
      R('glutes', 'ready', 1, 6),
    );
    const n = buildReadinessNudge([], NOW, t())!;
    render(<>{n.body}</>);
    expect(document.querySelector('.rd-counts')!.textContent).toBe('2 ready · 2 recovering');
    const chips = [...document.querySelectorAll('.rd-chip')];
    expect(chips).toHaveLength(3);
    // recovering first, then nearly, then ready
    expect(chips.map((c) => c.querySelector('.rd-chip-name')!.textContent)).toEqual([
      'Chest',
      'Lats',
      'Quads',
    ]);
    expect(chips[0].querySelector('.rd-chip-pct')!.textContent).toBe('10%');
  });

  it('its action opens the readiness lens and closes the overlay', () => {
    map = mk(R('chest', 'ready', 1, 5), R('lats', 'ready', 1, 6), R('quads', 'ready', 1, 5));
    const n = buildReadinessNudge([], NOW, t())!;
    const close = vi.fn();
    render(<>{n.actions!(close)}</>);
    fireEvent.click(screen.getByRole('button', { name: /Full read/ }));
    expect(currentHash()).toBe(READINESS_LENS_HASH);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('ReadinessLens', () => {
  const full = () =>
    mk(
      R('chest', 'recovering', 0.25, 0.5),
      R('lats', 'nearly', 0.9, 2.2, 3),
      R('quads', 'ready', 1, 5),
      R('glutes', 'stale', 1, 21),
      R('biceps', 'ready', 1, null),
    );

  it('shows the cold-start note when nothing was ever trained', () => {
    map = mk(R('chest', 'ready', 1, null));
    render(<ReadinessLens finished={[]} now={NOW} />);
    expect(screen.getByText(t().rdColdStart)).toBeTruthy();
    expect(document.querySelector('.rd-lens')).toBeNull();
  });

  it('lists trained muscles ordered recovering → nearly → stale → ready with day labels', () => {
    map = full();
    render(<ReadinessLens finished={[]} now={NOW} view="list" />);
    const rows = [...document.querySelectorAll('.rd-row')];
    expect(rows.map((r) => r.querySelector('.rd-name')!.textContent)).toEqual([
      'Chest',
      'Lats',
      'Glutes',
      'Quads',
    ]);
    const days = rows.map((r) => r.querySelector('.rd-days')!.textContent);
    // recovering: ceil(3 - 0.5) = 3; nearly: ceil(3 - 2.2) = 1; stale readiness>=1 -> behind; ready -> ready
    expect(days).toEqual(['~3d', '~1d', 'behind', 'ready']);
    expect(rows[0].querySelector('.rd-badge em')!.textContent).toBe('25%');
    expect((rows[0].querySelector('.rd-bar-fill') as HTMLElement).style.width).toBe('25%');
  });

  it('clamps the days-left to at least 1', () => {
    map = mk(
      R('chest', 'nearly', 0.99, 2.999, 3),
      R('lats', 'ready', 1, 5),
      R('quads', 'ready', 1, 5),
    );
    render(<ReadinessLens finished={[]} now={NOW} view="list" />);
    expect(document.querySelector('.rd-row .rd-days')!.textContent).toBe('~1d');
  });

  it('recommends the ready muscles (max 3), else the stale ones', () => {
    map = full();
    const { unmount } = render(<ReadinessLens finished={[]} now={NOW} view="list" />);
    expect(document.querySelector('.rd-reco')!.textContent).toBe(t().rdReco('Quads · Biceps'));
    unmount();
    map = mk(
      R('chest', 'recovering', 0.2, 0.5),
      R('glutes', 'stale', 1, 21),
      R('lats', 'stale', 1, 30),
    );
    render(<ReadinessLens finished={[]} now={NOW} view="list" />);
    expect(document.querySelector('.rd-reco')!.textContent).toBe(t().rdReco('Glutes · Lats'));
  });

  it('omits the recommendation when nothing is ready or stale', () => {
    map = mk(R('chest', 'recovering', 0.2, 0.5));
    render(<ReadinessLens finished={[]} now={NOW} />);
    expect(document.querySelector('.rd-reco')).toBeNull();
    expect(document.querySelector('.rd-verdict')).toBeTruthy();
  });

  it('honours the view: map hides the list, list hides map and legend, full shows both', () => {
    map = full();
    const a = render(<ReadinessLens finished={[]} now={NOW} view="map" />);
    expect(a.container.querySelector('.rd-list')).toBeNull();
    expect(a.container.querySelector('.rd-legend')).toBeTruthy();
    a.unmount();
    const b = render(<ReadinessLens finished={[]} now={NOW} view="list" />);
    expect(b.container.querySelector('.rd-legend')).toBeNull();
    expect(b.container.querySelector('.rd-list')).toBeTruthy();
    b.unmount();
    const c = render(<ReadinessLens finished={[]} now={NOW} />);
    expect(c.container.querySelector('.rd-legend')).toBeTruthy();
    expect(c.container.querySelector('.rd-list')).toBeTruthy();
    expect([...c.container.querySelectorAll('.rd-leg')].map((e) => e.textContent)).toEqual([
      'recovering',
      'nearly',
      'ready',
      'stale',
    ]);
  });

  it('writes the verdict with the "still recovering" reason', () => {
    map = full();
    render(<ReadinessLens finished={[]} now={NOW} />);
    expect(document.querySelector('.rd-lead')!.textContent).toBe(t().rdMixedLead('Quads · Biceps'));
    expect(document.querySelector('.rd-why')!.textContent).toBe(t().rdCoolingWhy('Chest · Lats'));
  });

  it('has no "why" line when nothing is recovering', () => {
    map = mk(R('chest', 'ready', 1, 5), R('lats', 'ready', 1, 5));
    render(<ReadinessLens finished={[]} now={NOW} />);
    expect(document.querySelector('.rd-lead')!.textContent).toBe(t().rdFreshLead);
    expect(document.querySelector('.rd-why')).toBeNull();
  });

  it('cooked verdict names up to three cooling muscles', () => {
    map = mk(
      R('chest', 'recovering', 0.1, 0.5),
      R('lats', 'recovering', 0.2, 0.5),
      R('quads', 'recovering', 0.3, 0.5),
      R('glutes', 'recovering', 0.4, 0.5),
    );
    render(<ReadinessLens finished={[]} now={NOW} />);
    expect(document.querySelector('.rd-lead')!.textContent).toBe(t().rdCookedLead);
    expect(document.querySelector('.rd-why')!.textContent).toBe(
      t().rdCoolingWhy('Chest · Lats · Quads'),
    );
  });

  it('uses the bare mixed lead when only stale muscles are available', () => {
    map = mk(R('chest', 'stale', 1, 20), R('quads', 'recovering', 0.1, 0.5));
    render(<ReadinessLens finished={[]} now={NOW} />);
    expect(document.querySelector('.rd-lead')!.textContent).toBe(t().rdMixedBare);
  });
});
