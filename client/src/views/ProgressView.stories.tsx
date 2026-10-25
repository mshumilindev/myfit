import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ProgressView } from './ProgressView';
import { useStore } from '../store';
import { PageFrame } from '../stories/PageFrame';
import { seedPage, storyShell } from '../stories/fixtures';

type Seg = 'total' | 'muscle' | 'volume' | 'records';
type Lens = 'volume' | 'fatigue' | 'readiness';

function ProgressStory({
  sub,
  seg: segIn = 'total',
}: {
  sub: 'progress' | 'trends' | 'activity';
  seg?: Seg;
}) {
  const store = useStore();
  const [seg, setSeg] = useState<Seg>(segIn);
  const [lens, setLens] = useState<Lens>('volume');
  return (
    <ProgressView
      store={store}
      shell={storyShell}
      sub={sub}
      seg={seg}
      onSeg={setSeg}
      lens={lens}
      onLens={setLens}
    />
  );
}

/** Progress, Trends and Activity: the three sub-pages of the Progress screen, seeded with a few weeks of training. */
const meta = {
  title: 'Pages/Progress',
  component: ProgressStory,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <Story />
      </PageFrame>
    ),
  ],
  loaders: [
    () => {
      seedPage();
      return {};
    },
  ],
} satisfies Meta<typeof ProgressStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Total: Story = { args: { sub: 'progress', seg: 'total' } };
export const Records: Story = { args: { sub: 'progress', seg: 'records' } };
export const Trends: Story = { args: { sub: 'trends' } };
export const Activity: Story = { args: { sub: 'activity' } };
