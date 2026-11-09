import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgramProgress } from './ProgramProgress';

/** The program card's week progress: a percentage with a bar, and a vessel of water in Studio. */
const meta = {
  title: 'Components/ProgramProgress',
  component: ProgramProgress,
  decorators: [
    (Story) => (
      <div className="program-card-head" style={{ display: 'flex', width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgramProgress>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Week: Story = {
  args: {
    pct: 67,
    label: 'Plan progress',
    children: (
      <>
        <span className="pch-pct num">67%</span>
        <span className="pch-bar">
          <span className="pch-bar-fill" />
        </span>
      </>
    ),
  },
};
