import type { Meta, StoryObj } from '@storybook/react-vite';
import { AnatomyTurntable } from './AnatomyTurntable';

const meta = {
  title: 'Kit/AnatomyTurntable',
  component: AnatomyTurntable,
  args: {
    label: 'Skeleton',
    hint: 'Drag to rotate',
    camera: { yaw: 0, y: 0.505, zoom: 1, n: 0 },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 220 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnatomyTurntable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WholeBody: Story = { args: { caption: 'Whole body' } };
export const ShouldersFromBehind: Story = {
  args: {
    camera: { yaw: 180, y: 0.18, zoom: 2, n: 1 },
    marks: [{ layer: 'shoulder_l' }, { layer: 'shoulder_r' }],
    caption: 'Shoulders',
  },
};
export const Muscles: Story = {
  args: {
    base: 'muscles',
    marks: [{ layer: 'm_quads' }],
    camera: { yaw: 0, y: 0.52, zoom: 1.8, n: 1 },
  },
};
export const OrgansFixed: Story = {
  args: {
    rotatable: false,
    organs: ['heart', 'lungs', 'liver', 'stomach', 'kidneys', 'intestines', 'brain'],
    marks: [{ layer: 'heart_mask' }],
    camera: { yaw: 0, y: 0.22, zoom: 2.4, n: 1 },
    caption: 'Heart and circulation',
  },
};
