import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AccountPopover } from './AccountPopover';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { coachStrings } from '../../i18n/coach';

/** Desktop account popover: opened by the rail avatar, shows ONLY the account block. */
const c = coachStrings('en');

function Demo() {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  return (
    <div style={{ height: 480, padding: 24 }}>
      <div ref={ref} style={{ display: 'inline-flex' }}>
        <Button variant="ghost" aria-label={c.railProfile} onClick={() => setOpen((o) => !o)}>
          <Avatar name="Iryna Koval" size={34} />
        </Button>
      </div>
      <AccountPopover<'coach' | 'workouts'>
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        title={c.railProfile}
        side="bottom"
        align="start"
        account={{
          name: 'Iryna Koval',
          roleLabel: c.roleTrainer,
          avatar: <Avatar name="Iryna Koval" size={40} />,
          modes: [
            { value: 'coach', label: c.modeCoach },
            { value: 'workouts', label: c.modeMyWorkouts },
          ],
          mode: 'coach',
          modeLabel: c.modeLabel,
          onModeChange: () => undefined,
          note: c.modeNote,
          profile: { label: c.moreProfile, onOpen: () => undefined },
          signOut: { label: 'Sign out', onSelect: () => undefined },
        }}
      />
    </div>
  );
}

const meta = {
  title: 'Coach/AccountPopover',
  component: AccountPopover,
  parameters: { layout: 'fullscreen' },
  args: {
    open: false,
    onClose: () => undefined,
    anchorRef: { current: null },
    title: 'Account',
    account: { name: 'Iryna Koval' },
  },
} satisfies Meta<typeof AccountPopover>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Avatar, name, role, mode switch, note, Profile. */
export const WithModes: Story = { render: () => <Demo /> };
