import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field } from './Field';
import { Icon } from '../../ui';
import { Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/Field',
  component: Field,
  args: { label: 'Gym name', placeholder: 'Iron Temple' },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Empty, filled, with lead/trail, hint, error, disabled. */
export const States: Story = {
  render: () => (
    <Stack>
      <Field label="Gym name" placeholder="Iron Temple" />
      <Field label="Body weight" defaultValue="82.4" inputMode="decimal" trail="kg" />
      <Field
        label="Search"
        placeholder="Search exercises"
        lead={<Icon name="magnifying-glass" />}
      />
      <Field label="Username" defaultValue="mykola" hint="Letters, digits and dots." />
      <Field label="Email" defaultValue="mykola@" error="Enter a valid email address." />
      <Field label="Disabled" defaultValue="Read only" disabled />
    </Stack>
  ),
};
