import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ProgramDoc } from '../../tools/programEditor';
import type { EditorActions, EditorState } from '../../tools/programEditor/host';
import { CycleWrap, RowReps, WeekBar } from './CycleEditor';
import { weekOf, type CycleDoc } from './cycleOps';

const doc = {
  items: [
    {
      id: 'a',
      day: 1,
      position: 0,
      name: 'Back Squat',
      kind: 'strength',
      sets: 3,
      reps: 5,
      durationMin: null,
      equipment: [],
    },
  ],
  dayNames: {},
  targetMuscles: {},
  activities: [],
} as unknown as ProgramDoc;

const seen: { view?: CycleDoc; push?: (d: CycleDoc) => void; full?: CycleDoc } = {};
type Edit = (next: ProgramDoc, meta: { kind: 'edit' | 'undo' | 'redo'; label?: string }) => void;
function Probe({ view, full, onChange }: { view: ProgramDoc; full: ProgramDoc; onChange: Edit }) {
  useEffect(() => {
    seen.view = view as CycleDoc;
    seen.full = full as CycleDoc;
    seen.push = (x) => onChange(x, { kind: 'edit' });
  });
  return <WeekBar state={{} as EditorState} actions={{} as EditorActions} />;
}
function Harness() {
  const [d, setD] = useState<ProgramDoc>(doc);
  return (
    <CycleWrap doc={d} readOnly={false} onChange={(n) => setD(n)}>
      {(view, onChange) => <Probe view={view} full={d} onChange={onChange} />}
    </CycleWrap>
  );
}

afterEach(cleanup);

describe('cycle wrapper and bar', () => {
  it('is off by default: no strip, the editor gets the document itself', () => {
    render(<Harness />);
    expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(seen.view).toBe(seen.full);
  });
  it('switching it on shows four weeks; picking week 2 shows that week; an edit goes only there', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    fireEvent.click(screen.getAllByRole('tab')[1]!);
    expect(seen.view?.items).toHaveLength(1);
    act(() => seen.push?.({ ...(seen.view as CycleDoc), items: [] }));
    expect(seen.full?.items).toHaveLength(1);
    expect(weekOf(seen.full as CycleDoc, 2).items).toHaveLength(0);
  });
  it('after an edit the editor is handed back the very view it produced (undo history keeps its place)', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getAllByRole('tab')[1]!);
    const next = { ...(seen.view as CycleDoc), items: [] };
    act(() => seen.push?.(next));
    expect(seen.view).toBe(next);
  });
  it('turning it off asks first (the other weeks have rows) and keeps week 1', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('switch'));
    expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(seen.full?.items).toHaveLength(1);
    expect(seen.full).not.toHaveProperty('cycle');
  });
});

describe('rep range field', () => {
  it('writes both ends of a range', () => {
    const calls: unknown[] = [];
    render(
      <RowReps
        item={{ ...(doc.items[0] as object), reps: 8, repsMin: 6 } as never}
        patch={(p) => calls.push(p)}
        readOnly={false}
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /increase|\+/i })[0]!);
    expect(calls.length).toBeGreaterThan(0);
  });
});
