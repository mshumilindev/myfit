import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkNote, type SkNoteTone } from './SkNote';

const TONES: SkNoteTone[] = ['info', 'ok', 'warn', 'bad'];
const meta = {
  title: 'Store/SkNote',
  component: SkNote,
  args: { tone: 'info', children: 'Your data stays on this device.' },
  argTypes: { tone: { control: 'select', options: TONES } },
} satisfies Meta<typeof SkNote>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <SkStage width="phone">
      <SkNote {...args} />
    </SkStage>
  ),
};

export const AllTones: Story = {
  render: () => (
    <SkStage width="phone">
      {TONES.map((t) => (
        <SkNote key={t} tone={t}>
          {t}: short note text
        </SkNote>
      ))}
      <SkNote tone="warn" icon="alert">
        With an icon and a deliberately long text that wraps over several lines to check the layout
        and the contrast of the tone colours.
      </SkNote>
    </SkStage>
  ),
};
