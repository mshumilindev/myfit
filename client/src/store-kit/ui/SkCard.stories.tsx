import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkCard } from './SkCard';

const meta = { title: 'Store/SkCard', component: SkCard } satisfies Meta<typeof SkCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <SkStage width="phone">
      <SkCard pad>
        <div className="sk-t-h3">Health</div>
        <div className="sk-t-s">Sleep, steps and heart rate in one place.</div>
      </SkCard>
      <SkCard>
        <div className="sk-p16">Without padding prop (caller pads)</div>
      </SkCard>
    </SkStage>
  ),
};

export const LongText: Story = {
  render: () => (
    <SkStage width="phone">
      <SkCard pad>
        <div className="sk-t-b">
          Supercalifragilisticexpialidocious-add-on-name that keeps going and going so the card has
          to wrap its text inside the available width without overflow.
        </div>
      </SkCard>
    </SkStage>
  ),
};
