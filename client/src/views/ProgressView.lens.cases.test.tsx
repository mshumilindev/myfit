import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { __getStateForTests } from '../store';
import { VOLUME_MUSCLES } from '../volume';
import {
  DAY,
  freezeClock,
  makeShell,
  NOW,
  richState,
  seed,
  setDesktop,
} from './__fixtures__/viewKit';

vi.mock('../data/programMine', async (orig) => ({
  ...(await orig<typeof import('../data/programMine')>()),
  useProgramMine: () => ({ assignment: null, active: true }),
}));

import { ProgressView } from './ProgressView';

type Lens = 'volume' | 'fatigue' | 'readiness';
const open = (lens: Lens = 'volume') => {
  const shell = makeShell();
  const onLens = vi.fn();
  const out = render(
    <ProgressView
      store={__getStateForTests() as never}
      shell={shell}
      sub="progress"
      seg="volume"
      onSeg={vi.fn()}
      lens={lens}
      onLens={onLens}
    />,
  );
  return { ...out, shell, onLens };
};
const opt = (root: ParentNode, label: string) =>
  [...root.querySelectorAll('.uiseg-opt')].find((b) => b.textContent === label) as HTMLElement;
const sheet = () => document.querySelector('.vol-view-sheet') as HTMLElement;
const ctrlBtn = () => document.querySelector('.vvb-text')?.closest('button') as HTMLElement;
const filled = (svgRoot: Element) =>
  [...svgRoot.querySelectorAll('path')].filter(
    (p) =>
      (p.getAttribute('style') ?? '').includes('--') || p.getAttribute('fill')?.startsWith('var'),
  );

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  setDesktop(false);
  seed(richState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ProgressView: mobile map and control sheet', () => {
  it('the list/map segment switches to the body map with the zone legend and hides the sort button', () => {
    open();
    expect(document.querySelector('.vol-map')).toBeNull();
    fireEvent.click(opt(document, en.volMap));
    expect(document.querySelector('.vol-rows')).toBeNull();
    expect(document.querySelector('.vol-map .bodymap')).not.toBeNull();
    expect(
      [...document.querySelectorAll('.vol-legend .vol-leg')].map((l) => l.textContent),
    ).toEqual([en.volZone.under, en.volZone.productive, en.volZone.high, en.volZone.over]);
    expect(screen.queryByRole('button', { name: en.volSort })).toBeNull();
    fireEvent.click(opt(document, en.volList));
    expect(document.querySelectorAll('.vol-row')).toHaveLength(VOLUME_MUSCLES.length);
  });

  it('the map lens segment reports the chosen lens', () => {
    const { onLens } = open();
    fireEvent.click(opt(document, en.volMap));
    const seg = document.querySelector('.lens-seg-m') as HTMLElement;
    fireEvent.click(opt(seg, en.fatigueTab));
    fireEvent.click(opt(seg, en.readinessKicker));
    expect(onLens.mock.calls.map((c) => c[0])).toEqual(['fatigue', 'readiness']);
  });

  it('fatigue lens on the map shows the four fatigue levels', () => {
    open('fatigue');
    fireEvent.click(opt(document, en.volMap));
    expect(
      [...document.querySelectorAll('.vol-legend .vol-leg')].map((l) => l.textContent),
    ).toEqual([en.fatLevel.fresh, en.fatLevel.moderate, en.fatLevel.high, en.fatLevel.fried]);
    expect(document.querySelector('.vol-note')).toBeNull();
    expect(document.querySelector('.vol-tuned')).toBeNull();
  });

  it('readiness lens renders the readiness read in place of the rows, in map or list form', () => {
    open('readiness');
    expect(document.querySelector('.vol-rows')).toBeNull();
    expect(document.querySelector('.rd-lens')).not.toBeNull();
    expect(document.querySelector('.rd-lens .bodymap')).toBeNull();
    fireEvent.click(opt(document, en.volMap));
    expect(document.querySelector('.rd-lens .bodymap')).not.toBeNull();
  });

  it('the controls button summarises the view and opens the sheet', () => {
    open('fatigue');
    expect(ctrlBtn().textContent).toBe(`${en.fatigueTab} · ${en.volList} · ${en.volFine}`);
    fireEvent.click(ctrlBtn());
    expect(sheet().querySelector('.vvs-title')?.textContent).toBe(en.volViewTitle);
    expect(sheet().textContent).toContain(en.lensVolumeSub);
  });

  it('sheet lens cards report the chosen lens; display options update the summary', () => {
    const { onLens } = open('readiness');
    expect(ctrlBtn().textContent?.startsWith(en.readinessKicker)).toBe(true);
    fireEvent.click(ctrlBtn());
    const cards = [...sheet().querySelectorAll('.vvs-lens')];
    expect(cards.map((c) => c.querySelector('.vvs-lens-t')?.textContent)).toEqual([
      en.volumeTab,
      en.fatigueTab,
      en.readinessKicker,
    ]);
    fireEvent.click(cards[1]);
    expect(onLens).toHaveBeenCalledWith('fatigue');
    fireEvent.click(opt(sheet(), en.volMap));
    fireEvent.click(opt(sheet(), en.volZones));
    expect(ctrlBtn().textContent).toBe(`${en.readinessKicker} · ${en.volMap} · ${en.volZones}`);
  });

  it('Reset in the sheet restores the volume lens, list view and fine grain', () => {
    const { onLens } = open();
    fireEvent.click(ctrlBtn());
    fireEvent.click(opt(sheet(), en.volMap));
    fireEvent.click(opt(sheet(), en.volZones));
    fireEvent.click(within(sheet()).getByText(en.viewReset));
    expect(onLens).toHaveBeenCalledWith('volume');
    expect(ctrlBtn().textContent).toBe(`${en.volumeTab} · ${en.volList} · ${en.volFine}`);
    expect(document.querySelectorAll('.vol-row')).toHaveLength(VOLUME_MUSCLES.length);
  });

  it('zone grain on the map paints the whole zone', () => {
    open();
    fireEvent.click(opt(document, en.volMap));
    const fine = filled(document.querySelector('.vol-map .bodymap') as Element).length;
    fireEvent.click(opt(document, en.volZones));
    const zoned = filled(document.querySelector('.vol-map .bodymap') as Element).length;
    expect(zoned).toBeGreaterThanOrEqual(fine);
  });
});

describe('ProgressView: desktop volume pane', () => {
  beforeEach(() => setDesktop(true));

  it('has a right-hand map with the lens segment instead of the list/map toggle', () => {
    const { onLens } = open();
    const pane = document.querySelector('.vol-map-pane') as HTMLElement;
    expect(pane.querySelector('h3')?.textContent).toBe(en.volumeTab);
    expect(pane.querySelector('.bodymap')).not.toBeNull();
    expect([...pane.querySelectorAll('.vol-legend .vol-leg')]).toHaveLength(4);
    expect(document.querySelector('.vol-controls')?.textContent).not.toContain(en.volMap);
    fireEvent.click(opt(pane, en.fatigueTab));
    expect(onLens).toHaveBeenCalledWith('fatigue');
    expect(screen.getByRole('button', { name: en.volSort })).toBeTruthy();
  });

  it('fatigue lens: title, fatigue legend', () => {
    open('fatigue');
    const pane = document.querySelector('.vol-map-pane') as HTMLElement;
    expect(pane.querySelector('h3')?.textContent).toBe(en.fatigueTab);
    expect(pane.querySelector('.vol-legend')?.textContent).toContain(en.fatLevel.fried);
  });

  it('readiness lens: title and the readiness map; the left list also shows readiness', () => {
    open('readiness');
    const pane = document.querySelector('.vol-map-pane') as HTMLElement;
    expect(pane.querySelector('h3')?.textContent).toBe(en.readinessKicker);
    expect(pane.querySelector('.rd-lens')).not.toBeNull();
    expect(document.querySelectorAll('.rd-lens').length).toBe(2);
  });

  it('the readiness lens is cold-started for an account with no history', () => {
    const base = richState();
    seed({
      ...base,
      workouts: base.workouts
        .slice(-3)
        .map((w) => ({ ...w, startedAt: NOW - 100 * DAY, finishedAt: NOW - 100 * DAY + 3600_000 })),
    });
    open('readiness');
    expect(document.querySelector('.rd-lens-empty')?.textContent).toBe(en.rdColdStart);
  });
});
