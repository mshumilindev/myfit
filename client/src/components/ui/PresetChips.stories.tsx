import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PresetChips } from './PresetChips';
import { LocaleMatrix, Stack } from '../../stories/LocaleMatrix';
import type { Tone } from './tones';

const meta = {
  title: 'Kit/PresetChips',
  component: PresetChips,
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
  args: { items: [] },
} satisfies Meta<typeof PresetChips>;
export default meta;
type Story = StoryObj<typeof meta>;

const IDS = ['today', 'yesterday', 'last3', 'thisWeek', 'lastWeek'];

function Live({ tone, layout }: { tone: Tone; layout: 'wrap' | 'scroll' }) {
  const [on, setOn] = useState('yesterday');
  return (
    <PresetChips
      tone={tone}
      layout={layout}
      label="Presets"
      items={IDS.map((id) => ({ id, label: id, selected: on === id, onClick: () => setOn(id) }))}
    />
  );
}

/** Wraps (default) — nothing is ever clipped. */
export const Wrap: Story = { render: () => <Live tone="illness" layout="wrap" /> };

/** One scrolling line. */
export const Scroll: Story = { render: () => <Live tone="rest" layout="scroll" /> };

function GridLive() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const [on, setOn] = useState<string[]>(['Fri', 'Sat']);
  return (
    <PresetChips
      layout="grid"
      label="Days"
      items={days.map((d) => ({
        id: d,
        label: d,
        selected: on.includes(d),
        onClick: () => setOn((c) => (c.includes(d) ? c.filter((x) => x !== d) : [...c, d])),
      }))}
    />
  );
}

/** Equal columns on one line: a row of weekdays, several on at once. */
export const Grid: Story = { render: () => <GridLive /> };

/** Selected per family, a disabled chip, the small size. */
export const States: Story = {
  render: () => (
    <Stack>
      {(['accent', 'rest', 'active', 'illness', 'injury', 'neutral'] as Tone[]).map((tone) => (
        <PresetChips
          key={tone}
          tone={tone}
          items={[
            { id: 'a', label: tone, selected: true, onClick: () => undefined },
            { id: 'b', label: 'Off', onClick: () => undefined },
            { id: 'c', label: 'Disabled', disabled: true, onClick: () => undefined },
          ]}
        />
      ))}
      <PresetChips
        size="sm"
        items={[
          { id: 'a', label: 'Small', selected: true, onClick: () => undefined },
          { id: 'b', label: 'Chips', onClick: () => undefined },
        ]}
      />
    </Stack>
  ),
};

/** Date presets in five locales. */
export const LongText: Story = {
  render: () => (
    <LocaleMatrix
      render={(t) => (
        <PresetChips
          tone="rest"
          items={['today', 'next7', 'thisWeek', 'nextWeek', 'tenDays', 'twoWeeks'].map((id, i) => ({
            id,
            label: t.hlPreset[id],
            selected: i === 1,
            onClick: () => undefined,
          }))}
        />
      )}
    />
  ),
};
