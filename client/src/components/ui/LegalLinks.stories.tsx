import type { Meta, StoryObj } from '@storybook/react-vite';
import { LegalLinks } from './LegalLinks';
import { Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/LegalLinks',
  component: LegalLinks,
  args: { label: 'Legal', privacyLabel: 'Privacy Policy', termsLabel: 'Terms of Use' },
} satisfies Meta<typeof LegalLinks>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Centered: Story = {};
export const Start: Story = { args: { align: 'start' } };
/** Targets are props: hash routes today, clean paths later. */
export const CleanPaths: Story = { args: { privacyHref: '/privacy', termsHref: '/terms' } };
export const LongLabels: Story = {
  render: (a) => (
    <Stack width={260}>
      <LegalLinks
        {...a}
        privacyLabel="Privatumo politika ir slapukai"
        termsLabel="Naudojimo sąlygos ir taisyklės"
      />
    </Stack>
  ),
};
