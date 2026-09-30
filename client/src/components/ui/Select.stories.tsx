import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select } from './Select';

const meta = {
  title: 'Kit/Select',
  component: Select,
  args: { label: 'Week starts on' },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Select>;
export default meta;
type Story = StoryObj<typeof meta>;

const opts = (
  <>
    <option>Monday</option>
    <option>Sunday</option>
  </>
);

export const Default: Story = { args: { children: opts } };
export const WithError: Story = { args: { children: opts, error: 'Pick a day' } };
