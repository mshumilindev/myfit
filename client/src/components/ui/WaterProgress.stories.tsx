import type { Meta, StoryObj } from '@storybook/react-vite';
import { WaterProgress } from './WaterProgress';
import { Row, Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/WaterProgress',
  component: WaterProgress,
  args: { value: 66, label: 'Program progress', children: '66%', tilt: false },
} satisfies Meta<typeof WaterProgress>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The colour steps with the level: low (under 25), mid, high (75 and over). */
export const Levels: Story = {
  render: () => (
    <Stack width={358}>
      <Row>
        {[0, 8, 24, 25, 50, 74, 75, 90, 100].map((v) => (
          <WaterProgress key={v} value={v} size={88} label={`${v}%`} tilt={false}>
            {v}
          </WaterProgress>
        ))}
      </Row>
    </Stack>
  ),
};

/** A tilted phone: the surface stays level while the vessel turns (angle is what the accelerometer reports). */
export const Tilted: Story = {
  render: () => (
    <Stack width={358}>
      <Row>
        {[0, 30, 90, 180, 270].map((a) => (
          <WaterProgress key={a} value={50} size={88} label={`${a}`} angle={a}>
            {a}°
          </WaterProgress>
        ))}
      </Row>
    </Stack>
  ),
};

/** Sleep: the night dimming applies to the whole app, including the water. */
export const Large: Story = { args: { size: 180, value: 66, children: '66%' } };
