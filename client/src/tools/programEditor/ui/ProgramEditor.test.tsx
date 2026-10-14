import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pgEn } from '../../../i18n/coachProgram.en';
import { setViewport } from '../../../coach/testViewport';
import { dayItems, type ProgramDoc } from '../model/doc';
import { setIdGenerator } from '../model/ops';
import type { CanvasProps, ProgramEditorHost } from '../host';
import { demoDoc, demoHost } from '../stories/demoHost';
import { ProgramEditor, type ProgramEditorProps } from './ProgramEditor';

const p = pgEn;
let n = 0;
beforeEach(() => {
  n = 0;
  setIdGenerator(() => `t-${++n}`);
  setViewport(1440);
});
afterEach(() => {
  cleanup();
  setIdGenerator();
});

/** A host application in miniature: owns the doc, hands it to the tool, records every change. */
function App({
  host = demoHost(),
  start = demoDoc(),
  seen,
  ...rest
}: Partial<Omit<ProgramEditorProps, 'doc' | 'onChange' | 'host'>> & {
  host?: ProgramEditorHost;
  start?: ProgramDoc;
  seen?: ProgramDoc[];
}) {
  const [doc, setDoc] = useState(start);
  return (
    <ProgramEditor
      {...rest}
      host={host}
      doc={doc}
      onChange={(d) => {
        seen?.push(d);
        setDoc(d);
      }}
    />
  );
}

const row = (name: string) => screen.findByRole('button', { name: new RegExp(name) });
const stepper = (label: string) => screen.getByRole('group', { name: label });

describe('ProgramEditor (controlled by a plain document)', () => {
  it('renders the week, the selected day and the empty inspector', async () => {
    render(<App audience="Oleh Bondar" />);
    expect(await screen.findByRole('tablist', { name: p.edDayTabs })).toBeTruthy();
    expect(screen.getAllByRole('tab').length).toBe(3);
    expect(screen.getByText('Barbell Bench Press')).toBeTruthy();
    expect(screen.getByText(p.edSelectRow)).toBeTruthy();
  });

  it('change sets: the doc that goes out has the new number, the input doc is untouched', async () => {
    const seen: ProgramDoc[] = [];
    const start = demoDoc();
    const before = JSON.stringify(start);
    render(<App start={start} seen={seen} />);
    fireEvent.click(await row('Barbell Bench Press'));
    const sets = within(stepper(p.edSets));
    fireEvent.click(sets.getByRole('button', { name: '+' }));
    expect(seen.length).toBe(1);
    expect(seen[0].items.find((i) => i.name === 'Barbell Bench Press')?.sets).toBe(5);
    expect(JSON.stringify(start)).toBe(before);
  });

  it('add exercise from the library: a bare row appears and is selected', async () => {
    const seen: ProgramDoc[] = [];
    render(<App seen={seen} audience="Yulia Sydorenko" />);
    fireEvent.click(await screen.findByRole('button', { name: p.edAddExercise }));
    fireEvent.change(await screen.findByPlaceholderText(p.edSearchEx), {
      target: { value: 'pull-up' },
    });
    fireEvent.click(await screen.findByText('Pull-Up'));
    const added = seen.at(-1)!.items.find((i) => i.name === 'Pull-Up')!;
    expect(added.bare).toBe(true);
    expect(await screen.findByText(p.edBareBody('Yulia'))).toBeTruthy();
  });

  it('reorder: Move down swaps the row with the next one', async () => {
    const seen: ProgramDoc[] = [];
    render(<App seen={seen} />);
    fireEvent.click(await row('Barbell Bench Press'));
    fireEvent.click(await screen.findByRole('button', { name: p.edMoveDown }));
    const names = dayItems(seen.at(-1)!, 1).map((i) => i.name);
    expect(names.slice(0, 2)).toEqual(['Barbell Row', 'Barbell Bench Press']);
  });

  it('undo and redo: the toolbar walks the history and tells the host', async () => {
    const seen: ProgramDoc[] = [];
    const metas: string[] = [];
    function Probe() {
      const [doc, setDoc] = useState(demoDoc());
      return (
        <ProgramEditor
          host={demoHost()}
          doc={doc}
          onChange={(d, m) => {
            seen.push(d);
            metas.push(m.kind);
            setDoc(d);
          }}
        />
      );
    }
    render(<Probe />);
    const undo = await screen.findByRole('button', { name: p.edUndo });
    const redo = screen.getByRole('button', { name: p.edRedo });
    expect(undo.hasAttribute('disabled')).toBe(true);
    fireEvent.click(await row('Barbell Bench Press'));
    const sets = within(stepper(p.edSets));
    fireEvent.click(sets.getByRole('button', { name: '+' }));
    fireEvent.click(sets.getByRole('button', { name: '+' }));
    expect(seen.at(-1)!.items.find((i) => i.name === 'Barbell Bench Press')?.sets).toBe(6);
    fireEvent.click(screen.getByRole('button', { name: p.edUndo }));
    expect(seen.at(-1)!.items.find((i) => i.name === 'Barbell Bench Press')?.sets).toBe(5);
    expect(screen.getByRole('button', { name: p.edRedo }).hasAttribute('disabled')).toBe(false);
    fireEvent.click(redo);
    expect(seen.at(-1)!.items.find((i) => i.name === 'Barbell Bench Press')?.sets).toBe(6);
    expect(metas).toEqual(['edit', 'edit', 'undo', 'redo']);
  });

  it('a document that arrives from outside starts a new history (no undo into a stale program)', async () => {
    function Host() {
      const [doc, setDoc] = useState(demoDoc());
      return (
        <>
          <button type="button" onClick={() => setDoc(demoDoc('Reloaded'))}>
            reload
          </button>
          <ProgramEditor host={demoHost()} doc={doc} onChange={setDoc} />
        </>
      );
    }
    render(<Host />);
    fireEvent.click(await row('Barbell Bench Press'));
    fireEvent.click(within(stepper(p.edSets)).getByRole('button', { name: '+' }));
    expect(screen.getByRole('button', { name: p.edUndo }).hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByText('reload'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: p.edUndo }).hasAttribute('disabled')).toBe(true),
    );
  });

  it('read-only: no edit controls, no history, nothing goes out', async () => {
    const seen: ProgramDoc[] = [];
    render(<App readOnly seen={seen} />);
    expect(await screen.findByRole('tablist')).toBeTruthy();
    expect(screen.queryByRole('button', { name: p.edAddExercise })).toBeNull();
    expect(screen.queryByRole('toolbar', { name: p.edHistory })).toBeNull();
    fireEvent.click(screen.getByText('Barbell Bench Press'));
    // the pane is a disabled fieldset
    const pane = await screen.findByRole('group', { name: p.edInspExercise });
    expect(pane.tagName).toBe('FIELDSET');
    expect(pane.hasAttribute('disabled')).toBe(true);
    expect(seen.length).toBe(0);
  });

  it('the mode switch asks before it drops rows, and the toast undoes it', async () => {
    const seen: ProgramDoc[] = [];
    render(<App seen={seen} />);
    const seg = await screen.findByRole('group', { name: p.edDayMode });
    fireEvent.click(within(seg).getByRole('button', { name: new RegExp(p.edMuscles) }));
    const dlg = await screen.findByRole('alertdialog');
    fireEvent.click(within(dlg).getByRole('button', { name: p.edSwitchBtn }));
    expect(dayItems(seen.at(-1)!, 1)).toEqual([]);
    // the toast's Undo (the last one) brings the rows back
    const undos = await screen.findAllByRole('button', { name: p.edUndo });
    fireEvent.click(undos[undos.length - 1]);
    expect(dayItems(seen.at(-1)!, 1).length).toBe(4);
  });

  it('middleware can veto and normalise every edit', async () => {
    const seen: ProgramDoc[] = [];
    const host = demoHost({
      middleware: [({ prev, next }) => (next.items.some((i) => i.sets > 5) ? prev : next)],
    });
    render(<App host={host} seen={seen} />);
    fireEvent.click(await row('Barbell Bench Press'));
    const sets = within(stepper(p.edSets));
    fireEvent.click(sets.getByRole('button', { name: '+' })); // 5: fine
    fireEvent.click(sets.getByRole('button', { name: '+' })); // 6: vetoed
    expect(seen.length).toBe(1);
    expect(seen[0].items.find((i) => i.name === 'Barbell Bench Press')?.sets).toBe(5);
  });

  it('feature switches hide whole parts of the UI', async () => {
    const host = demoHost({
      features: { library: false, copyDay: false, activities: false, history: false },
    });
    render(<App host={host} />);
    await screen.findByRole('tablist');
    expect(screen.queryByRole('button', { name: p.edCopyDay })).toBeNull();
    expect(screen.queryByRole('button', { name: p.edCopyTemplate })).toBeNull();
    expect(screen.queryByRole('button', { name: p.edAddActivity })).toBeNull();
    expect(screen.queryByRole('toolbar', { name: p.edHistory })).toBeNull();
    expect(screen.getByRole('button', { name: p.edAddExercise })).toBeTruthy();
  });

  it('self mode has no "what X sees" preview and no partner tags', async () => {
    render(<App host={demoHost({ mode: 'self' })} />);
    await screen.findByRole('tablist');
    expect(
      screen.queryByRole('button', { name: new RegExp(p.edPreview('').trim().split(' ')[0]) }),
    ).toBeNull();
    expect(screen.queryByText(p.edSolo)).toBeNull();
  });

  it('coach mode with a partner tags the days done together', async () => {
    render(<App partner="Iryna Melnyk" partnerDays={[1]} audience="Oleh Bondar" />);
    await screen.findByRole('tablist');
    expect(screen.getAllByText(p.edWithTrainer('Iryna')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(p.edSolo).length).toBeGreaterThan(0);
  });

  it('extension point: a host canvas replaces the week canvas; the inspector and history stay', async () => {
    const seen: ProgramDoc[] = [];
    function Grid({ state, actions }: CanvasProps) {
      return (
        <section aria-label="grid canvas">
          {state.doc.items.map((i) => (
            <button key={i.id} type="button" onClick={() => actions.select(i.id)}>
              {`cell ${i.name}`}
            </button>
          ))}
        </section>
      );
    }
    render(<App host={demoHost({ slots: { canvas: Grid } })} seen={seen} />);
    expect(await screen.findByRole('region', { name: 'grid canvas' })).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'cell Barbell Bench Press' }));
    fireEvent.click(within(stepper(p.edSets)).getByRole('button', { name: '+' }));
    expect(seen.length).toBe(1);
    expect(screen.getByRole('button', { name: p.edUndo })).toBeTruthy();
  });

  it('extension point: a host panel opens through actions.openPane', async () => {
    function Grid({ actions }: CanvasProps) {
      return (
        <button type="button" onClick={() => actions.openPane('notes')}>
          open notes
        </button>
      );
    }
    const host = demoHost({
      slots: {
        canvas: Grid,
        panes: { notes: { title: () => 'Coach notes', render: () => <p>my own panel</p> } },
      },
    });
    render(<App host={host} />);
    fireEvent.click(await screen.findByText('open notes'));
    expect(await screen.findByRole('heading', { name: 'Coach notes' })).toBeTruthy();
    expect(screen.getByText('my own panel')).toBeTruthy();
  });

  it('long uk / pl labels render without dropping a row or a button', async () => {
    for (const locale of ['uk', 'pl'] as const) {
      const { unmount } = render(<App host={demoHost({ locale })} />);
      expect((await screen.findAllByRole('tab')).length).toBe(3);
      unmount();
    }
  });

  it('phone: the inspector is a sheet that opens on selection and closes with Done', async () => {
    setViewport(390);
    render(<App />);
    fireEvent.click(await row('Barbell Bench Press'));
    const done = await screen.findByRole('button', { name: p.edDone });
    expect(screen.getByText(p.edSets)).toBeTruthy();
    fireEvent.click(done);
    await waitFor(() => expect(screen.queryByRole('button', { name: p.edDone })).toBeNull());
  });

  it('a program with no training day offers the weekdays to start from', async () => {
    const seen: ProgramDoc[] = [];
    render(<App start={{ name: 'x', dayNames: {}, targetMuscles: {}, items: [] }} seen={seen} />);
    fireEvent.click(await screen.findByRole('button', { name: p.dowShort.Wed }));
    expect(seen.at(-1)!.dayNames['3']).toBe(p.dowFull.Wed);
  });

  it('focus lands on a weekday and row once', async () => {
    render(<App focus={{ day: 3, itemId: 'none', rowName: 'Barbell Squat' }} />);
    expect(await screen.findByRole('heading', { name: p.edInspExercise })).toBeTruthy();
    expect(screen.getAllByText('Barbell Squat').length).toBeGreaterThan(0);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.find((t) => t.getAttribute('aria-selected') === 'true')?.textContent).toContain(
      'Lower A',
    );
  });
});

describe('a11y structure', () => {
  it('every control has an accessible name, ids are unique, headings are in order', async () => {
    const { container } = render(<App audience="Oleh Bondar" />);
    fireEvent.click(await row('Barbell Bench Press'));
    await screen.findByText(p.edSets);
    for (const el of container.querySelectorAll(
      'button, input, select, textarea, [role="tab"], [role="switch"]',
    )) {
      const name =
        el.getAttribute('aria-label') ||
        el.textContent?.trim() ||
        (el.id && container.querySelector(`label[for="${el.id}"]`)?.textContent) ||
        el.getAttribute('placeholder') ||
        el.closest('label')?.textContent?.trim();
      expect(name, `unnamed control: ${el.outerHTML.slice(0, 120)}`).toBeTruthy();
    }
    const ids = [...container.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const levels = [...container.querySelectorAll('h1,h2,h3,h4')].map((h) => Number(h.tagName[1]));
    expect(levels.every((l, i) => i === 0 || l - levels[i - 1] <= 1 || l <= levels[i - 1])).toBe(
      true,
    );
  });

  it('segmented controls are named groups; the day strip is a named tablist', async () => {
    render(<App />);
    expect(await screen.findByRole('group', { name: p.edDayMode })).toBeTruthy();
    expect(screen.getByRole('tablist', { name: p.edDayTabs })).toBeTruthy();
    expect(screen.getByRole('toolbar', { name: p.edHistory })).toBeTruthy();
  });

  it('no keyboard shortcuts are bound on the document', async () => {
    const spy = vi.spyOn(document, 'addEventListener');
    render(<App />);
    await screen.findByRole('tablist');
    await act(async () => undefined);
    expect(spy.mock.calls.filter(([t]) => String(t).startsWith('key')).length).toBe(0);
    spy.mockRestore();
  });
});

describe('custom exercise by name, activity removal (coach mode)', () => {
  const openAdd = async () =>
    fireEvent.click(await screen.findByRole('button', { name: p.edAddExercise }));
  const type = async (v: string) =>
    fireEvent.change(await screen.findByPlaceholderText(p.edSearchEx), { target: { value: v } });

  it('an unknown name is offered once, added bare in coach mode; the host can spell it its way', async () => {
    const seen: ProgramDoc[] = [];
    render(
      <App
        seen={seen}
        host={demoHost({ canonicalName: (n) => n.replace(/^cable /i, 'Cable ') })}
      />,
    );
    await openAdd();
    await type('  cable   hip   thing ');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(p.edCreateExNote) }));
    const added = dayItems(seen.at(-1)!, 1).at(-1)!;
    expect(added.name).toBe('Cable hip thing');
    expect(added.bare).toBe(true);
  });

  it('a known exercise, a name already on the day, an empty box, and the feature switched off: no create row', async () => {
    const { unmount } = render(<App />);
    await openAdd();
    await type('lateral raise');
    expect(screen.queryByText(p.edCreateExNote)).toBeNull(); // known
    await type('Barbell Bench Press');
    expect(screen.queryByText(p.edCreateExNote)).toBeNull(); // on the day
    await type('   ');
    expect(screen.queryByText(p.edCreateExNote)).toBeNull(); // nothing typed
    unmount();
    render(<App host={demoHost({ features: { customExercise: false } })} />);
    await openAdd();
    await type('zzz new move');
    expect(screen.queryByText(p.edCreateExNote)).toBeNull();
  });

  it('a host picker slot replaces the browse overlay and its callbacks add rows', async () => {
    const seen: ProgramDoc[] = [];
    const Picker: NonNullable<ProgramEditorHost['slots']>['exercisePicker'] = (pp) => (
      <div role="dialog" aria-label="host picker">
        <span>{pp.dayLabel}</span>
        <button onClick={() => pp.onPick('Lateral Raise')}>pick</button>
        <button onClick={() => pp.onCreate('  My  move ')}>make</button>
        <button onClick={() => pp.onMarker('warmup')}>marker</button>
        <button onClick={pp.onClose}>close</button>
      </div>
    );
    const base = demoHost();
    render(
      <App seen={seen} host={{ ...base, slots: { ...base.slots, exercisePicker: Picker } }} />,
    );
    await openAdd();
    fireEvent.click(screen.getByRole('button', { name: p.edBrowseAll }));
    expect(
      within(screen.getByRole('dialog', { name: 'host picker' })).getByText('Upper A'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'make' }));
    expect(screen.queryByRole('dialog', { name: 'host picker' })).toBeNull();
    expect(dayItems(seen.at(-1)!, 1).at(-1)!.name).toBe('My move');
    await openAdd();
    fireEvent.click(screen.getByRole('button', { name: p.edBrowseAll }));
    fireEvent.click(screen.getByRole('button', { name: 'marker' }));
    expect(dayItems(seen.at(-1)!, 1).some((i) => i.kind === 'warmup')).toBe(true);
  });

  it('an activity the person never changed goes without a question and Undo is offered; an edited one asks', async () => {
    const seen: ProgramDoc[] = [];
    const base = demoDoc();
    const doc: ProgramDoc = {
      ...base,
      activities: [
        { id: 'a1', day: 1, type: 'run', minutes: 30, effort: 'moderate', when: 'any' },
        { id: 'a2', day: 1, type: 'swim', minutes: 50, effort: 'hard', when: 'before' },
      ],
    };
    render(<App start={doc} seen={seen} />);
    fireEvent.click(await screen.findByRole('button', { name: /Run/ }));
    fireEvent.click(screen.getByRole('button', { name: p.edRemove }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(seen.at(-1)!.activities!.map((a) => a.id)).toEqual(['a2']);
    expect(screen.getByText(p.edActRemoved('Run'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Swim/ }));
    fireEvent.click(screen.getByRole('button', { name: p.edRemove }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(seen.at(-1)!.activities!.map((a) => a.id)).toEqual(['a2']); // nothing yet
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: p.edActRemoveBtn }),
    );
    expect(seen.at(-1)!.activities).toEqual([]);
  });
});

describe('inspector scroll region (axe: scrollable-region-focusable)', () => {
  it('takes a tab stop when it holds nothing focusable (read-only), none when it has controls', async () => {
    const { unmount } = render(<App readOnly initial={{ rowName: 'Barbell Bench Press' }} />);
    await screen.findByRole('complementary', { name: p.edInspEditor });
    await waitFor(() =>
      expect(
        screen.getByRole('complementary', { name: p.edInspEditor }).getAttribute('tabindex'),
      ).toBe('0'),
    );
    unmount();
    render(<App initial={{ rowName: 'Barbell Bench Press' }} />);
    const aside = await screen.findByRole('complementary', { name: p.edInspEditor });
    await waitFor(() => expect(aside.querySelector('button')).toBeTruthy());
    expect(aside.getAttribute('tabindex')).toBeNull();
  });
});
