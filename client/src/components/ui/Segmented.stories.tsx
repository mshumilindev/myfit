import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Segmented, type SegmentedOption } from './Segmented';
import { LocaleMatrix, Stack } from '../../stories/LocaleMatrix';
import type { Tone } from './tones';

const meta = {
  title: 'Kit/Segmented',
  component: Segmented,
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    value: 'list',
    onChange: () => undefined,
    options: [
      { value: 'list', label: 'List' },
      { value: 'timeline', label: 'Timeline' },
    ],
  },
} satisfies Meta<typeof Segmented>;
export default meta;
type Story = StoryObj<typeof meta>;

function Live<V extends string | number>(props: {
  options: SegmentedOption<V>[];
  initial: V | null;
  variant?: 'track' | 'buttons';
  tone?: Tone;
  size?: 'sm' | 'md';
}) {
  const [v, setV] = useState<V | null>(props.initial);
  return (
    <Segmented
      options={props.options}
      value={v}
      onChange={setV}
      variant={props.variant}
      tone={props.tone}
      size={props.size}
      label="demo"
    />
  );
}

/** iOS track (Health: List | Timeline, Left / Right / Both). */
export const Track: Story = {
  render: () => (
    <Stack>
      <Live
        initial="timeline"
        options={[
          { value: 'list', label: 'List' },
          { value: 'timeline', label: 'Timeline' },
        ]}
      />
      <Live
        size="sm"
        initial="left"
        options={[
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
          { value: 'both', label: 'Both' },
        ]}
      />
    </Stack>
  ),
};

/** Outlined buttons in a tone (Log activity: duration, when, effort). Dense at 5+ options. */
export const Buttons: Story = {
  render: () => (
    <Stack>
      <Live
        variant="buttons"
        tone="accent"
        initial={30}
        options={[
          ...[15, 30, 45, 60, 90].map((m) => ({ value: m, label: String(m) })),
          { value: 0, label: 'Custom', compact: true, ariaLabel: 'Custom minutes' },
        ]}
      />
      <Live
        variant="buttons"
        tone="sport"
        initial="day"
        options={[
          { value: 'now', label: 'Now', disabled: true },
          { value: 'earlier', label: 'Earlier today' },
          { value: 'day', label: 'Pick a day', icon: 'calendar-blank' },
        ]}
      />
      <Live
        variant="buttons"
        tone="rest"
        initial={null}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'moderate', label: 'Moderate' },
          { value: 'hard', label: 'Hard' },
        ]}
      />
    </Stack>
  ),
};

/** Longest real labels in five locales (ellipsis, never overflow). */
export const LongText: Story = {
  render: () => (
    <LocaleMatrix
      render={(t) => (
        <Segmented
          variant="buttons"
          tone="accent"
          value="earlier"
          onChange={() => undefined}
          options={[
            { value: 'now', label: t.laNow },
            { value: 'earlier', label: t.laEarlierToday },
            { value: 'day', label: t.laPickDay, icon: 'calendar-blank' },
          ]}
        />
      )}
    />
  ),
};

/** `fill` + option `badge` (R-KIT-29): equal widths across the container, count chips. */
export const Fill: Story = {
  render: () => (
    <Stack>
      <Live
        initial="all"
        options={[
          { value: 'all', label: 'All', badge: 12 },
          { value: 'programs', label: 'Programs', badge: 3 },
          { value: 'workouts', label: 'Workouts', badge: 0 },
        ]}
      />
      <Segmented
        fill
        hug
        value="coach"
        onChange={() => undefined}
        options={[
          { value: 'coach', label: 'Coach' },
          { value: 'mine', label: 'My workouts' },
        ]}
      />
      <Segmented
        fill
        variant="buttons"
        value="b"
        onChange={() => undefined}
        options={[
          { value: 'a', label: 'In this chat', badge: 148 },
          { value: 'b', label: 'Recent', badge: 9 },
        ]}
      />
    </Stack>
  ),
};

/**
 * `value={null}`: nothing is selected (the account switch "Coach | My workouts" in Apex, People,
 * Nutrition and Learn, which are neither side). Both options stay pressable.
 */
export const NoSelection: Story = {
  render: () => (
    <Segmented
      fill
      value={null}
      onChange={() => undefined}
      options={[
        { value: 'coach', label: 'Coach' },
        { value: 'workouts', label: 'My workouts' },
      ]}
    />
  ),
};

/** Concentric geometry: track radius = segment radius + track padding (`--seg-r-outer = --seg-r-inner + --seg-pad`), same inset on every side, one height scale (md / sm). Counts sit on the label's line. */
export const Geometry: Story = {
  render: () => (
    <Stack>
      <Live
        initial="all"
        options={[
          { value: 'all', label: 'All', badge: 14 },
          { value: 'attn', label: 'Needs attention', badge: 4 },
        ]}
      />
      <Live
        size="sm"
        initial="priority"
        options={[
          { value: 'priority', label: 'By priority' },
          { value: 'stage', label: 'By stage' },
        ]}
      />
      <Live
        initial="week"
        tone="rest"
        options={[
          { value: 'week', label: 'Week' },
          { value: 'day', label: 'Day' },
          { value: 'month', label: 'Month' },
        ]}
      />
    </Stack>
  ),
};

/** `scroll`: more options than the width allows stay on ONE row that scrolls sideways (no wrapping, no squashed labels). */
export const Scroll: Story = {
  render: () => (
    <Segmented
      scroll
      value="legs"
      onChange={() => undefined}
      label="Muscle group"
      options={['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Glutes', 'Calves'].map(
        (m) => ({
          value: m.toLowerCase(),
          label: m,
        }),
      )}
    />
  ),
};
