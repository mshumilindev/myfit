import type { Meta, StoryObj } from '@storybook/react-vite';
import { AnatomyMap, type AnatomyView } from './AnatomyMap';

const meta = {
  title: 'Kit/AnatomyMap',
  component: AnatomyMap,
  args: { label: 'Skeleton' },
  decorators: [
    (Story) => (
      <div className="uw-full" style={{ maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnatomyMap>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {
  args: { marks: [{ layer: 'spine_lumbar' }, { layer: 'knee_r', tone: 'accent' }] },
};
export const Back: Story = { args: { view: 'back', marks: [{ layer: 'spine_thoracic' }] } };
export const SideSpine: Story = {
  args: {
    view: 'left' as AnatomyView,
    focus: 'spine',
    marks: [{ layer: 'spine_cervical', tone: 'accent' }, { layer: 'spine_lumbar' }],
  },
};
export const Organs: Story = {
  args: {
    focus: 'torso',
    organs: ['lungs', 'heart', 'liver', 'stomach'],
    marks: [{ layer: 'heart_mask' }],
  },
};
export const Knees: Story = {
  args: { focus: 'knees', marks: [{ layer: 'knee_l' }, { layer: 'knee_r' }] },
};
