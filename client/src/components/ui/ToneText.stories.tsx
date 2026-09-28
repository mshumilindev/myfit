import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToneText } from './ToneText';
import { TONES } from './tones';
import { Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/ToneText',
  component: ToneText,
  args: { tone: 'illness', children: 'Unwell · day 3', strong: false },
  argTypes: { tone: { control: 'select', options: TONES } },
} satisfies Meta<typeof ToneText>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every family, regular and strong. */
export const Tones: Story = {
  render: () => (
    <Stack gap={8}>
      {TONES.map((tone) => (
        <span key={tone} style={{ font: '400 15px var(--font)' }}>
          <ToneText tone={tone}>{tone} regular</ToneText> ·{' '}
          <ToneText tone={tone} strong>
            {tone} strong
          </ToneText>
        </span>
      ))}
    </Stack>
  ),
};
