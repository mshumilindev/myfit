import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkHighlight } from './SkHighlight';

const meta = {
  title: 'Store/SkHighlight',
  component: SkHighlight,
  args: {
    parts: [
      { text: 'Sle', hit: true },
      { text: 'ep sounds', hit: false },
    ],
  },
} satisfies Meta<typeof SkHighlight>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Matches: Story = {
  render: () => (
    <SkStage width="phone">
      <p className="sk-t-b">
        <SkHighlight
          parts={[
            { text: 'Sle', hit: true },
            { text: 'ep sounds', hit: false },
          ]}
        />
      </p>
      <p className="sk-t-b">
        <SkHighlight
          parts={[
            { text: 'Wind down and track your ', hit: false },
            { text: 'sleep', hit: true },
            { text: ' — ', hit: false },
            { text: 'sleep', hit: true },
            { text: ' log', hit: false },
          ]}
        />
      </p>
    </SkStage>
  ),
};

export const NoMatch: Story = {
  render: () => (
    <SkStage width="phone">
      <p className="sk-t-b">
        <SkHighlight parts={[{ text: 'Nothing matched here', hit: false }]} />
      </p>
    </SkStage>
  ),
};
