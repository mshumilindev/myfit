import type { Meta, StoryObj } from '@storybook/react-vite';
import { FindingRow } from './FindingRow';
import { Button } from './Button';

const meta = {
  title: 'Coach/Finding row',
  component: FindingRow,
  args: {
    icon: 'warning',
    tone: 'danger',
    title: 'Back below its weekly range',
    body: '4 sets a week against 12 to 20. Secondary muscles count half a set.',
    status: 'To fix',
  },
  decorators: [
    (Story) => (
      <ul style={{ width: 640, maxWidth: '100%', margin: 0, padding: 0, listStyle: 'none' }}>
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof FindingRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const ToFixWithAction: Story = {
  args: {
    action: (
      <Button variant="link" size="sm">
        Fix in editor
      </Button>
    ),
  },
};

export const ToReview: Story = {
  args: {
    icon: 'warning',
    tone: 'illness',
    title: '2 exercises without a picture',
    status: 'To review',
  },
};

export const NoTarget: Story = {
  args: {
    icon: 'info',
    tone: 'rest',
    title: '3 exercises have no set targets',
    body: 'They are valid to send. Their muscles are listed but not counted.',
    status: 'No target',
  },
};

export const Fine: Story = {
  args: {
    icon: 'check-circle',
    tone: 'ok',
    title: 'Pull 14 : push 14',
    body: 'Pulling volume matches pushing volume.',
    status: 'Fine',
  },
};

/** A long title and reason (pl / lt / et run long) wrap without clipping. */
export const LongText: Story = {
  args: {
    title: 'Mięsień czworogłowy poniżej tygodniowego zakresu serii treningowych',
    body: 'Pięć serii w tygodniu wobec dziesięciu do szesnastu. Mięśnie dodatkowe liczą się jako pół serii, a ćwiczenia bez serii niczego tu nie dodają.',
    status: 'Do poprawy',
  },
};
