import type { Meta, StoryObj } from '@storybook/react-vite';
import { NotConfigured } from '../BackendNotice';
import { AskCard } from '../share/AskCard';
import { KeyChangeBanner } from './KeyChangeBanner';
import { ReauthDialog } from './ReauthDialog';
import { createFixturesReauthPort } from './__fixtures__/reauth';
import { SecurityCodeDialog } from './SecurityCodeDialog';

/**
 * The safety pieces of Coach: the demo notice and the "not configured" state, the security code dialog and the
 * key-change strip, the password prompt (action and idle lock) and the "please share" card.
 */
const meta = {
  title: 'Pages/Coach/Safety',
  parameters: { layout: 'padded' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const NotConfiguredState: Story = {
  render: () => <NotConfigured onBack={() => undefined} />,
};

const security = (over: Partial<Parameters<typeof SecurityCodeDialog>[0]['security']> = {}) => ({
  code: '4821 0937 5564 1208 7733 9150',
  verified: false,
  changed: false,
  loading: false,
  verify: () => undefined,
  unverify: () => undefined,
  ...over,
});
export const SecurityCodeTrainer: Story = {
  render: () => (
    <SecurityCodeDialog
      security={security()}
      side="trainer"
      name="Oleh"
      onClose={() => undefined}
    />
  ),
};
export const SecurityCodeClientVerified: Story = {
  render: () => (
    <SecurityCodeDialog
      security={security({ verified: true })}
      side="client"
      name="Iryna"
      onClose={() => undefined}
    />
  ),
};
export const SecurityCodeChanged: Story = {
  render: () => (
    <SecurityCodeDialog
      security={security({ changed: true })}
      side="client"
      name="Iryna"
      onClose={() => undefined}
    />
  ),
};
export const SecurityCodeMissing: Story = {
  render: () => (
    <SecurityCodeDialog
      security={security({ code: null })}
      side="client"
      name="Iryna"
      onClose={() => undefined}
    />
  ),
};
export const KeyChanged: Story = {
  render: () => <KeyChangeBanner name="Iryna" onReview={() => undefined} />,
};

const port = createFixturesReauthPort({ accept: 'correct' });
export const ReauthExport: Story = {
  render: () => (
    <ReauthDialog action="export" port={port} onDone={() => undefined} onCancel={() => undefined} />
  ),
};

export const AskCardTrainer: Story = {
  render: () => <AskCard kind="workout" side="trainer" mine />,
};
export const AskCardClient: Story = {
  render: () => (
    <AskCard kind="workout" side="client" mine={false} onOpenSharing={() => undefined} />
  ),
};
