import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimeField } from './TimeField';
import { Icon } from '../../ui';
import { Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/TimeField',
  component: TimeField,
  args: { label: 'Bedtime', value: '23:00', onChange: () => undefined },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TimeField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function Live({
  initial,
  ...rest
}: { initial: string } & Partial<Parameters<typeof TimeField>[0]>) {
  const [v, setV] = useState(initial);
  return <TimeField {...rest} value={v} onChange={(e) => setV(e.target.value)} />;
}

/** Labelled, with a leading icon, compact, and disabled. */
export const States: Story = {
  render: () => (
    <Stack>
      <Live initial="23:00" label="Bedtime" />
      <Live initial="07:00" label="Woke up" lead={<Icon name="sun-horizon" />} />
      <Live initial="06:30" size="sm" aria-label="Wake" />
      <Live initial="06:30" label="Disabled" disabled />
    </Stack>
  ),
};
