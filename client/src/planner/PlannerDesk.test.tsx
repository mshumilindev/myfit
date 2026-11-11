import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newDraft, draftToPlan } from './draft';
import { lanes } from './PlannerDesk';
import { localParts } from './zoned';

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const today = localParts(Date.now(), tz).day;
const plan = draftToPlan(
  { ...newDraft('p1', today), title: 'Run', hour: 18, minute: 0 },
  tz,
  undefined,
);

vi.mock('./sync', () => ({
  usePlans: () => [plan],
  savePlan: vi.fn(),
  deletePlan: vi.fn(),
}));

import { PlannerPage } from './PlannerPage';

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('min-width'),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('lanes', () => {
  it('puts overlapping plans side by side and lone plans full width', () => {
    expect(
      lanes([
        { start: 0, end: 60 },
        { start: 30, end: 90 },
        { start: 120, end: 180 },
      ]),
    ).toEqual([
      [0, 2],
      [1, 2],
      [0, 1],
    ]);
  });
});

describe('PlannerPage on a desktop', () => {
  it('draws the plan in the week grid with Day / Week / Month tools', () => {
    render(<PlannerPage onClose={() => {}} />);
    expect(screen.getByRole('grid')).toBeTruthy();
    expect(screen.getByText('Run')).toBeTruthy();
    expect(screen.getByText('Day')).toBeTruthy();
    expect(screen.getByText('Month')).toBeTruthy();
  });

  it('opens the plan in a drawer, and Cancel leaves without a prompt when nothing changed', () => {
    render(<PlannerPage onClose={() => {}} />);
    fireEvent.click(screen.getByText('Run'));
    expect(document.querySelector('.sheet')).not.toBeNull();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Discard changes?')).toBeNull();
  });

  it('Add opens an empty drawer over the grid', () => {
    render(<PlannerPage onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(document.querySelector('.sheet')).not.toBeNull();
    expect(screen.getByRole('grid')).toBeTruthy();
  });
});
