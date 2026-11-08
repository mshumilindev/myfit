import type { Meta, StoryObj } from '@storybook/react-vite';
import { PageFrame } from '../stories/PageFrame';
import { seedPage } from '../stories/fixtures';
import { setRole } from '../api';
import { addonsPref } from '../addons/enabledSet';
import { StoreApp } from './StoreApp';
import type { Role } from '../types';

const meta = {
  title: 'Pages/Add-on store',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <Story />
      </PageFrame>
    ),
  ],
} satisfies Meta;
export default meta;
type S = StoryObj<typeof meta>;

const forRole = (role: Role, hash = '#/store'): S => ({
  loaders: [
    () => {
      seedPage();
      setRole(role);
      addonsPref.reset();
      window.location.hash = hash;
      return {};
    },
  ],
  render: () => <StoreApp role={role} onOpenProfile={() => undefined} />,
});

export const MemberDiscover = forRole('member');
export const TrainerDiscover = forRole('trainer');
export const AdminDiscover = forRole('admin');
export const MemberInstalled = forRole('member', '#/store/installed');
