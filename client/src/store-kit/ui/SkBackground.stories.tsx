import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkBackground } from './SkBackground';
import './SkScrim.css';
import './SkSheet.stories.css';

const meta = { title: 'Store/SkBackground', component: SkBackground } satisfies Meta<
  typeof SkBackground
>;
export default meta;
type Story = StoryObj<typeof meta>;

function Card() {
  return (
    <div className="sk-card sk-p16 sk-bg-demo-card">
      <div className="sk-t-h3">Discover</div>
      <div className="sk-t-s">Cards stay on top of the waves</div>
    </div>
  );
}

/** Animated (default): three layers drift at different speeds. Frozen automatically with reduced motion. */
export const Animated: Story = {
  render: () => (
    <SkStage width="phone">
      <div className="sk-scrim-host sk-bg-frame">
        <SkBackground contained />
        <Card />
      </div>
    </SkStage>
  ),
};

/** Static variant (`still`), as shown when the user prefers reduced motion. */
export const Still: Story = {
  render: () => (
    <SkStage width="phone">
      <div className="sk-scrim-host sk-bg-frame">
        <SkBackground contained still />
        <Card />
      </div>
    </SkStage>
  ),
};

/** Desktop width. */
export const Wide: Story = {
  render: () => (
    <SkStage width="wide">
      <div className="sk-scrim-host sk-bg-frame">
        <SkBackground contained />
        <Card />
      </div>
    </SkStage>
  ),
};
