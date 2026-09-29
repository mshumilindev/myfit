import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Radio } from './Radio';
import { Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/Radio',
  component: Radio,
  args: { checked: true, onChange: () => undefined, 'aria-label': 'Option' },
} satisfies Meta<typeof Radio>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function Group() {
  const [v, setV] = useState('kg');
  return (
    <Stack>
      {['kg', 'lb'].map((u) => (
        <label key={u} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <Radio name="unit" checked={v === u} onChange={() => setV(u)} />
          {u}
        </label>
      ))}
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, opacity: 0.6 }}>
        <Radio name="unit" checked={false} disabled onChange={() => undefined} />
        disabled
      </label>
    </Stack>
  );
}

/** A group, plus disabled. */
export const States: Story = { render: () => <Group /> };
