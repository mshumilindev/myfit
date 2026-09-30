import type { Meta, StoryObj } from '@storybook/react-vite';
import { SetRow } from './SetRow';
import { Tag } from './Tag';
import { Stack } from '../../stories/LocaleMatrix';

const meta = { title: 'Kit/SetRow', component: SetRow } satisfies Meta<typeof SetRow>;
export default meta;
type Story = StoryObj<typeof meta>;

const cells = (idx: number, reps: string, load: string, tag?: React.ReactNode) => (
  <>
    <span className="idx">{idx}</span>
    <span className="val">{reps}</span>
    <span className="val">{load}</span>
    <span className="kind">{tag}</span>
  </>
);

/** Working, warm-up, record and timed rows. */
export const States: Story = {
  render: () => (
    <Stack>
      <SetRow warm>{cells(1, '10', '40 kg')}</SetRow>
      <SetRow>{cells(2, '8', '80 kg', <Tag tone="neutral">@8</Tag>)}</SetRow>
      <SetRow record>{cells(3, '6', '90 kg', <Tag solid>PR</Tag>)}</SetRow>
      <SetRow timed>{cells(4, '0:45', '12 km/h')}</SetRow>
    </Stack>
  ),
};
