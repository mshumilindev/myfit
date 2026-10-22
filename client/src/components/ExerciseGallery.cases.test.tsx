import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { LOCALES, setLocale } from '../i18n';
import { BUILT_IN_CATALOG, richExerciseByName, secondaryMusclesOf } from '../data/exercises';
import { MUSCLE_IDS } from './Muscle';
import type { MyExercise } from '../store';
import type { Shell } from '../App';

const myExercises = vi.fn<() => MyExercise[]>(() => []);
const knownExercises = vi.fn<() => { name: string }[]>(() => []);
const saveCatalogExercise = vi.fn();
const updateCatalogExercise = vi.fn();
const deleteCatalogExercise = vi.fn();
const getRole = vi.fn<() => string>(() => 'member');
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  myExercises: () => myExercises(),
  knownExercises: () => knownExercises(),
  saveCatalogExercise: (...a: unknown[]) => saveCatalogExercise(...a),
  updateCatalogExercise: (...a: unknown[]) => updateCatalogExercise(...a),
  deleteCatalogExercise: (...a: unknown[]) => deleteCatalogExercise(...a),
}));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getRole: () => getRole(),
}));

import { ExerciseGallery, type GalleryState } from './ExerciseGallery';

const en = () => LOCALES.en;
const openOverlay = vi.fn();
const shell = { openOverlay } as unknown as Shell;
const first = BUILT_IN_CATALOG[0].names[0];
const withPhoto = BUILT_IN_CATALOG.find((c) => richExerciseByName(c.names[0])?.images?.[0])!
  .names[0];

function mql(desktop: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: desktop && q.includes('min-width'),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as never;
}
type IOCb = (e: Array<{ isIntersecting: boolean }>) => void;
let ioCallbacks: IOCb[] = [];
let ioDisconnects = 0;
function stubIO() {
  ioCallbacks = [];
  ioDisconnects = 0;
  window.IntersectionObserver = class {
    constructor(cb: IOCb) {
      ioCallbacks.push(cb);
    }
    observe() {}
    unobserve() {}
    disconnect() {
      ioDisconnects++;
    }
  } as never;
}

/** Controlled gallery that records every state patch the screen asks for. */
function Harness({
  initial = { q: '' },
  desktop = false,
  tab,
}: {
  initial?: GalleryState;
  desktop?: boolean;
  tab?: 'library' | 'mine';
}) {
  const [s, setS] = useState<GalleryState>(initial);
  void desktop;
  return <ExerciseGallery shell={shell} state={s} onState={setS} libTab={tab} />;
}
const rowsOf = () => [...document.querySelectorAll('.exl-mrow, .exl-card')];
const mine = (over: Partial<MyExercise> = {}): MyExercise => ({
  id: 'c1',
  name: 'Cable Fly X',
  primaryMuscle: 'chest',
  secondaryMuscles: ['triceps'],
  equipment: ['cable'],
  source: 'catalog',
  ...over,
});

beforeEach(() => {
  setLocale('en');
  [
    myExercises,
    knownExercises,
    saveCatalogExercise,
    updateCatalogExercise,
    deleteCatalogExercise,
    openOverlay,
  ].forEach((m) => m.mockClear());
  myExercises.mockReturnValue([]);
  knownExercises.mockReturnValue([]);
  getRole.mockReturnValue('member');
  mql(false);
  stubIO();
});
afterEach(cleanup);

describe('ExerciseGallery · library (phone)', () => {
  it('shows the library heading, coverage line and the first page of 12 rows', () => {
    render(<ExerciseGallery shell={shell} />);
    expect(screen.getByRole('heading', { name: en().exercisesTitle })).toBeTruthy();
    expect(document.querySelector('.exl-cov')!.textContent).toMatch(
      new RegExp(`^${BUILT_IN_CATALOG.length} in the library`),
    );
    expect(rowsOf()).toHaveLength(12);
    expect(document.querySelector('.exl.desktop')).toBeNull();
    // sorted alphabetically
    const names = rowsOf().map((r) => r.querySelector('.exl-mname')!.textContent!);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('opens the exercise detail when a row is tapped', () => {
    render(<ExerciseGallery shell={shell} />);
    const row = rowsOf()[0] as HTMLElement;
    fireEvent.click(row);
    expect(openOverlay).toHaveBeenCalledWith({
      screen: 'exercise-detail',
      name: row.querySelector('.exl-mname')!.textContent,
    });
  });

  it('"Show more" reveals the next page; the sentinel observer does too and is cleaned up', () => {
    const { unmount } = render(<ExerciseGallery shell={shell} />);
    fireEvent.click(screen.getByRole('button', { name: en().showMore }));
    expect(rowsOf()).toHaveLength(24);
    act(() => ioCallbacks.at(-1)!([{ isIntersecting: false }]));
    expect(rowsOf()).toHaveLength(24);
    act(() => ioCallbacks.at(-1)!([{ isIntersecting: true }]));
    expect(rowsOf()).toHaveLength(36);
    unmount();
    expect(ioDisconnects).toBeGreaterThan(0);
  });

  it('works without IntersectionObserver (falls back to the button)', () => {
    // @ts-expect-error old browser
    window.IntersectionObserver = undefined;
    render(<ExerciseGallery shell={shell} />);
    fireEvent.click(screen.getByRole('button', { name: en().showMore }));
    expect(rowsOf()).toHaveLength(24);
  });

  it('search narrows the list and resets paging; a no-match query shows no rows', () => {
    render(<ExerciseGallery shell={shell} />);
    fireEvent.click(screen.getByRole('button', { name: en().showMore }));
    const input = screen.getByPlaceholderText(en().searchExercises);
    fireEvent.change(input, { target: { value: first } });
    expect(rowsOf().map((r) => r.querySelector('.exl-mname')!.textContent)).toContain(first);
    expect(rowsOf().length).toBeLessThan(12);
    fireEvent.change(input, { target: { value: 'zzqqxx' } });
    expect(rowsOf()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: en().showMore })).toBeNull();
  });

  it('history-only exercises are appended; ones already in the catalogue are not duplicated', () => {
    knownExercises.mockReturnValue([{ name: 'Totally Custom Lift' }, { name: first }]);
    render(<ExerciseGallery shell={shell} />);
    expect(document.querySelector('.exl-cov')!.textContent).toMatch(
      new RegExp(`^${BUILT_IN_CATALOG.length + 1} in the library`),
    );
    fireEvent.change(screen.getByPlaceholderText(en().searchExercises), {
      target: { value: 'totally custom' },
    });
    const hit = rowsOf();
    expect(hit).toHaveLength(1);
    expect(hit[0].querySelector('.exl-mmus')!.textContent).toBe(''); // no muscles known
    expect(hit[0].querySelector('.exl-noneglyph, .exl-glyph')).toBeTruthy();
  });

  it('exercises with a photo preview it, and a broken photo hides itself', () => {
    render(<ExerciseGallery shell={shell} state={{ q: withPhoto }} onState={() => undefined} />);
    const row = rowsOf().find((r) => r.querySelector('.exl-mname')!.textContent === withPhoto)!;
    const img = row.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    fireEvent.error(img);
    expect(img.style.display).toBe('none');
  });
});

describe('ExerciseGallery · filters', () => {
  const sheetOf = () => document.querySelector('.new-exercise-sheet') as HTMLElement;

  it('the funnel opens a filter sheet and Back closes it', () => {
    render(<Harness />);
    expect(sheetOf()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en().libFiltersLabel }));
    expect(sheetOf()).toBeTruthy();
    expect(within(sheetOf()).getByText(en().muscleGroupsLabel)).toBeTruthy();
    fireEvent.click(sheetOf().querySelector('.sheet-back') as HTMLElement);
    expect(sheetOf()).toBeNull();
  });

  it.each([
    ['Chest', 'muscle', 'chest'],
    ['Strength', 'category', 'strength'],
    ['Compound', 'mechanic', 'compound'],
    ['Push', 'force', 'push'],
    ['Beginner', 'level', 'beginner'],
    ['Barbell', 'equip', 'barbell'],
  ] as const)('the %s chip sets %s and shows a removable active chip', (label, key, value) => {
    const spy = vi.fn();
    function Spy() {
      const [s, setS] = useState<GalleryState>({ q: '' });
      return (
        <ExerciseGallery
          shell={shell}
          state={s}
          onState={(n) => {
            spy(n);
            setS(n);
          }}
        />
      );
    }
    render(<Spy />);
    fireEvent.click(screen.getByRole('button', { name: en().libFiltersLabel }));
    fireEvent.click(within(sheetOf()).getByRole('button', { name: label }));
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ [key]: value }));
    // the active chip lives in the main column
    const active = document.querySelector('.exl-active')!;
    expect(active.textContent).toContain(label);
    expect(rowsOf().length).toBeLessThanOrEqual(12);
    fireEvent.click(within(active as HTMLElement).getByRole('button', { name: label }));
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ [key]: undefined }));
    expect(document.querySelector('.exl-active')).toBeNull();
  });

  it('tapping a selected chip again clears it', () => {
    render(<Harness initial={{ q: '', level: 'expert' }} />);
    fireEvent.click(screen.getByRole('button', { name: en().libFiltersLabel }));
    fireEvent.click(within(sheetOf()).getByRole('button', { name: 'Expert' }));
    expect(document.querySelector('.exl-active')).toBeNull();
  });

  it('a muscle filter lists primary movers first, then a divider for secondary involvement', () => {
    // a muscle with few primary movers, so the divider falls inside the first page
    const muscle = MUSCLE_IDS.find((m) => {
      const prim = BUILT_IN_CATALOG.filter((c) => c.muscle === m).length;
      const sec = BUILT_IN_CATALOG.filter(
        (c) => c.muscle !== m && secondaryMusclesOf(c).includes(m),
      ).length;
      return prim > 0 && prim < 11 && sec > 0;
    })!;
    expect(muscle).toBeTruthy();
    const primaries = BUILT_IN_CATALOG.filter((c) => c.muscle === muscle).length;
    render(<Harness initial={{ q: '', muscle }} />);
    const divider = document.querySelector('.exl-sec-div')!;
    expect(divider.textContent).toBe(en().exlSecondaryFor(en().muscleGroups[muscle]));
    const kids = [...document.querySelector('.exl-mrows')!.children];
    expect(kids.indexOf(divider)).toBe(primaries);
  });

  it('combines facets (all must hold) and an impossible combination leaves no rows', () => {
    render(
      <Harness
        initial={{
          q: '',
          category: 'stretching',
          equip: 'barbell',
          level: 'expert',
          force: 'static',
        }}
      />,
    );
    expect(rowsOf().length).toBeLessThan(BUILT_IN_CATALOG.length);
    expect(document.querySelectorAll('.exl-active button')).toHaveLength(4);
  });
});

describe('ExerciseGallery · desktop', () => {
  beforeEach(() => mql(true));

  it('renders a filter rail with search, a 24-card grid and no funnel', () => {
    render(<Harness desktop />);
    expect(document.querySelector('.exl.desktop')).toBeTruthy();
    expect(document.querySelector('.exl-funnel')).toBeNull();
    expect(document.querySelectorAll('.exl-card')).toHaveLength(24);
    expect(screen.getAllByPlaceholderText(en().searchExercises)).toHaveLength(1);
    expect(
      within(document.querySelector('.exl-rail') as HTMLElement).getByRole('button', {
        name: 'Chest',
      }),
    ).toBeTruthy();
  });

  it('rail chips filter directly, and cards open the detail', () => {
    render(<Harness desktop />);
    fireEvent.click(
      within(document.querySelector('.exl-rail') as HTMLElement).getByRole('button', {
        name: 'Core',
      }),
    );
    expect(document.querySelector('.exl-active')!.textContent).toContain('Core');
    const card = document.querySelector('.exl-card') as HTMLElement;
    fireEvent.click(card);
    expect(openOverlay).toHaveBeenCalledWith({
      screen: 'exercise-detail',
      name: card.querySelector('.exl-cardname')!.textContent,
    });
  });

  it('cards carry mechanic and equipment badges when known', () => {
    render(<Harness desktop initial={{ q: first }} />);
    const card = rowsOf().find((r) => r.querySelector('.exl-cardname')!.textContent === first)!;
    expect(card.querySelector('.exl-cardbadges')).toBeTruthy();
    expect(card.querySelector('.exl-cardmus')!.textContent).not.toBe('');
  });
});

describe('ExerciseGallery · my exercises', () => {
  const customs = () =>
    myExercises.mockReturnValue([
      mine(),
      mine({
        id: 'logged-zz',
        name: 'Zz Move',
        primaryMuscle: null,
        secondaryMuscles: [],
        equipment: [],
        source: 'logged',
      }),
    ]);
  const mineTab = () =>
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en().libTabMine) }));

  it('the tab shows a count badge and switches between library and mine', () => {
    customs();
    render(<ExerciseGallery shell={shell} />);
    expect(screen.getByRole('button', { name: new RegExp(en().libTabMine) }).textContent).toContain(
      '2',
    );
    mineTab();
    expect(screen.getByRole('heading', { name: en().libTabMine })).toBeTruthy();
    expect(document.querySelector('.exl-cov')!.textContent).toBe(en().libMineCount(2));
    expect(document.querySelectorAll('.exg-mine-row')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: en().libTabLibrary }));
    expect(screen.getByRole('heading', { name: en().exercisesTitle })).toBeTruthy();
  });

  it('is controlled by libTab and reports changes to onLibTab', () => {
    customs();
    const onLibTab = vi.fn();
    render(<ExerciseGallery shell={shell} libTab="mine" onLibTab={onLibTab} />);
    expect(document.querySelectorAll('.exg-mine-row')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: en().libTabLibrary }));
    expect(onLibTab).toHaveBeenCalledWith('library');
  });

  it('shows the empty message when there are none', () => {
    render(<ExerciseGallery shell={shell} libTab="mine" />);
    expect(screen.getByText(en().libNoCustom)).toBeTruthy();
  });

  it('rows show muscles and equipment, or "no classification"; tapping opens the detail', () => {
    customs();
    render(<ExerciseGallery shell={shell} libTab="mine" />);
    const rows = [...document.querySelectorAll('.exg-mine-row')] as HTMLElement[];
    expect(rows[0].querySelector('.exl-mmus')!.textContent).toBe('Chest · Triceps');
    expect(rows[0].querySelector('.exl-mbadges')!.textContent).toBe('Cable');
    expect(rows[1].querySelector('.exl-mmus')!.textContent).toBe(en().libNoClassInline);
    expect(rows[1].querySelector('.exl-mbadges')).toBeNull();
    fireEvent.click(rows[0].querySelector('.exg-mine-open')!);
    expect(openOverlay).toHaveBeenCalledWith({ screen: 'exercise-detail', name: 'Cable Fly X' });
  });

  it("search, muscle and equipment filters narrow the user's own list", () => {
    customs();
    render(<Harness tab="mine" />);
    fireEvent.change(screen.getByPlaceholderText(en().searchExercises), {
      target: { value: 'zz' },
    });
    expect(document.querySelectorAll('.exg-mine-row')).toHaveLength(1);
    fireEvent.change(screen.getByPlaceholderText(en().searchExercises), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: en().libFiltersLabel }));
    fireEvent.click(
      within(document.querySelector('.new-exercise-sheet') as HTMLElement).getByRole('button', {
        name: 'Triceps',
      }),
    );
    expect(document.querySelectorAll('.exg-mine-row')).toHaveLength(1); // secondary muscle counts
    fireEvent.click(
      within(document.querySelector('.new-exercise-sheet') as HTMLElement).getByRole('button', {
        name: 'Barbell',
      }),
    );
    expect(document.querySelectorAll('.exg-mine-row')).toHaveLength(0);
  });

  it('a member cannot create, edit or delete', () => {
    customs();
    render(<ExerciseGallery shell={shell} libTab="mine" />);
    expect(screen.queryByRole('button', { name: en().libCreateExercise })).toBeNull();
    expect(screen.queryByRole('button', { name: en().edit })).toBeNull();
    expect(screen.queryByRole('button', { name: en().openHistory })).toBeNull();
  });

  describe('as a trainer', () => {
    beforeEach(() => {
      getRole.mockReturnValue('trainer');
      customs();
    });

    it('history opens the exercise history overlay', () => {
      render(<ExerciseGallery shell={shell} libTab="mine" />);
      fireEvent.click(screen.getAllByRole('button', { name: en().openHistory })[0]);
      expect(openOverlay).toHaveBeenCalledWith({ screen: 'exercise-history', name: 'Cable Fly X' });
    });

    it('delete is offered only for saved catalogue entries, asks first, then removes', () => {
      render(<ExerciseGallery shell={shell} libTab="mine" />);
      const del = screen.getAllByRole('button', { name: en().bmRemove });
      expect(del).toHaveLength(1);
      fireEvent.click(del[0]);
      expect(screen.getByText(en().libDeleteTitle('Cable Fly X'))).toBeTruthy();
      expect(deleteCatalogExercise).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: en().cancel }));
      expect(screen.queryByText(en().libDeleteTitle('Cable Fly X'))).toBeNull();
      fireEvent.click(screen.getAllByRole('button', { name: en().bmRemove })[0]);
      const dlg = screen
        .getByText(en().libDeleteTitle('Cable Fly X'))
        .closest('[role=dialog], [role=alertdialog]') as HTMLElement;
      fireEvent.click(within(dlg).getByRole('button', { name: en().bmRemove }));
      expect(deleteCatalogExercise).toHaveBeenCalledWith('c1');
    });

    it('editing a saved exercise updates it by id', () => {
      render(<ExerciseGallery shell={shell} libTab="mine" />);
      fireEvent.click(screen.getAllByRole('button', { name: en().edit })[0]);
      expect(screen.getByText(en().libEditExercise)).toBeTruthy();
      const name = screen.getByPlaceholderText(en().exerciseNamePlaceholder) as HTMLInputElement;
      expect(name.value).toBe('Cable Fly X');
      fireEvent.change(name, { target: { value: '  Cable Fly Y  ' } });
      fireEvent.click(screen.getByRole('button', { name: en().save }));
      expect(updateCatalogExercise).toHaveBeenCalledWith('c1', {
        name: 'Cable Fly Y',
        kind: 'strength',
        primaryMuscle: 'chest',
        secondaryMuscles: ['triceps'],
        equipment: ['cable'],
        subRegions: undefined,
      });
      expect(document.querySelector('.new-exercise-sheet')).toBeNull();
    });

    it('editing a history-only exercise promotes it by creating a catalogue entry', () => {
      render(<ExerciseGallery shell={shell} libTab="mine" />);
      fireEvent.click(screen.getAllByRole('button', { name: en().edit })[1]);
      fireEvent.click(
        within(document.querySelector('.new-exercise-sheet') as HTMLElement).getByRole('button', {
          name: en().libCreateExercise,
        }),
      );
      expect(saveCatalogExercise).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Zz Move', primaryMuscle: null }),
      );
      expect(updateCatalogExercise).not.toHaveBeenCalled();
    });

    it('"New exercise" opens an empty editor and creates', () => {
      render(<ExerciseGallery shell={shell} />);
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en().libCreateExercise) }));
      const sheetBtn = () =>
        within(document.querySelector('.new-exercise-sheet') as HTMLElement).getByRole('button', {
          name: en().libCreateExercise,
        }) as HTMLButtonElement;
      expect(sheetBtn().disabled).toBe(true);
      fireEvent.change(screen.getByPlaceholderText(en().exerciseNamePlaceholder), {
        target: { value: 'My Move' },
      });
      expect(sheetBtn().disabled).toBe(false);
      fireEvent.click(sheetBtn());
      expect(saveCatalogExercise).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Move',
          kind: 'strength',
          secondaryMuscles: [],
          equipment: [],
        }),
      );
    });
  });
});
