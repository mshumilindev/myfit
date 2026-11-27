import type { Meta, StoryObj } from '@storybook/react-vite';
import { PageFrame } from '../stories/PageFrame';
import { AdvancedNudge } from './AdvancedNudge';

/**
 * The "Advanced training" store row at the foot of the set-options sheet (owner decision 26.11): the store kit's own
 * row (tile, name, one line, Add), shown while the item is offered and not installed.
 */
const meta = {
  title: 'Pages/Set options (Advanced training row)',
  component: AdvancedNudge,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <div className="screen">
          <Story />
        </div>
      </PageFrame>
    ),
  ],
  args: { onOpen: () => undefined },
} satisfies Meta<typeof AdvancedNudge>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Not installed: the row with Add. */
export const Row: Story = {};
