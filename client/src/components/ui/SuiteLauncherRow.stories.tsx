import type { Meta, StoryObj } from '@storybook/react-vite';
import { SuiteLauncherRow } from './SuiteLauncherRow';
import { GroupedList } from './GroupedList';
import { LocaleMatrix } from '../../stories/LocaleMatrix';

/** The "Apps" row that opens the suite launcher. App-agnostic; lives in a MoreMenu list. */
const meta = {
  title: 'Coach/SuiteLauncherRow',
  component: SuiteLauncherRow,
  parameters: { layout: 'centered' },
  args: { label: 'Apps', onOpen: () => undefined },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <GroupedList surface="raised">
          <Story />
        </GroupedList>
      </div>
    ),
  ],
} satisfies Meta<typeof SuiteLauncherRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The app's own word for "Apps" in all five locales. */
export const Locales: Story = {
  parameters: { layout: 'padded' },
  decorators: [],
  render: () => (
    <LocaleMatrix
      width={320}
      render={(t) => (
        <GroupedList surface="raised">
          <SuiteLauncherRow label={t.appsTab} onOpen={() => undefined} />
        </GroupedList>
      )}
    />
  ),
};
