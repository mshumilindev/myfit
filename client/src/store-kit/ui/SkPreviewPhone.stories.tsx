import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import {
  SkPreviewPhone,
  SkPvBars,
  SkPvBox,
  SkPvDot,
  SkPvLines,
  SkPvProgress,
} from './SkPreviewPhone';

const meta = {
  title: 'Store/SkPreviewPhone',
  component: SkPreviewPhone,
} satisfies Meta<typeof SkPreviewPhone>;
export default meta;
type Story = StoryObj<typeof meta>;

const Plot = () => (
  <SkPreviewPhone caption="Where does it hurt?" label="Body map preview">
    <SkPvBox tall="plot">
      <SkPvDot />
    </SkPvBox>
    <SkPvBox>
      <SkPvLines />
    </SkPvBox>
  </SkPreviewPhone>
);
const Week = ({ size }: { size?: 'm' | 'd' }) => (
  <SkPreviewPhone size={size} caption="This week" label="Weekly chart preview">
    <SkPvBox tall="chart">
      <SkPvBars values={[40, 70, 55, 85, 60]} />
    </SkPvBox>
    <SkPvBox>
      <SkPvLines />
      <SkPvProgress value={60} />
    </SkPvBox>
  </SkPreviewPhone>
);

export const Playground: Story = {
  render: () => (
    <SkStage>
      <Plot />
    </SkStage>
  ),
};

/** Mobile (m) and desktop (d) sizes. */
export const Sizes: Story = {
  render: () => (
    <SkStage>
      <div className="sk-rowf sk-g12">
        <Plot />
        <Week />
      </div>
      <div className="sk-rowf sk-g12">
        <SkPreviewPhone size="d" caption="Where does it hurt?" label="Body map preview">
          <SkPvBox tall="plot">
            <SkPvDot />
          </SkPvBox>
          <SkPvBox>
            <SkPvLines />
          </SkPvBox>
        </SkPreviewPhone>
        <Week size="d" />
      </div>
    </SkStage>
  ),
};

export const Decorative: Story = {
  render: () => (
    <SkStage>
      <SkPreviewPhone caption="A very long caption that must be clipped by the phone frame">
        <SkPvBox>
          <SkPvLines />
        </SkPvBox>
      </SkPreviewPhone>
    </SkStage>
  ),
};
