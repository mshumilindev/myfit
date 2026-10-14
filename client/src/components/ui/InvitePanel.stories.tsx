import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ConsentLevelId } from './ConsentControls';
import { InvitePanel, type InviteLabels, type InviteMode } from './InvitePanel';

const LABELS: InviteLabels = {
  title: 'Invite a client',
  modeGroup: 'How the client logs',
  modes: {
    app: {
      label: 'App',
      hint: 'The client gets a link and logs workouts in the Spotter app.',
      submit: 'Send app invite',
    },
    hybrid: {
      label: 'Hybrid',
      hint: 'The client logs in the app. You see the sessions they share, and you cannot log for them.',
      submit: 'Send invite',
    },
    program: {
      label: 'Program only',
      hint: 'The client trains without the app. You build the program and see it only; sessions are not logged in Spotter.',
      submit: 'Create program-only client',
    },
  },
  nameLabel: 'Name',
  namePlaceholder: 'For example, Olena Marchenko',
  nameNeeded: "Enter the client's name to continue.",
  nameTooShort: 'Use at least 2 characters.',
  consentToggleShow: 'Choose what you would like to see',
  consentToggleHide: 'Hide sharing request',
  consentLegend: 'What you would like the client to share',
  consentNote: 'This is a request. The client decides what to share and can change it at any time.',
  levels: { off: 'Off', effects: 'Effects only', full: 'Full' },
  categories: [
    { id: 'totals', label: 'Workout totals', what: 'Sessions, duration, total volume' },
    { id: 'sets', label: 'Sets and weights', what: 'Every set: exercise, weight, reps, RPE' },
    { id: 'body', label: 'Body weight' },
    { id: 'sleep', label: 'Sleep' },
    { id: 'injury', label: 'Injuries' },
    { id: 'nutrition', label: 'Nutrition' },
    { id: 'checkins', label: 'Check-in answers' },
  ],
  sending: 'Sending...',
  errorOffline: 'You are offline. Your answers are kept; try again when you are back online.',
  errorFailed: 'The invite was not created. Your answers are kept; try again.',
  sent: {
    app: 'Invite link created. Send it to the client.',
    hybrid: 'Invite link created. You see the sessions they share.',
    program: 'Client added to your list. Build their program from their profile.',
  },
  linkLabel: 'Invite link',
  copy: 'Copy link',
  copied: 'Copied',
  share: 'Share',
  sendInChat: 'Send in chat',
  expires: (d) => `The link works for ${d} days.`,
  another: 'Invite another',
  openProfile: 'Open profile',
};

const defaults = (m: InviteMode): Record<string, ConsentLevelId> =>
  m === 'program'
    ? {}
    : m === 'hybrid'
      ? { totals: 'full' }
      : { totals: 'full', sets: 'full', checkins: 'full' };

const meta = {
  title: 'Coach/Invite',
  component: InvitePanel,
  parameters: { layout: 'padded' },
  args: {
    labels: LABELS,
    defaultRequest: defaults,
    onCreate: async () => ({
      id: 'x',
      url: 'https://spotter.app/i/9f3c2a71b0d44e5a8c12',
      expiresInDays: 7,
    }),
    onSendInChat: () => undefined,
    onOpenProfile: () => undefined,
  },
  decorators: [
    (S) => (
      <div style={{ maxWidth: 640 }}>
        <S />
      </div>
    ),
  ],
} satisfies Meta<typeof InvitePanel>;
export default meta;
type Story = StoryObj<typeof meta>;

/** roster-invite. */
export const App: Story = {};
/** roster-invite-hybrid. */
export const Hybrid: Story = { args: { initialMode: 'hybrid', initialName: 'Dmytro Kovalenko' } };
/** roster-invite-program: no consent request, no link. */
export const ProgramOnly: Story = {
  args: {
    initialMode: 'program',
    initialSent: {
      id: 'p1',
      url: null,
      expiresInDays: null,
      name: 'Dmytro Kovalenko',
      mode: 'program',
    },
  },
};
/** Sent: link, Copy, Share (when the device has it), Send in chat. */
export const Sent: Story = {
  args: {
    initialSent: {
      id: 'a1',
      url: 'https://spotter.app/i/9f3c2a71b0d44e5a8c12',
      expiresInDays: 7,
      name: 'Olena Marchenko',
      mode: 'app',
    },
  },
};
/** The empty-roster card uses the same form with a larger title. */
export const Hero: Story = {
  args: {
    hero: true,
    labels: {
      ...LABELS,
      title: 'Invite your first client',
      intro:
        'Clients log their workouts in the Spotter app. Signals appear as soon as there is data.',
    },
  },
};
export const OfflineError: Story = {
  args: {
    initialName: 'Olena Marchenko',
    onCreate: async () => {
      throw Object.assign(new Error('offline'), { code: 'offline' });
    },
  },
};
export const Failed: Story = {
  args: {
    initialName: 'Olena Marchenko',
    onCreate: async () => {
      throw new Error('boom');
    },
  },
};
