import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { Card } from './Card';
import { PageHead } from './PageHead';

const back = { label: 'Back', onClick: () => {} };

const meta = {
  title: 'Kit/PageHead',
  component: PageHead,
  args: { back, title: 'History', sub: '24 workouts' },
  decorators: [
    (Story) => (
      <div className="screen ug-16">
        <Story />
        <Card pad="md">Content: its left and right edges equal the header's.</Card>
      </div>
    ),
  ],
} satisfies Meta<typeof PageHead>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const TitleOnly: Story = { args: { sub: undefined, title: 'Settings' } };

/** Right-hand actions share the title's axis; the long title truncates, never overlaps. */
export const WithActions: Story = {
  args: {
    title: 'Chest — Fitness Club Mokotów ZDROFIT',
    actions: (
      <>
        <Button variant="secondary" size="sm" icon="trash">
          Delete
        </Button>
        <Button size="sm">Save</Button>
      </>
    ),
  },
};

export const RootPage: Story = { args: { back: undefined, title: 'Today', sub: undefined } };
