import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AccountPanel } from './AccountPanel';
import { Avatar } from './Avatar';
import { LocaleMatrix, Row } from '../../stories/LocaleMatrix';
import { coachStrings } from '../../i18n/coach';

/** Reusable account block: avatar, name, role, optional mode switch, note, Profile. App-agnostic. */
const meta = {
  title: 'Coach/AccountPanel',
  component: AccountPanel,
  parameters: { layout: 'centered' },
  args: { name: 'Iryna Koval', roleLabel: 'Trainer' },
  decorators: [
    (Story) => (
      <div style={{ width: 340, background: 'var(--color-surface)', borderRadius: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Profile (People silver) and Sign out (danger), the matching pair of pills under the note. */
export const ProfileAndSignOut: Story = {
  args: {
    profile: { label: 'Profile', onOpen: () => undefined },
    signOut: { label: 'Sign out', onSelect: () => undefined },
  },
};

/** Identity only (a member without a second mode). */
export const IdentityOnly: Story = {};

function Switchable(props: { photo?: boolean }) {
  const c = coachStrings('en');
  const [mode, setMode] = useState<'coach' | 'workouts'>('coach');
  return (
    <AccountPanel<'coach' | 'workouts'>
      name="Iryna Koval"
      roleLabel={c.roleTrainer}
      avatar={
        props.photo ? <Avatar name="Iryna Koval" size={40} src="/atlas/atlas-1.webp" /> : undefined
      }
      modes={[
        { value: 'coach', label: c.modeCoach },
        { value: 'workouts', label: c.modeMyWorkouts },
      ]}
      mode={mode}
      onModeChange={setMode}
      modeLabel={c.modeLabel}
      note={c.modeNote}
      profile={{ label: c.moreProfile, onOpen: () => undefined }}
    />
  );
}

/** Coach | My workouts, privacy note and Profile row (initials avatar). */
export const WithModeSwitch: Story = { render: () => <Switchable /> };

/** The same with the person's photo in the avatar slot. */
export const WithPhoto: Story = { render: () => <Switchable photo /> };

/** Long name and role: one line each, ellipsis. */
export const LongName: Story = {
  args: { name: 'Oleksandra Wiśniewska-Kowalczyk-Petrenko', roleLabel: 'Administrator' },
};

/** Five locales: equal-width mode switch with the long "My workouts" labels. */
export const Locales: Story = {
  parameters: { layout: 'padded' },
  decorators: [],
  render: () => (
    <LocaleMatrix
      width={360}
      render={(_t, id) => {
        const c = coachStrings(id);
        return (
          <Row>
            <div style={{ width: 340, background: 'var(--color-surface)', borderRadius: 16 }}>
              <AccountPanel<'coach' | 'workouts'>
                name="Iryna Koval"
                roleLabel={c.roleTrainer}
                modes={[
                  { value: 'coach', label: c.modeCoach },
                  { value: 'workouts', label: c.modeMyWorkouts },
                ]}
                mode="coach"
                onModeChange={() => undefined}
                modeLabel={c.modeLabel}
                note={c.modeNote}
                profile={{ label: c.moreProfile, onOpen: () => undefined }}
              />
            </div>
          </Row>
        );
      }}
    />
  ),
};
