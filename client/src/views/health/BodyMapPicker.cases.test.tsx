import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { CONDITION_CATALOG } from '../../data/conditionCatalog';
import { OTHER_TAB_CATEGORIES, isOtherTab } from '../../conditions';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';

// The anatomical figure is a WebGL scene (not available in jsdom): its inputs are exposed as data attributes instead.
vi.mock('../../components/ui/AnatomyTurntable', () => ({
  AnatomyTurntable: (p: {
    camera: { yaw: number; y: number; zoom: number; n: number };
    caption?: string;
    base: string;
    organs: string[];
    activeOrgans?: string[];
    marks: Array<{ layer: string; tone: string }>;
  }) => (
    <div
      data-testid="figure"
      data-yaw={p.camera.yaw}
      data-y={p.camera.y}
      data-zoom={p.camera.zoom}
      data-n={p.camera.n}
      data-caption={p.caption}
      data-base={p.base}
      data-organs={p.organs.join(',')}
      data-active={(p.activeOrgans ?? []).join(',')}
      data-marks={p.marks.map((m) => `${m.layer}:${m.tone}`).join(',')}
    />
  ),
}));

import { AREAS, BodyMapPicker } from './BodyMapPicker';

const fig = () => screen.getByTestId('figure').dataset;
const area = (name: string) => screen.getByText(name);
const layer = (name: string) => fireEvent.click(screen.getByText(name));
const inRegion = (regions: string[]) => CONDITION_CATALOG.filter((c) => regions.includes(c.region));

beforeEach(() => setLocale('en'));
afterEach(cleanup);

describe('BodyMapPicker: bones', () => {
  it('opens on the whole skeleton with the areas split into upper and lower body', () => {
    render(<BodyMapPicker onPick={() => undefined} />);
    expect(fig()).toMatchObject({
      caption: en.cndWhole,
      base: 'bones',
      yaw: '0',
      y: '0.505',
      zoom: '1',
      marks: '',
    });
    const upper = screen.getByText(en.cndUpper).parentElement as HTMLElement;
    const lower = screen.getByText(en.cndLower).parentElement as HTMLElement;
    expect(within(upper).getByText(en.cndRegion.neckBack)).toBeTruthy();
    expect(within(upper).getByText(en.cndRegion.shoulders)).toBeTruthy();
    expect(within(lower).getByText(en.cndRegion.knees)).toBeTruthy();
    expect(within(lower).getByText(en.cndRegion.hips)).toBeTruthy();
    expect(within(upper).queryByText(en.cndRegion.knees)).toBeNull();
  });

  it('an area zooms the figure onto it, marks it, and lists the conditions of its regions', () => {
    const onPick = vi.fn();
    render(<BodyMapPicker onPick={onPick} />);
    fireEvent.click(area(en.cndRegion.knees));
    expect(fig()).toMatchObject({
      caption: en.cndRegion.knees,
      y: '0.64',
      zoom: '2.4',
      yaw: '0',
      n: '1',
    });
    expect(fig().marks).toBe('knee_l:chronic,knee_r:chronic');
    const expected = inRegion(['knee']);
    expect(expected.length).toBeGreaterThan(0);
    const first = expected[0];
    fireEvent.click(screen.getByText(first.name));
    expect(onPick).toHaveBeenCalledWith(first);
  });

  it('an area on the back turns the figure round; tapping it again returns to the whole body', () => {
    render(<BodyMapPicker onPick={() => undefined} />);
    fireEvent.click(area(en.cndRegion.lowerBack));
    expect(fig()).toMatchObject({
      yaw: '180',
      y: '0.33',
      zoom: '2.4',
      caption: en.cndRegion.lowerBack,
    });
    fireEvent.click(area(en.cndRegion.lowerBack));
    expect(fig()).toMatchObject({ caption: en.cndWhole, y: '0.505', zoom: '1', n: '2' });
    expect(fig().yaw).toBe('180'); // it stays turned the way it was; only the camera pulls back
    expect(screen.queryByText(en.cndNoResults)).toBeNull();
  });

  it('switching layer drops the chosen area and its list, and the organ layer always faces the front', () => {
    render(<BodyMapPicker onPick={() => undefined} />);
    fireEvent.click(area(en.cndRegion.shoulders));
    expect(fig().caption).toBe(en.cndRegion.shoulders);
    layer(en.cndLayerMuscles);
    expect(fig().caption).toBe(en.cndWhole);
    layer(en.cndLayerBones);
    fireEvent.click(area(en.cndRegion.lowerBack));
    expect(fig().yaw).toBe('180');
    layer(en.cndLayerMuscles);
    expect(fig()).toMatchObject({ caption: en.cndWhole, base: 'muscles', yaw: '180' });
    expect(screen.queryByText(en.cndNoResults)).toBeNull();
    fireEvent.click(area(en.cndRegion.back));
    expect(fig()).toMatchObject({ yaw: '180', caption: en.cndRegion.back });
    layer(en.cndLayerOrgans);
    expect(fig()).toMatchObject({ caption: en.cndWhole, yaw: '0' });
  });

  it('every bone area shows the catalogue conditions of exactly its regions', () => {
    render(<BodyMapPicker onPick={() => undefined} />);
    for (const a of AREAS.bones) {
      fireEvent.click(area(en.cndRegion[a.id]));
      const want = inRegion(a.regions);
      if (want.length === 0) expect(screen.getByText(en.cndNoResults)).toBeTruthy();
      else want.slice(0, 3).forEach((c) => expect(screen.getByText(c.name)).toBeTruthy());
      fireEvent.click(area(en.cndRegion[a.id]));
    }
  });
});

describe('BodyMapPicker: muscles and organs', () => {
  it('muscles use the muscle figure and its own areas', () => {
    render(<BodyMapPicker onPick={() => undefined} />);
    layer(en.cndLayerMuscles);
    expect(fig().base).toBe('muscles');
    fireEvent.click(area(en.cndRegion.thighs));
    expect(fig().marks).toBe('m_quads:chronic,m_hams:chronic');
    expect(fig()).toMatchObject({ y: '0.52', zoom: '1.8' });
    expect(screen.queryByText(en.cndRegion.feet)).toBeNull();
  });

  it('switching layer clears the chosen area and the list', () => {
    render(<BodyMapPicker onPick={() => undefined} />);
    fireEvent.click(area(en.cndRegion.knees));
    layer(en.cndLayerMuscles);
    expect(fig().caption).toBe(en.cndWhole);
    expect(fig().marks).toBe('');
  });

  it('organs are shown from the front, all drawn, the chosen ones highlighted', () => {
    render(<BodyMapPicker onPick={() => undefined} />);
    layer(en.cndLayerOrgans);
    expect(fig().organs).toBe('heart,lungs,liver,kidneys,stomach,intestines,brain,spinalcord');
    fireEvent.click(area(en.cndRegion.brain));
    expect(fig()).toMatchObject({ yaw: '0', active: 'brain,spinalcord', y: '0.06', zoom: '3' });
    fireEvent.click(area(en.cndRegion.digestive));
    expect(fig().active).toBe('liver,stomach,intestines,kidneys');
  });

  it('an area with no catalogue condition says so instead of an empty list', () => {
    render(<BodyMapPicker onPick={() => undefined} />);
    layer(en.cndLayerOrgans);
    for (const a of AREAS.organs) {
      fireEvent.click(area(en.cndRegion[a.id]));
      const has = inRegion(a.regions).length > 0;
      expect(screen.queryByText(en.cndNoResults) !== null).toBe(!has);
      fireEvent.click(area(en.cndRegion[a.id]));
    }
  });
});

describe('BodyMapPicker: other', () => {
  it('lists everything not tied to a body part by category, without a figure', () => {
    const onPick = vi.fn();
    render(<BodyMapPicker onPick={onPick} />);
    layer(en.cndLayerOther);
    expect(screen.queryByTestId('figure')).toBeNull();
    expect(screen.getByText(en.cndOtherHint)).toBeTruthy();
    for (const cat of OTHER_TAB_CATEGORIES) {
      const items = CONDITION_CATALOG.filter((c) => isOtherTab(c) && c.category === cat);
      if (items.length) expect(screen.getAllByText(en.cndCat[cat]).length).toBeGreaterThan(0);
    }
    const sample = CONDITION_CATALOG.find(
      (c) => isOtherTab(c) && OTHER_TAB_CATEGORIES.includes(c.category),
    )!;
    fireEvent.click(screen.getByText(sample.name));
    expect(onPick).toHaveBeenCalledWith(sample);
  });

  it('coming back to a body layer shows the figure again', () => {
    render(<BodyMapPicker onPick={() => undefined} />);
    layer(en.cndLayerOther);
    layer(en.cndLayerBones);
    expect(fig().caption).toBe(en.cndWhole);
  });
});
