import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MonthGrid, MonthGridLegend, type MonthGridDay } from './MonthGrid';
import { dayKeyOf } from './calendarDays';
import { Stack } from '../../stories/LocaleMatrix';

const TODAY = dayKeyOf(2026, 9, 1); // Thu 1 Oct 2026
const MONTH = TODAY;
const PLAN = ['Legs', 'Pull + Shoulders', 'Back + Arms', null, 'Legs 2', 'Chest 1', 'Chest 2'];

/** Sample month: logged past, a rest week, today, planned future days. */
function sample(d: number): MonthGridDay | undefined {
  const off = d - TODAY;
  const plan = PLAN[(((off + 4) % 7) + 7) % 7];
  if (off === -4)
    return {
      markers: ['workout', 'activity', 'sleep', 'pr'],
      chips: [
        { label: 'Legs', tone: 'accent' },
        { label: 'Walk 40m', tone: 'rest' },
      ],
      meta: '7:55',
      pr: true,
    };
  if (off === -3)
    return {
      tint: 'rest',
      markers: ['activity', 'sleep'],
      chips: [{ label: 'Dance 125m', tone: 'active' }],
      notes: [{ label: 'Rest', tone: 'rest' }],
      meta: '6:30',
    };
  if (off === -2)
    return {
      markers: ['workout', 'sleep'],
      chips: [{ label: 'Pull + Shoulders', tone: 'accent' }],
      meta: '5:23',
    };
  if (off === -1)
    return {
      tint: 'rest',
      markers: ['sleep', 'weight'],
      notes: [{ label: 'Rest', tone: 'rest' }, { label: '81.4 kg' }],
      meta: '7:50',
    };
  if (off === 0)
    return {
      markers: ['planned', 'sleep'],
      chips: [{ label: 'Chest 1', tone: 'accent', planned: true }],
      meta: '8:30',
    };
  if (off === 2)
    return { tint: 'illness', plan: 'rest', notes: [{ label: 'Sick', tone: 'illness' }] };
  if (off > 0)
    return plan
      ? {
          plan: 'train',
          markers: ['planned'],
          chips: [{ label: plan, tone: 'accent', planned: true }],
        }
      : { plan: 'rest', notes: [{ label: 'Rest', tone: 'rest' }] };
  if (off < -4 && off > -12)
    return { markers: ['workout'], chips: [{ label: 'Chest 2', tone: 'accent' }] };
  return undefined;
}

const legend = (
  <MonthGridLegend
    items={[
      { kind: 'workout', label: 'Workout' },
      { kind: 'activity', label: 'Activity' },
      { kind: 'sleep', label: 'Sleep' },
      { kind: 'pr', label: 'PR' },
      { kind: 'weight', label: 'Weight' },
      { kind: 'tint', tone: 'rest', label: 'Rest' },
      { kind: 'tint', tone: 'illness', label: 'Sick' },
      { kind: 'tint', tone: 'neutral', label: 'Off' },
      { kind: 'tint', tone: 'injury', label: 'Injury' },
      { kind: 'plan', label: 'Planned' },
    ]}
  />
);

function Live({ size }: { size: 'sm' | 'lg' }) {
  const [sel, setSel] = useState<number | null>(TODAY - 2);
  return (
    <Stack gap={12} width={size === 'lg' ? 920 : 350}>
      <MonthGrid
        month={MONTH}
        today={TODAY}
        weekStart={7}
        day={sample}
        selected={sel}
        onSelect={setSel}
        size={size}
        todayLabel="Today"
        label="October 2026"
      />
      {legend}
    </Stack>
  );
}

const meta = {
  title: 'Kit/MonthGrid',
  component: MonthGrid,
  args: {
    month: MONTH,
    today: TODAY,
    weekStart: 7,
    day: sample,
    selected: TODAY - 2,
    size: 'sm',
    todayLabel: 'Today',
    label: 'October 2026',
  },
  decorators: [
    (S) => (
      <div style={{ width: 350 }}>
        <S />
      </div>
    ),
  ],
} satisfies Meta<typeof MonthGrid>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Phone: markers, tints, planned dashes, today ring, selection (click / arrows). */
export const Phone: Story = { render: () => <Live size="sm" /> };

/** Desktop: chips with session / activity names, hours slept, notes. */
export const Desktop: Story = {
  decorators: [
    (S) => (
      <div style={{ width: 920 }}>
        <S />
      </div>
    ),
  ],
  render: () => <Live size="lg" />,
};

/** Monday week start, nothing logged (empty month). */
export const EmptyMondayStart: Story = {
  args: { day: () => undefined, weekStart: 1, selected: null },
};

/** Legend alone. */
export const Legend: Story = { render: () => legend };
