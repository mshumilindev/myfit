/** SPO-554: axe on the Planner screens in every locale (contrast needs real layout, so it is off in jsdom). */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale, type LocaleId } from '../i18n';

const prefs = {
  updatedAt: 0,
  availability: { 0: [[1080, 1260]], 5: [[540, 780]] },
  shareAvailability: true,
  defaults: { lead: 60, mode: 'quiet', durationMin: 60 },
};
const day = Date.now() + 3_600_000;
vi.mock('./sync', () => ({
  usePlans: () => [
    {
      id: 'p1',
      title: 'Physio visit',
      icon: 'first-aid',
      color: 'teal',
      startAt: day,
      durationMin: 45,
      repeat: { kind: 'none' },
      reminder: { lead: 60, mode: 'quiet' },
      note: '',
      updatedAt: 1,
    },
  ],
  usePrefs: () => prefs,
  getPrefs: () => prefs,
  savePrefs: vi.fn(),
  savePlan: vi.fn(),
  deletePlan: vi.fn(),
}));
vi.mock('../store', () => ({ useStore: () => ({ restPeriods: [] }) }));

import { PlannerPage } from './PlannerPage';
import { STRINGS } from './strings';

const STRINGS_BACK: Record<LocaleId, string> = {
  en: 'Back',
  uk: 'Назад',
  pl: 'Wstecz',
  lt: 'Atgal',
  et: 'Tagasi',
};
import { addonsPref } from '../addons/enabledSet';

async function violations(el: HTMLElement) {
  const r = await axe.run(el, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}
afterEach(cleanup);

describe.each(['en', 'uk', 'pl', 'lt', 'et'] as LocaleId[])('Planner a11y (%s)', (l) => {
  it('the list, Month, Availability and Settings have no violations', async () => {
    setLocale(l);
    addonsPref.set(['planner', 'planner-availability']);
    const { container } = render(<PlannerPage onClose={() => {}} />);
    expect(await violations(container)).toEqual([]);

    const rows = [...container.querySelectorAll('[role="button"], button')] as HTMLElement[];
    expect(rows.length).toBeGreaterThan(3);
    const month = container.querySelectorAll('[role="tab"], [role="radio"]')[1] as
      HTMLElement | undefined;
    if (month) {
      fireEvent.click(month);
      expect(await violations(container)).toEqual([]);
    }
  });

  it('opens Availability and Settings without violations', async () => {
    setLocale(l);
    addonsPref.set(['planner', 'planner-availability']);
    const { container } = render(<PlannerPage onClose={() => {}} />);
    for (const label of [STRINGS[l].availTitle, STRINGS[l].settingsRow]) {
      fireEvent.click(screen.getAllByText(label).at(-1)!);
      expect(container.querySelector('h1, h2, [class*="title"]'), label).toBeTruthy();
      expect(await violations(container)).toEqual([]);
      fireEvent.click(screen.getAllByRole('button', { name: STRINGS_BACK[l] })[0]);
    }
  });
});
