import type { Meta, StoryObj } from '@storybook/react-vite';
import { CallLogRow } from './CallLogRow';
import { Stack } from '../../stories/LocaleMatrix';
import { noop } from '../../stories/callFixtures';

const meta = {
  title: 'Kit/CallLogRow',
  component: CallLogRow,
  args: { kind: 'done', video: true, text: 'Video call · 12 min', time: '18:40' },
} satisfies Meta<typeof CallLogRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const AllKinds: Story = {
  render: () => (
    <Stack>
      <CallLogRow kind="done" video text="Video call · 12 min" time="18:40" />
      <CallLogRow
        kind="missed"
        video={false}
        text="Missed call"
        time="09:12"
        callBackLabel="Call back"
        onCallBack={noop}
      />
      <CallLogRow kind="declined" video text="Call declined" time="Yesterday" />
      <CallLogRow
        kind="noanswer"
        video={false}
        text="No answer"
        time="Yesterday"
        callBackLabel="Call again"
        onCallBack={noop}
      />
      <CallLogRow kind="failed" video text="Call failed — connection lost" time="Mon" />
    </Stack>
  ),
};
