import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkHero } from './SkHero';

const meta = {
  title: 'Store/SkHero',
  component: SkHero,
  args: {
    eyebrow: 'Your Spotter',
    done: 7,
    total: 9,
    title: '2 left to complete Spotter',
    body: 'Add them to finish your setup.',
  },
} satisfies Meta<typeof SkHero>;
export default meta;
type Story = StoryObj<typeof meta>;

const badge = (t: string) => <span>{t}</span>;

export const Playground: Story = {
  render: (args) => (
    <SkStage width="phone">
      <SkHero {...args} />
    </SkStage>
  ),
};

/** Boards 22, 23, 24 plus the plain progress state. */
export const States: Story = {
  render: () => (
    <SkStage width="phone">
      <SkHero state="progress" eyebrow="Your Spotter" done={3} total={9} title="Keep going" />
      <SkHero
        state="almost"
        eyebrow="Your Spotter"
        done={7}
        total={9}
        title="2 left to complete Spotter"
        body="Add them to finish your setup."
      />
      <SkHero
        state="complete"
        eyebrow="Your Spotter"
        done={9}
        total={9}
        badge={badge('Complete')}
        title="Everything is added"
        body="Nothing else to install right now."
      />
      <SkHero
        state="new"
        eyebrow="Your Spotter"
        done={9}
        total={10}
        badge={badge('New')}
        title="1 new for you"
        body="Sleep sounds just arrived."
      />
    </SkStage>
  ),
};

export const Empty: Story = {
  render: () => (
    <SkStage width="phone">
      <SkHero eyebrow="Your Spotter" done={0} total={9} title="Nothing added yet" />
    </SkStage>
  ),
};
