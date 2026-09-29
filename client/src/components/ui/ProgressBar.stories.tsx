import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressBar } from './ProgressBar';
import { TONES } from './tones';
import { Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/ProgressBar',
  component: ProgressBar,
  args: { value: 33, tone: 'accent', label: 'Program progress' },
  argTypes: { tone: { control: 'select', options: TONES } },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every family; 0, partial, full; thick. */
export const Tones: Story = {
  render: () => (
    <Stack>
      {TONES.map((t, i) => (
        <ProgressBar key={t} tone={t} value={(i + 1) * 7} label={t} />
      ))}
      <ProgressBar value={0} label="empty" />
      <ProgressBar value={100} label="full" />
      <ProgressBar value={82} height={10} tone="ok" label="thick" />
    </Stack>
  ),
};
