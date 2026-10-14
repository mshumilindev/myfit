import type { Meta, StoryObj } from '@storybook/react-vite';
import { StageBoard, type BoardStage } from './StageBoard';

const card = (
  id: string,
  name: string,
  status: string,
  tone: 'danger' | 'illness' | 'ok' | 'neutral',
  title: string,
  line: string,
) => ({
  id,
  name: name.split(' ')[0],
  fullName: name,
  status,
  tone,
  title,
  line,
});

const stages: BoardStage[] = [
  {
    id: 'signal',
    label: 'Signal',
    icon: 'pulse',
    cards: [
      card(
        'a',
        'Denys Koval',
        'Good',
        'ok',
        'Only totals shared, no set data',
        'Sessions last week: 3',
      ),
      card(
        'b',
        'Maria Tkach',
        'Good',
        'ok',
        'Ready to add weight on hip thrust',
        'Hip thrust · RPE 7 or lower',
      ),
    ],
  },
  {
    id: 'evidence',
    label: 'Evidence',
    icon: 'magnifying-glass',
    cards: [
      card(
        'c',
        'Oleh Bondar',
        'Urgent',
        'danger',
        'Bench press has not moved in 4 weeks',
        'Bench press est. 1RM 116 kg · no change in 4 weeks',
      ),
    ],
  },
  { id: 'decided', label: 'Decided', icon: 'check-circle', cards: [] },
  {
    id: 'measuring',
    label: 'Measuring',
    icon: 'timer',
    cards: [
      card(
        'd',
        'Maria Tkach',
        'Measuring',
        'illness',
        'Deload: 20% less volume for 1 week',
        'Measuring: day 5 of 14',
      ),
    ],
  },
  {
    id: 'result',
    label: 'Result',
    icon: 'medal',
    cards: [
      card(
        'e',
        'Sofiia Hnatiuk',
        'Improved',
        'ok',
        'Squat: 3 to 4 sets.',
        'Improved · Est. 1RM 75 to 80 kg',
      ),
    ],
  },
];

const meta = {
  title: 'Coach/StageBoard',
  component: StageBoard,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div
        className="app-coach"
        style={{ padding: 24, background: 'var(--color-bg)', minHeight: '100vh' }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    stages,
    label: 'Stage board, scroll for more',
    emptyText: 'Nothing here',
    onOpen: () => undefined,
    footer: '26 of 42 decisions improved (62%), 2 still measuring.',
  },
} satisfies Meta<typeof StageBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Board: Story = {};
export const Drawer: Story = { args: { selectedId: 'c' } };
export const Collapsed: Story = { args: { accordion: true } };
export const Moved: Story = {
  args: {
    accordion: true,
    defaultOpen: 'measuring',
  },
};
export const Narrow1024: Story = { parameters: { viewport: { value: 'tablet' } } };
export const Folded: Story = {
  args: {
    foldLabel: (l: string, folded: boolean) => (folded ? `Show ${l}` : `Hide ${l}`),
    defaultFolded: ['signal', 'decided'],
  },
};
