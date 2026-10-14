import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChoiceList } from './ChoiceList';

const options = [
  {
    id: 'variation',
    title: 'Add a variation + 1 set',
    description: 'Bench press: 3 to 4 sets. Adds 3 × 5 Paused bench press.',
    tag: 'Suggested',
  },
  { id: 'deload', title: 'Deload week', description: '30% less volume for 1 week.' },
];

const meta = {
  title: 'Coach/ChoiceList',
  component: ChoiceList,
  args: { options, value: 'variation', label: 'Options', onChange: () => undefined },
} satisfies Meta<typeof ChoiceList>;
export default meta;
type Story = StoryObj<typeof meta>;

function Controlled(args: ComponentProps<typeof ChoiceList>) {
  const [v, setV] = useState<string | null>(args.value);
  return <ChoiceList {...args} value={v} onChange={setV} />;
}

export const Default: Story = {
  render: (args) => <Controlled {...args} />,
};
export const Locked: Story = {
  args: { locked: true, options: [{ ...options[0], tag: 'Chosen' }, options[1]] },
};
