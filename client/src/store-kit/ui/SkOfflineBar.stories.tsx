import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkOfflineBar } from './SkOfflineBar';

const meta = { title: 'Store/SkOfflineBar', component: SkOfflineBar } satisfies Meta<
  typeof SkOfflineBar
>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Board 15: offline is a calm status, installed items keep working. */
export const Offline: Story = {
  render: () => (
    <SkStage width="phone">
      <SkOfflineBar title="You are offline.">
        Installed items work. Adding needs internet.
      </SkOfflineBar>
    </SkStage>
  ),
};

export const LongText: Story = {
  render: () => (
    <SkStage width="phone">
      <SkOfflineBar title="You are offline.">
        Installed items keep working, your changes are saved on this device and sync when you are
        back online. Adding new add-ons needs a connection.
      </SkOfflineBar>
    </SkStage>
  ),
};
