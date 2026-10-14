import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Chip, ChipGroup, type ChipTone } from './Chip';

const TONES: ChipTone[] = ['neutral', 'accent', 'danger', 'ok', 'rest', 'atlas'];

const meta = {
  title: 'Kit/Chip',
  component: Chip,
  args: { children: 'Chest', tone: 'neutral', size: 'md', selected: false },
  argTypes: { tone: { control: 'select', options: TONES } },
} satisfies Meta<typeof Chip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Static status pills in every tone, both sizes. */
export const Tones: Story = {
  render: () => (
    <ChipGroup>
      {TONES.map((t) => (
        <Chip key={t} tone={t}>
          {t}
        </Chip>
      ))}
      {TONES.map((t) => (
        <Chip key={`s${t}`} tone={t} size="xs" icon="clock">
          {t} sm
        </Chip>
      ))}
    </ChipGroup>
  ),
};

function Selectable() {
  const [on, setOn] = useState<string | null>('Back');
  return (
    <ChipGroup>
      {['Chest', 'Back', 'Legs', 'Shoulders'].map((m) => (
        <Chip key={m} selected={on === m} onClick={() => setOn(on === m ? null : m)}>
          {m}
        </Chip>
      ))}
      <Chip disabled onClick={() => undefined}>
        Disabled
      </Chip>
    </ChipGroup>
  );
}

/** Selectable chips (buttons with aria-pressed) + disabled. */
export const SelectableGroup: Story = { render: () => <Selectable /> };

/** Filter chips with a count (`count` prop: tabular, dimmed, announced as part of the name) in a `ChipGroup`. `scroll` keeps ONE row on a phone, `fill` makes equal columns. */
export const WithCounts: Story = {
  render: () => {
    const items: [string, number][] = [
      ['All', 14],
      ['Needs attention', 4],
      ['Improved', 6],
      ['Declined', 2],
      ['No change', 2],
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 358 }}>
        <ChipGroup role="group" aria-label="Filter">
          {items.map(([l, n], i) => (
            <Chip key={l} selected={i === 0} count={n} onClick={() => undefined}>
              {l}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup scroll role="group" aria-label="Filter (scrolls)">
          {items.map(([l, n], i) => (
            <Chip key={l} selected={i === 1} count={n} onClick={() => undefined}>
              {l}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup fill role="group" aria-label="Filter (equal columns)">
          {items.slice(0, 3).map(([l, n], i) => (
            <Chip key={l} size="xs" selected={i === 2} count={n} onClick={() => undefined}>
              {l}
            </Chip>
          ))}
        </ChipGroup>
      </div>
    );
  },
};
