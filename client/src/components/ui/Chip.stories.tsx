import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Chip, ChipGroup, type ChipTone } from './Chip';

const TONES: ChipTone[] = ['neutral', 'accent', 'danger', 'ok', 'rest'];

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
        <Chip key={`s${t}`} tone={t} size="sm" icon="clock">
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
