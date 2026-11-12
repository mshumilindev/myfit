import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { OptionTile } from './OptionTile';
import { Icon } from '../../ui';

/** One tile of a radio picker (icon grid, colour row). The look comes from the caller's class; this story uses an inline frame. */
const meta = {
  title: 'Kit/OptionTile',
  component: OptionTile,
  args: { selected: false, 'aria-label': 'star' },
} satisfies Meta<typeof OptionTile>;
export default meta;
type Story = StoryObj<typeof meta>;

const NAMES = ['star', 'heart', 'barbell', 'bell'];

function Group() {
  const [on, setOn] = useState('star');
  return (
    <div role="radiogroup" aria-label="Icon" className="ul-row ug-8">
      {NAMES.map((n) => (
        <OptionTile key={n} selected={n === on} aria-label={n} onClick={() => setOn(n)}>
          <Icon name={n} />
        </OptionTile>
      ))}
    </div>
  );
}

/** A radiogroup of tiles: exactly one is on. */
export const Group_: Story = { render: () => <Group /> };
