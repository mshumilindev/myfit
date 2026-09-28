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
