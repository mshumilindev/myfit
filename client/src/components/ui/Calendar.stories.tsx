import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Calendar, CalendarLegend, type CalendarProps } from './Calendar';
import { PresetChips } from './PresetChips';
import { dayKeyOf } from './calendarDays';
import type { Tone } from './tones';

// A fixed "today" so every story renders the same month: Sat 26 Sep 2026.
const TODAY = dayKeyOf(2026, 8, 26);
const D = (m: number, d: number) => dayKeyOf(2026, m - 1, d);

const MARKS: Record<number, Tone[]> = {
  [D(9, 5)]: ['accent', 'rest'],
  [D(9, 12)]: ['accent', 'rest'],
  [D(9, 14)]: ['accent'],
  [D(9, 17)]: ['sport'],
  [D(9, 19)]: ['accent', 'sport', 'rest'],
  [D(9, 23)]: ['sport'],
  [D(9, 25)]: ['accent'],
};

function Single(props: Partial<CalendarProps>) {
  const [v, setV] = useState<number>(props.value ?? D(9, 25));
  return <Calendar today={TODAY} max={TODAY} {...props} value={v} onSelect={setV} />;
}

function Range({
  start,
  end,
  open,
  ...props
}: Partial<CalendarProps> & { start?: number; end?: number; open?: boolean }) {
  const [r, setR] = useState({ start: start ?? D(9, 12), end: end ?? D(9, 18) });
  const [pickEnd, setPickEnd] = useState(false);
  return (
    <Calendar
      mode="range"
      today={TODAY}
      {...props}
      range={{ ...r, open }}
      onSelect={(d) => {
        if (!pickEnd || d < r.start) setR({ start: d, end: d });
        else setR({ start: r.start, end: d });
        setPickEnd(!pickEnd);
      }}
    />
  );
}

const meta = {
  title: 'Kit/Calendar',
  component: Calendar,
  parameters: {
    docs: {
      description: {
        component:
          'The one calendar: single or range, week start from settings, min/max/disabled, markers, today ring, keyboard grid, presets slot, 1–2 months.',
      },
    },
  },
  args: { onSelect: () => undefined },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Calendar>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Single date, future disabled, activity markers + legend (Log activity › Pick a day). */
export const SingleWithMarkers: Story = {
  render: () => (
    <Single
      tone="accent"
      markers={(d) => MARKS[d]}
      footer={
        <CalendarLegend
          items={[
            { tone: 'accent', label: 'Conditioning' },
            { tone: 'sport', label: 'Sports' },
            { tone: 'rest', label: 'Recovery' },
          ]}
        />
      }
    />
  ),
};

/** A 7-day range with rounded caps; a band that wraps the week keeps rounded row ends. */
export const RangeIllness: Story = {
  render: () => (
    <Range tone="illness" max={TODAY} markers={(d) => (d === D(9, 14) ? ['accent'] : undefined)} />
  ),
};

/** Range with a skipped day inside (a kept workout) — the band breaks around it. */
export const RangeWithSkippedDay: Story = {
  render: () => (
    <Range
      tone="rest"
      max={TODAY}
      isSkipped={(d) => d === D(9, 14)}
      markers={(d) => (d === D(9, 14) ? ['accent'] : undefined)}
    />
  ),
};

/** Ongoing: runs to today with a dashed open end. */
export const RangeOngoing: Story = {
  render: () => <Range tone="illness" start={D(9, 24)} end={TODAY} max={TODAY} open />,
};

/** Planning ahead: no max, active-recovery teal, presets slot above. */
export const RangeWithPresets: Story = {
  render: () => (
    <Range
      tone="active"
      start={D(9, 27)}
      end={D(10, 3)}
      initialDay={D(9, 27)}
      presets={
        <PresetChips
          tone="active"
          items={[
            { id: 'today', label: 'Today', onClick: () => undefined },
            { id: 'n7', label: 'Next 7 days', selected: true, onClick: () => undefined },
            { id: 'nw', label: 'Next week', onClick: () => undefined },
            { id: 'ten', label: '10 days', onClick: () => undefined },
          ]}
        />
      }
    />
  ),
};

/** Min and max: only 20–26 Sep can be picked (injury "healed on"). Disabled days stay legible. */
export const MinMax: Story = {
  render: () => <Single tone="injury" value={D(9, 23)} min={D(9, 20)} max={TODAY} />,
};

/** Week starting on Sunday (account setting). */
export const SundayStart: Story = {
  render: () => <Single tone="accent" weekStart={7} />,
};

/** Two months side by side (web panels); collapses to one under 480px. */
export const TwoMonths: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 560 }}>
        <Story />
      </div>
    ),
  ],
  render: () => <Range tone="illness" max={TODAY} months={2} />,
};

/** The same two-month calendar in a narrow container: one month, both arrows. */
export const TwoMonthsNarrow: Story = {
  render: () => <Range tone="illness" max={TODAY} months={2} />,
};

/** Every tone family on a 3-day range. */
export const Tones: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1200 }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 300px)', gap: 24 }}>
      {(
        ['accent', 'rest', 'active', 'illness', 'injury', 'sleep', 'sport', 'neutral'] as Tone[]
      ).map((tone) => (
        <div key={tone}>
          <div
            style={{
              font: '600 11px var(--font)',
              color: 'var(--color-text-faint)',
              marginBottom: 8,
            }}
          >
            {tone.toUpperCase()}
          </div>
          <Range tone={tone} start={D(9, 15)} end={D(9, 17)} max={TODAY} />
        </div>
      ))}
    </div>
  ),
};
