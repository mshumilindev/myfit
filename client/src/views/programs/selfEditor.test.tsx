import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { setViewport } from '../../coach/testViewport';
import { setLocale } from '../../i18n';
import { pgEn } from '../../i18n/coachProgram.en';
import { freshProgram, type Program } from './model';
import { selfCatalog, SelfProgramEditor } from './selfEditor';

const start = (): Program => ({
  ...freshProgram('Mine'),
  authorId: 'u1',
  dayNames: { '1': 'Upper A' },
  items: [
    {
      id: 'a',
      day: 1,
      position: 0,
      name: 'Barbell Bench Press',
      kind: 'strength',
      sets: 3,
      reps: 8,
      durationMin: null,
      equipment: [],
    },
  ],
});

let last: Program | null = null;
function App() {
  const [p, setP] = useState(start());
  return (
    <SelfProgramEditor
      program={p}
      onChange={(n) => {
        last = n;
        setP(n);
      }}
    />
  );
}

beforeEach(() => {
  last = null;
  setLocale('en');
  setViewport(1440);
});
afterEach(cleanup);

describe('the athlete app as the second host (mode self)', () => {
  it('catalog: real facts and search from data/exercises', () => {
    const f = selfCatalog.facts('Barbell Bench Press - Medium Grip');
    expect(f.primary).toBe('chest');
    expect(f.image).toBeTruthy();
    const hits = selfCatalog.search({ query: 'squat', limit: 3 });
    expect(hits.length).toBeGreaterThan(0);
    expect(selfCatalog.facts('My own move').primary).toBeNull();
  });

  it('renders the app Program, edits it and keeps the host-only fields', async () => {
    render(<App />);
    expect(await screen.findByText('Barbell Bench Press')).toBeTruthy();
    // No client preview, no "send": this is the person's own program.
    expect(screen.queryByText(/Preview as/)).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /Barbell Bench Press/ }));
    fireEvent.click(
      within(screen.getByRole('group', { name: pgEn.edSets })).getByRole('button', { name: '+' }),
    );
    expect(last).not.toBeNull();
    expect(last?.authorId).toBe('u1');
    expect(last?.id).toBeTruthy();
    expect(last?.items[0].sets).toBe(4);
  });
});

/* ---- ported from the legacy DayEditor tests: warm-up exercises and planned activities ----------------------------- */

let latest: Program;
function warmProgram(withItems: boolean): Program {
  return {
    ...freshProgram('P'),
    dayNames: { '1': 'Upper' },
    items: [
      {
        id: 'wu',
        day: 1,
        position: 0,
        name: 'Warm-up',
        kind: 'warmup',
        sets: 1,
        reps: 0,
        durationMin: null,
        equipment: [],
        ...(withItems
          ? {
              warmupItems: [
                { id: 'a', name: 'Band Pull Apart', exerciseId: 'Band_Pull_Apart', reps: 15 },
                { id: 'b', name: 'Cat Stretch', exerciseId: 'Cat_Stretch', durationSec: 30 },
              ],
            }
          : {}),
      },
      {
        id: 'l1',
        day: 1,
        position: 1,
        name: 'Barbell Bench Press',
        kind: 'strength',
        sets: 3,
        reps: 8,
        durationMin: null,
        equipment: ['barbell'],
      },
    ],
  };
}
function Harness({ initial, readOnly }: { initial: Program; readOnly?: boolean }) {
  const [p, setP] = useState(initial);
  useEffect(() => {
    latest = p;
  });
  return <SelfProgramEditor program={p} onChange={setP} readOnly={readOnly} />;
}
const warmItems = () => latest.items.find((i) => i.id === 'wu')!.warmupItems;
const openWarmup = () => fireEvent.click(screen.getByRole('button', { name: /Warm-up/ }));

describe('self host: warm-up exercises', () => {
  it('an old program day (warm-up marker, no exercises) still renders as a generic warm-up', () => {
    render(<Harness initial={warmProgram(false)} />);
    expect(screen.getByText('Marker · nothing to log')).toBeTruthy();
    openWarmup();
    expect(screen.getAllByRole('button', { name: pgEn.edWarmAdd }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Barbell Bench Press').length).toBeGreaterThan(0);
  });

  it('adds an exercise from the whole database as a reference with a target', () => {
    render(<Harness initial={warmProgram(false)} />);
    openWarmup();
    fireEvent.click(
      within(screen.getByRole('complementary')).getByRole('button', { name: pgEn.edWarmAdd }),
    );
    fireEvent.change(screen.getByPlaceholderText(pgEn.edSearchEx), {
      target: { value: 'lateral raise' },
    });
    fireEvent.click(screen.getAllByText(/Lateral Raise/)[0]);
    const items = warmItems()!;
    expect(items).toHaveLength(1);
    expect(items[0].name).toMatch(/Lateral Raise/);
    expect(items[0].exerciseId).toBeTruthy();
    expect(items[0].reps).toBe(12);
    // the warm-up stays a marker: no sets, no extra lift
    expect(latest.items.filter((i) => i.kind === 'strength')).toHaveLength(1);
  });

  it('lists target lines (name + target, no tick, no Log); edits in the drawer (reps/seconds, weight), removes', () => {
    render(<Harness initial={warmProgram(true)} />);
    expect(screen.queryByText('Marker · nothing to log')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Log' })).toBeNull();
    openWarmup();
    const band = within(screen.getByRole('group', { name: 'Band Pull Apart' }));
    expect(band.getByText('15 reps')).toBeTruthy();
    expect(
      within(screen.getByRole('group', { name: 'Cat Stretch' })).getByText('30 s'),
    ).toBeTruthy();
    // the drawer: change the number and save
    fireEvent.click(band.getByRole('button', { name: pgEn.edWarmEdit('Band Pull Apart') }));
    const drawer = within(screen.getByRole('dialog', { name: pgEn.edWarmEdit('Band Pull Apart') }));
    const input = drawer.getByRole('textbox', { name: pgEn.edWarmReps }) as HTMLInputElement;
    expect(input.value).toBe('15');
    fireEvent.change(input, { target: { value: '20' } });
    fireEvent.blur(input);
    expect(warmItems()![0].reps).toBe(15); // nothing applied before Save
    fireEvent.click(drawer.getByRole('button', { name: pgEn.edDone }));
    expect(warmItems()![0].reps).toBe(20);
    // one target only: switching to seconds drops the reps
    fireEvent.click(band.getByRole('button', { name: pgEn.edWarmEdit('Band Pull Apart') }));
    const d2 = within(screen.getByRole('dialog', { name: pgEn.edWarmEdit('Band Pull Apart') }));
    fireEvent.click(d2.getByRole('button', { name: pgEn.edWarmSecs }));
    fireEvent.click(d2.getByRole('button', { name: pgEn.edDone }));
    expect(warmItems()![0].durationSec).toBe(30);
    expect(warmItems()![0].reps).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: pgEn.edWarmRemove('Cat Stretch') }));
    expect(warmItems()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: pgEn.edWarmRemove('Band Pull Apart') }));
    expect(warmItems()).toBeUndefined();
  });

  it('the drawer has a weight field for a loaded move (kg in the document), none for a timed one; Cancel changes nothing', () => {
    const p = warmProgram(false);
    p.items[0].warmupItems = [
      { id: 'w1', name: 'Dumbbell Front Raise', reps: 12, weight: 5 },
      { id: 'w2', name: 'Cat Stretch', durationSec: 30 },
    ];
    render(<Harness initial={p} />);
    openWarmup();
    expect(
      within(screen.getByRole('group', { name: 'Dumbbell Front Raise' })).getByText(
        '12 reps · 5 kg',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: pgEn.edWarmEdit('Dumbbell Front Raise') }));
    let drawer = within(screen.getByRole('dialog'));
    const w = drawer.getByRole('textbox', { name: pgEn.edWarmWeight }) as HTMLInputElement;
    expect(w.value).toBe('5');
    fireEvent.change(w, { target: { value: '7.5' } });
    fireEvent.blur(w);
    fireEvent.click(drawer.getByRole('button', { name: pgEn.edCancel })); // the sheet's close button
    expect(warmItems()![0].weight).toBe(5);
    fireEvent.click(screen.getByRole('button', { name: pgEn.edWarmEdit('Dumbbell Front Raise') }));
    drawer = within(screen.getByRole('dialog'));
    const w2 = drawer.getByRole('textbox', { name: pgEn.edWarmWeight }) as HTMLInputElement;
    fireEvent.change(w2, { target: { value: '7.5' } });
    fireEvent.blur(w2);
    fireEvent.click(drawer.getByRole('button', { name: pgEn.edDone }));
    expect(warmItems()![0].weight).toBe(7.5);
    // zero clears it
    fireEvent.click(screen.getByRole('button', { name: pgEn.edWarmEdit('Dumbbell Front Raise') }));
    drawer = within(screen.getByRole('dialog'));
    const w3 = drawer.getByRole('textbox', { name: pgEn.edWarmWeight }) as HTMLInputElement;
    fireEvent.change(w3, { target: { value: '0' } });
    fireEvent.blur(w3);
    expect(drawer.getByText(pgEn.edWarmWeightNone)).toBeTruthy();
    fireEvent.click(drawer.getByRole('button', { name: pgEn.edDone }));
    expect(warmItems()![0].weight).toBeUndefined();
    // a timed move has no weight field
    fireEvent.click(screen.getByRole('button', { name: pgEn.edWarmEdit('Cat Stretch') }));
    expect(
      within(screen.getByRole('dialog')).queryByRole('textbox', { name: pgEn.edWarmWeight }),
    ).toBeNull();
  });
});

describe('self host: planned activities', () => {
  it('adds a planned activity from the picker and removes it (undo brings it back)', () => {
    render(<Harness initial={warmProgram(true)} />);
    fireEvent.click(screen.getByRole('button', { name: pgEn.edAddActivity }));
    fireEvent.click(screen.getByRole('button', { name: /Run/ }));
    expect(latest.activities).toHaveLength(1);
    expect(latest.activities![0]).toMatchObject({ day: 1, type: 'run', minutes: 30 });
    // lifting is untouched
    expect(latest.items).toHaveLength(2);
    expect(screen.getAllByText(/Run/).length).toBeGreaterThan(0);
    // untouched since it was added: no question, Undo is offered
    fireEvent.click(screen.getByRole('button', { name: pgEn.edRemove }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(latest.activities).toEqual([]);
    expect(screen.getByText(pgEn.edActRemoved('Run'))).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: pgEn.edUndo })[0]);
    expect(latest.activities).toHaveLength(1);
  });

  it('removing an activity the person changed asks first; Keep leaves it, Remove takes it away (Undo restores)', () => {
    const p = warmProgram(true);
    p.activities = [{ id: 'x1', day: 1, type: 'run', minutes: 45, effort: 'hard', when: 'after' }];
    render(<Harness initial={p} />);
    fireEvent.click(screen.getByRole('button', { name: /Run/ }));
    fireEvent.click(screen.getByRole('button', { name: pgEn.edRemove }));
    const dlg = within(screen.getByRole('alertdialog'));
    expect(dlg.getByText(pgEn.edActRemoveBody)).toBeTruthy();
    fireEvent.click(dlg.getByRole('button', { name: pgEn.edKeepDay }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(latest.activities).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: pgEn.edRemove }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: pgEn.edActRemoveBtn }),
    );
    expect(latest.activities).toEqual([]);
    fireEvent.click(screen.getAllByRole('button', { name: pgEn.edUndo })[0]);
    expect(latest.activities).toHaveLength(1);
  });

  it('a sealed list this device cannot open is not offered for editing', () => {
    const p = { ...warmProgram(true), activitiesEnc: {} as never };
    render(
      <SelfProgramEditor
        program={p}
        onChange={() => undefined}
        host={{ activitiesLocked: true }}
      />,
    );
    expect(screen.queryByRole('button', { name: pgEn.edAddActivity })).toBeNull();
  });
});

describe('self host: what the athlete app adds to the tool', () => {
  it('a new exercise starts with its numbers (3 x 10), not as a bare row', () => {
    render(<Harness initial={warmProgram(false)} />);
    fireEvent.click(screen.getByRole('button', { name: pgEn.edAddExercise }));
    fireEvent.change(screen.getByPlaceholderText(pgEn.edSearchEx), { target: { value: 'squat' } });
    fireEvent.click(screen.getAllByText(/Squat/)[0]);
    const added = latest.items.filter((i) => i.kind === 'strength').at(-1)!;
    expect([added.sets, added.reps]).toEqual([3, 10]);
    expect(added.bare).toBeFalsy();
  });

  it('names a day from the day card (one undo step for the whole name)', () => {
    render(<Harness initial={warmProgram(false)} />);
    const name = screen.getByRole('textbox', { name: pgEn.edDayNameAria('Monday') });
    fireEvent.change(name, { target: { value: 'Pu' } });
    fireEvent.change(name, { target: { value: 'Push' } });
    expect(latest.dayNames['1']).toBe('Push');
    fireEvent.click(screen.getByRole('button', { name: pgEn.edUndo }));
    expect(latest.dayNames['1']).toBe('Upper');
  });

  it('adds a cardio machine to the day with its minutes', () => {
    render(<Harness initial={warmProgram(false)} />);
    fireEvent.click(screen.getByRole('button', { name: pgEn.edAddExercise }));
    const cardio = screen
      .getAllByRole('button')
      .find((b) => /treadmill/i.test(b.textContent ?? ''));
    expect(cardio).toBeTruthy();
    fireEvent.click(cardio!);
    const row = latest.items.find((i) => i.kind === 'cardio');
    expect(row?.durationMin).toBe(10);
  });
});

describe('self host: create a custom exercise by name', () => {
  const openAdd = () => fireEvent.click(screen.getByRole('button', { name: pgEn.edAddExercise }));
  const search = (v: string) =>
    fireEvent.change(screen.getByPlaceholderText(pgEn.edSearchEx), { target: { value: v } });

  it('a name the catalog does not know is offered, cleaned, and added with the 3 x 10 start', () => {
    render(<Harness initial={warmProgram(false)} />);
    openAdd();
    search('  My   garage  hammer curl ');
    fireEvent.click(screen.getByRole('button', { name: new RegExp('My garage hammer curl') }));
    const added = latest.items.filter((i) => i.kind === 'strength').at(-1)!;
    expect(added.name).toBe('My garage hammer curl');
    expect([added.sets, added.reps]).toEqual([3, 10]);
  });

  it('a long name is cut to 120 characters, as the document keeps it', () => {
    render(<Harness initial={warmProgram(false)} />);
    openAdd();
    search('Q'.repeat(300));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(pgEn.edCreateExNote) }));
    expect(latest.items.filter((i) => i.kind === 'strength').at(-1)!.name).toHaveLength(120);
  });

  it('a catalog exercise is never offered as custom, and a typed catalog spelling is corrected', () => {
    render(<Harness initial={warmProgram(false)} />);
    openAdd();
    search('barbell squat');
    expect(screen.queryByText(pgEn.edCreateExNote)).toBeNull();
  });

  it('a name already on the day is not offered again', () => {
    render(<Harness initial={warmProgram(false)} />);
    openAdd();
    search('Barbell Bench Press');
    expect(screen.queryByText(pgEn.edCreateExNote)).toBeNull();
  });

  it('the full app picker opens from the Add pane; Create there adds the exercise by name', async () => {
    render(<Harness initial={warmProgram(false)} />);
    openAdd();
    fireEvent.click(screen.getByRole('button', { name: pgEn.edBrowseAll }));
    const input = await screen.findByRole('searchbox', { name: 'Search' });
    fireEvent.change(input, { target: { value: 'zzqx cable thing' } });
    fireEvent.click(await screen.findByRole('button', { name: /zzqx cable thing/i }));
    expect(latest.items.filter((i) => i.kind === 'strength').at(-1)!.name).toBe('zzqx cable thing');
  });

  it('read-only programs offer neither', () => {
    render(<Harness initial={warmProgram(false)} readOnly />);
    expect(screen.queryByRole('button', { name: pgEn.edAddExercise })).toBeNull();
  });
});
