import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkScrim } from './SkScrim';

const meta = { title: 'Store/SkScrim', component: SkScrim } satisfies Meta<typeof SkScrim>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Over content, light and dark (the scrim token differs per theme). */
export const OverContent: Story = {
  render: () => (
    <SkStage width="phone">
      <div className="sk-card sk-p16 sk-scrim-host">
        <div className="sk-t-h3">Health</div>
        <div className="sk-t-s">Content under the scrim</div>
        <SkScrim contained />
      </div>
    </SkStage>
  ),
};
