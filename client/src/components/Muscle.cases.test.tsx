import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LOCALES, setLocale } from '../i18n';
import { __getStateForTests, __replaceStateForTests } from '../store';
import type { Workout } from '../types';
import {
  EquipChip,
  FocusBodyMap,
  LIB_VIEW_PATHS,
  MUSCLE_IDS,
  MuscleBodyFigure,
  MuscleChip,
  MuscleDetailContext,
  MuscleFigure,
  MuscleHeatmap,
  MuscleIcon,
  MusclePickerMap,
  MuscleSetChip,
  equipmentIconName,
  equipmentLabel,
  focusBodyMapSvg,
  isEquipmentId,
  litLibIds,
  withMuscleBreak,
} from './Muscle';

const en = () => LOCALES.en;
const NOW = new Date(2026, 8, 15, 12, 0).getTime(); // Tue 15 Sep 2026
const fills = (root: ParentNode) =>
  [...root.querySelectorAll('path')].map((p) => p.getAttribute('fill'));
const setWorkouts = (workouts: Workout[]) =>
  __replaceStateForTests({ ...__getStateForTests(), workouts } as never);

beforeEach(() => {
  setLocale('en');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setWorkouts([]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Muscle · pure helpers', () => {
  it('litLibIds maps groups to library paths per view and skips cardio', () => {
    expect(litLibIds(['cardio'], 'front')).toEqual([]);
    expect(litLibIds(['chest'], 'front')).toEqual([
      'chest-upper-left',
      'chest-upper-right',
      'chest-lower-left',
      'chest-lower-right',
    ]);
    expect(litLibIds(['chest'], 'back')).toEqual([]);
    expect(litLibIds(['chest', 'cardio', 'biceps'], 'front').length).toBeGreaterThan(4);
    const frontIds = LIB_VIEW_PATHS.front.map((p) => p.id);
    for (const id of litLibIds(['quads', 'shoulders'], 'front')) expect(frontIds).toContain(id);
  });

  it('the muscle vocabulary has no cardio and no duplicates', () => {
    expect(MUSCLE_IDS).not.toContain('cardio' as never);
    expect(new Set(MUSCLE_IDS).size).toBe(MUSCLE_IDS.length);
    expect(MUSCLE_IDS).toContain('lower_back');
  });

  it('equipment helpers: icon names, labels and id guard, with safe fallbacks', () => {
    expect(equipmentIconName('barbell')).toBe('barbell');
    expect(equipmentIconName('cable')).toBe('plugs');
    expect(equipmentIconName('nonsense')).toBe('toolbox');
    expect(equipmentLabel('barbell')).toBe(en().equipmentNames.barbell);
    expect(equipmentLabel('mystery')).toBe('Mystery');
    expect(isEquipmentId('dumbbell')).toBe(true);
    expect(isEquipmentId('mystery')).toBe(false);
  });

  it('withMuscleBreak puts one line break before the first secondary only', () => {
    const items = [
      { primary: true, k: 'a' },
      { primary: true, k: 'b' },
      { primary: false, k: 'c' },
      { primary: false, k: 'd' },
    ];
    const nodes = withMuscleBreak(items, (x) => <i key={x.k}>{x.k}</i>) as Array<{ key: string }>;
    expect(nodes.map((n) => n.key)).toEqual(['a', 'b', '__mbreak', 'c', 'd']);
    expect(withMuscleBreak([{ primary: false, k: 'x' }], (x) => <i key={x.k} />)).toHaveLength(1); // first item is never preceded by a break
    expect(withMuscleBreak([], () => null)).toEqual([]);
  });

  it('focusBodyMapSvg is a self-contained SVG string with literal colours', () => {
    const svg = focusBodyMapSvg(['biceps', 'chest-upper'], 'front');
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).not.toContain('var(');
    expect(svg).toContain('viewBox="-1.5 -2 34.5 96.5"');
    expect(svg).toContain('width="207" height="579"'); // 34.5 and 96.5 at 6x
    const paths = svg.match(/<path /g)!.length;
    expect(paths).toBe(LIB_VIEW_PATHS.front.length);
    const lit = (svg.match(/fill="#e9c07a"/g) ?? []).length;
    expect(lit).toBeGreaterThan(0);
    expect(lit).toBeLessThan(paths);
    expect(focusBodyMapSvg([], 'back')).not.toContain('#e9c07a');
  });

  it('focusBodyMapSvg lights a split sub-region on fewer paths than the whole group', () => {
    const upper = (focusBodyMapSvg(['chest-upper'], 'front').match(/#e9c07a/g) ?? []).length;
    const whole = (focusBodyMapSvg(['chest-lower', 'chest-upper'], 'front').match(/#e9c07a/g) ?? [])
      .length;
    expect(upper).toBeGreaterThan(0);
    expect(upper).toBeLessThan(whole);
  });
});

describe('Muscle · figures', () => {
  it('MuscleHeatmap draws front and back and paints only the groups given colours', () => {
    const { container } = render(
      <MuscleHeatmap
        colors={{ chest: 'rgb(1,2,3)', quads: 'rgb(4,5,6)' }}
        width={120}
        className="x"
      />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toBe('bodymap x');
    expect(root.style.width).toBe('120px');
    const svgs = root.querySelectorAll('svg');
    expect(svgs).toHaveLength(2);
    expect(fills(svgs[0]).filter((f) => f === 'rgb(1,2,3)')).toHaveLength(
      litLibIds(['chest'], 'front').length,
    );
    expect(fills(svgs[1]).filter((f) => f === 'rgb(1,2,3)')).toHaveLength(0); // chest is front-only
    expect(fills(svgs[0]).filter((f) => f === 'rgb(4,5,6)')).toHaveLength(
      litLibIds(['quads'], 'front').length,
    );
  });

  it('MuscleHeatmap with no colours dims everything', () => {
    const { container } = render(<MuscleHeatmap colors={{}} />);
    expect((container.firstChild as HTMLElement).className).toBe('bodymap');
    expect(new Set(fills(container)).size).toBe(1);
  });

  it('FocusBodyMap tints grow and ease, with grow winning an overlap, in both views by default', () => {
    const { container } = render(<FocusBodyMap grow={['biceps']} ease={['biceps', 'quads']} />);
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    const all = fills(container);
    expect(all.filter((f) => f === 'var(--color-accent)').length).toBeGreaterThan(0);
    expect(all.filter((f) => f === 'var(--color-danger)').length).toBeGreaterThan(0);
    // biceps are on both lists: they must end up accent, never danger
    const front = fills(container.querySelectorAll('svg')[0]);
    const bicepsIds = litLibIds(['biceps'], 'front');
    const idx = LIB_VIEW_PATHS.front.findIndex((p) => p.id === bicepsIds[0]);
    expect(front[idx]).toBe('var(--color-accent)');
  });

  it('FocusBodyMap shows one view when asked, and split sub-regions light fewer paths', () => {
    const a = render(<FocusBodyMap grow={['chest-upper']} ease={[]} view="front" width="50%" />);
    expect(a.container.querySelectorAll('svg')).toHaveLength(1);
    const upper = fills(a.container).filter((f) => f === 'var(--color-accent)').length;
    a.unmount();
    const b = render(<FocusBodyMap grow={['chest-upper', 'chest-lower']} ease={[]} view="front" />);
    expect(fills(b.container).filter((f) => f === 'var(--color-accent)').length).toBeGreaterThan(
      upper,
    );
    b.unmount();
    const c = render(<FocusBodyMap grow={['lats']} ease={[]} view="back" className="k" />);
    expect((c.container.firstChild as HTMLElement).className).toBe('bodymap k');
    expect(fills(c.container).filter((f) => f === 'var(--color-accent)').length).toBeGreaterThan(0);
  });

  it('MuscleFigure "auto" shows only the silhouettes that carry worked muscles', () => {
    const front = render(<MuscleFigure primary={['biceps']} />);
    expect(front.container.querySelectorAll('svg')).toHaveLength(1);
    front.unmount();
    const back = render(<MuscleFigure primary={['hamstrings']} />);
    expect(back.container.querySelectorAll('svg')).toHaveLength(1);
    expect(back.container.querySelector('svg')!.getAttribute('viewBox')).toBe('35 -2 35.5 96.6');
    back.unmount();
    const both = render(<MuscleFigure primary={['chest']} secondary={['triceps']} />);
    expect(both.container.querySelectorAll('svg')).toHaveLength(2);
    both.unmount();
    const none = render(<MuscleFigure primary={['cardio']} />);
    expect(none.container.querySelectorAll('svg')).toHaveLength(1); // falls back to the front silhouette
  });

  it('MuscleFigure honours an explicit view, region, width and tone; full body lights everything', () => {
    const a = render(
      <MuscleFigure primary={['chest']} view="back" region="upper" width={90} className="fig" />,
    );
    const root = a.container.firstChild as HTMLElement;
    expect(root.className).toBe('bodymap fig');
    expect(root.style.width).toBe('90px');
    expect(a.container.querySelector('svg')!.getAttribute('viewBox')).toBe('36.4 3.5 32.2 41.5');
    a.unmount();
    const b = render(<MuscleFigure primary={['fullbody']} />);
    expect(b.container.querySelectorAll('svg')).toHaveLength(2);
    expect(new Set(fills(b.container)).size).toBe(1);
    expect(fills(b.container)[0]).toBe('var(--color-accent)');
    b.unmount();
    const c = render(
      <MuscleFigure primary={['chest']} secondary={['biceps']} view="front" tone="secondary" />,
    );
    const f = fills(c.container);
    expect(f).toContain('var(--color-neutral-500)'); // primary painted in the secondary tone's highlight
    expect(f).toContain('var(--body-sec, var(--color-neutral-500))'); // and the secondary group in the grey
  });

  it('MuscleFigure crops regions to a subset of paths', () => {
    const full = render(<MuscleFigure primary={['quads']} view="front" region="full" />);
    const nFull = full.container.querySelectorAll('path').length;
    full.unmount();
    const lower = render(<MuscleFigure primary={['quads']} view="front" region="lower" />);
    const nLower = lower.container.querySelectorAll('path').length;
    expect(nLower).toBeGreaterThan(0);
    expect(nLower).toBeLessThan(nFull);
  });

  it('MuscleBodyFigure sizes the auto figure', () => {
    const { container } = render(
      <MuscleBodyFigure primary={['lats']} secondary={['biceps']} width={64} />,
    );
    expect((container.firstChild as HTMLElement).style.width).toBe('64px');
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });

  it('MusclePickerMap lights the selection and lets a tap toggle the owning group', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <MusclePickerMap
        selected={['chest']}
        onToggle={onToggle}
        labels={{ front: 'Front', back: 'Back' }}
        className="pm"
      />,
    );
    expect([...container.firstElementChild!.classList]).toEqual(['muscle-map', 'pm']);
    expect(screen.getByText('Front')).toBeTruthy();
    expect(screen.getByText('Back')).toBeTruthy();
    const front = container.querySelectorAll('svg')[0];
    const paths = [...front.querySelectorAll('path')];
    const chestIdx = LIB_VIEW_PATHS.front.findIndex((p) => p.id === 'chest-upper-left');
    expect(paths[chestIdx].getAttribute('fill')).toBe('var(--color-accent)');
    fireEvent.click(paths[chestIdx]);
    expect(onToggle).toHaveBeenCalledWith('chest');
    const bicepsIdx = LIB_VIEW_PATHS.front.findIndex((p) => p.id === 'biceps-left');
    expect(paths[bicepsIdx].getAttribute('fill')).not.toBe('var(--color-accent)');
    fireEvent.click(paths[bicepsIdx]);
    expect(onToggle).toHaveBeenLastCalledWith('biceps');
  });

  it('MusclePickerMap locked is dimmer and ignores taps; without onToggle nothing is clickable', () => {
    const onToggle = vi.fn();
    const a = render(<MusclePickerMap selected={['chest']} onToggle={onToggle} locked />);
    expect(a.container.firstElementChild!.classList.contains('locked')).toBe(true);
    const idx = LIB_VIEW_PATHS.front.findIndex((p) => p.id === 'chest-upper-left');
    const p = a.container.querySelectorAll('svg')[0].querySelectorAll('path')[idx];
    expect(p.getAttribute('fill')).toBe('var(--color-accent-700)');
    fireEvent.click(p);
    expect(onToggle).not.toHaveBeenCalled();
    a.unmount();
    const b = render(<MusclePickerMap selected={[]} />);
    fireEvent.click(b.container.querySelector('path')!);
    expect(b.container.querySelector('figcaption')).toBeNull();
    expect((b.container.querySelector('path') as SVGElement).style.cursor).toBe('');
  });
});

describe('Muscle · icons', () => {
  it('cardio renders nothing', () => {
    const { container } = render(<MuscleIcon muscle="cardio" />);
    expect(container.firstChild).toBeNull();
  });

  it('chip sizes use the geometric locator mark, scaled per variant', () => {
    const a = render(<MuscleIcon muscle="chest" />);
    const svg = a.container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 20 34');
    expect(svg.style.width).toBe('8px');
    expect(svg.style.height).toBe('13px');
    a.unmount();
    const b = render(<MuscleIcon muscle="chest" variant="chipLg" className="big" />);
    expect(b.container.querySelector('svg')!.style.width).toBe('9px');
    expect(b.container.querySelector('svg')!.getAttribute('class')).toBe('big');
  });

  it('the locator mark differs by muscle: upper body has arms only, lower body legs only, full body both', () => {
    const mark = (m: Parameters<typeof MuscleIcon>[0]['muscle']) => {
      const r = render(<MuscleIcon muscle={m} />);
      const out = {
        arms: r.container.querySelectorAll('rect[x="2.6"]').length > 0,
        legs: r.container.querySelectorAll('rect[y="18"]').length > 0,
      };
      r.unmount();
      return out;
    };
    for (const m of [
      'chest',
      'back',
      'lats',
      'traps',
      'lower_back',
      'shoulders',
      'biceps',
      'triceps',
      'forearms',
      'core',
      'neck',
    ] as const) {
      expect(mark(m)).toEqual({ arms: true, legs: false });
    }
    for (const m of [
      'quads',
      'hamstrings',
      'glutes',
      'calves',
      'adductors',
      'abductors',
    ] as const) {
      expect(mark(m).arms).toBe(false);
    }
    expect(mark('quads')).toEqual({ arms: false, legs: true });
    expect(mark('fullbody')).toEqual({ arms: true, legs: true });
  });

  it.each(['chipFig', 'row', 'figure', 'full'] as const)(
    '%s renders an anatomical figure at its size',
    (variant) => {
      const sizes = { chipFig: [16, 25], row: [13, 22], figure: [13, 22], full: [15, 26] } as const;
      const { container } = render(<MuscleIcon muscle="biceps" variant={variant} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('width')).toBe(String(sizes[variant][0]));
      expect(svg.getAttribute('height')).toBe(String(sizes[variant][1]));
      expect(container.querySelectorAll('path').length).toBeGreaterThan(5);
    },
  );

  it('the anatomical figure shows the front or back view that suits the muscle, and the whole body for fullbody', () => {
    const lats = render(<MuscleIcon muscle="lats" variant="figure" />);
    expect(lats.container.querySelector('svg')!.getAttribute('viewBox')).toBe('36.4 3.5 32.2 41.5');
    lats.unmount();
    const full = render(<MuscleIcon muscle="fullbody" variant="full" tone="onAccent" />);
    expect(new Set(fills(full.container)).size).toBe(1);
    expect(fills(full.container)[0]).toBe('var(--color-accent-300)');
  });
});

describe('Muscle · chips', () => {
  it('MuscleChip shows the localized label and is inert without a handler', () => {
    setLocale('uk');
    render(<MuscleChip muscle="chest" />);
    expect(screen.getByText(LOCALES.uk.muscleGroups.chest)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('cardio renders no chip (any variant)', () => {
    const a = render(<MuscleChip muscle="cardio" />);
    expect(a.container.firstChild).toBeNull();
    a.unmount();
    const b = render(<MuscleChip muscle="cardio" variant="pill" onClick={() => undefined} />);
    expect(b.container.firstChild).toBeNull();
    b.unmount();
    const c = render(<MuscleSetChip muscle="cardio" count={3} />);
    expect(c.container.firstChild).toBeNull();
  });

  it('a handler makes it a button that reports the muscle (no drawer unless detail)', () => {
    const onClick = vi.fn();
    render(<MuscleChip muscle="biceps" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en().muscleGroups.biceps) }));
    expect(onClick).toHaveBeenCalledWith('biceps');
    expect(document.querySelector('.muscle-info')).toBeNull();
  });

  it('the pill variant carries the figure only for primary tone with icon on', () => {
    const a = render(<MuscleChip muscle="biceps" variant="pill" icon />);
    expect(a.container.querySelector('svg')).toBeTruthy();
    a.unmount();
    const b = render(<MuscleChip muscle="biceps" variant="pill" />);
    expect(b.container.querySelector('svg')).toBeNull();
    b.unmount();
    const c = render(<MuscleChip muscle="biceps" variant="pill" icon tone="secondary" />);
    expect(c.container.querySelector('svg')).toBeNull();
    c.unmount();
    const onClick = vi.fn();
    render(<MuscleChip muscle="biceps" variant="pill" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith('biceps');
  });

  it('detail opens the enlarged drawer; its action runs the handler and closes', async () => {
    const onClick = vi.fn();
    render(<MuscleChip muscle="biceps" onClick={onClick} detail />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en().muscleGroups.biceps) }));
    expect(onClick).not.toHaveBeenCalled();
    const drawer = document.querySelector('.muscle-info') as HTMLElement;
    expect(
      within(drawer).getByText(en().muscleGroups.biceps, { selector: '.mi-name' }),
    ).toBeTruthy();
    expect(drawer.querySelectorAll('.mi-fig svg').length).toBe(2); // front + back
    fireEvent.click(
      within(drawer).getByRole('button', {
        name: en().muscleHistoryTitle(en().muscleGroups.biceps),
      }),
    );
    expect(onClick).toHaveBeenCalledWith('biceps');
    await act(async () => void (await new Promise((r) => setTimeout(r, 400))));
    expect(document.querySelector('.muscle-info')).toBeNull();
  });

  it('the drawer shows live detail from the surrounding context', () => {
    render(
      <MuscleDetailContext.Provider value={(m) => <p data-testid="extra">state of {m}</p>}>
        <MuscleChip muscle="quads" onClick={() => undefined} detail />
      </MuscleDetailContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('extra').textContent).toBe('state of quads');
    expect(document.querySelector('.mi-fig.compact')).toBeTruthy();
  });

  it('MuscleSetChip shows the count (decimals only when needed) and tone', () => {
    const a = render(<MuscleSetChip muscle="chest" count={4.5} />);
    expect(a.container.querySelector('.mworked-count')!.textContent).toBe('4.5');
    a.unmount();
    const b = render(<MuscleSetChip muscle="chest" count={4} tone="secondary" />);
    expect(b.container.querySelector('.mworked-count')!.textContent).toBe('4');
    b.unmount();
    const c = render(<MuscleSetChip muscle="chest" />);
    expect(c.container.querySelector('.mworked-count')).toBeNull();
  });

  it('MuscleSetChip click and detail', () => {
    const onClick = vi.fn();
    const a = render(<MuscleSetChip muscle="glutes" count={2} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith('glutes');
    a.unmount();
    onClick.mockClear();
    render(<MuscleSetChip muscle="glutes" count={2} onClick={onClick} detail />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
    expect(document.querySelector('.muscle-info')).toBeTruthy();
  });

  it('EquipChip shows the icon and label', () => {
    const { container } = render(<EquipChip id="cable" />);
    expect(container.textContent).toContain(en().equipmentNames.cable);
    render(<EquipChip id="weird_thing" />);
    expect(screen.getByText('Weird_thing')).toBeTruthy();
  });
});
