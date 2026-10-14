import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DataTable } from './DataTable';
import { PresetChips } from './PresetChips';
import { RhythmChart } from './RhythmChart';

afterEach(cleanup);

describe('DataTable', () => {
  it('real table: named, headers announced, numbers right-aligned, footer slot', () => {
    render(
      <DataTable
        label="Lifts"
        columns={[
          { id: 'n', header: 'Lift', strong: true, cell: (r: { n: string; v: number }) => r.n },
          { id: 'v', header: 'Est. 1RM', align: 'end', cell: (r) => `${r.v} kg` },
        ]}
        rows={[{ n: 'Bench', v: 116 }]}
        rowKey={(r) => r.n}
        footer={<a href="#x">All lifts</a>}
      />,
    );
    const t = screen.getByRole('table', { name: 'Lifts' });
    expect(within(t).getAllByRole('columnheader')).toHaveLength(2);
    expect(within(t).getByText('116 kg').className).toBe('is-end');
    expect(screen.getByText('All lifts')).toBeTruthy();
  });
});

describe('RhythmChart', () => {
  const bars = [
    { label: 'W-2', value: 4, ariaLabel: 'W-2: 4 sessions' },
    { label: 'Now', value: 1, current: true, ariaLabel: 'Now: 1 sessions' },
  ];
  it('names each bar, draws the plan line on every bar and a legend for both encodings', () => {
    const { container } = render(
      <RhythmChart
        label="Rhythm"
        bars={bars}
        plan={4}
        legendDone="Done"
        legendPlan="Dashed is the plan"
      />,
    );
    expect(screen.getByRole('figure', { name: 'Rhythm' })).toBeTruthy();
    expect(screen.getAllByRole('listitem', { name: /sessions/ })).toHaveLength(2);
    expect(container.querySelectorAll('.uirh-plan')).toHaveLength(2);
    expect(container.querySelector('.uirh-s.is-now')).toBeTruthy();
    expect(screen.getByText('Dashed is the plan')).toBeTruthy();
  });
  it('y axis tops at the plan rounded up to an even number', () => {
    const { container } = render(
      <RhythmChart label="R" bars={bars} plan={3} legendDone="d" legendPlan="p" />,
    );
    expect([...container.querySelectorAll('.uirh-y span')].map((s) => s.textContent)).toEqual([
      '4',
      '2',
      '0',
    ]);
  });
});

describe('PresetChips readOnly (Coach training days)', () => {
  it('marks session days with a spoken label, as list items not buttons', () => {
    render(
      <PresetChips
        readOnly
        layout="grid"
        label="Training days"
        items={[
          { id: 'a', label: 'Mon', ariaLabel: 'Mon' },
          { id: 'b', label: 'Tue', selected: true, ariaLabel: 'Tue, session with the trainer' },
        ]}
      />,
    );
    const list = screen.getByRole('list', { name: 'Training days' });
    expect(
      within(list).getByRole('listitem', { name: 'Tue, session with the trainer' }).className,
    ).toContain('is-on');
    expect(within(list).getByRole('listitem', { name: 'Mon' }).className).not.toContain('is-on');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
