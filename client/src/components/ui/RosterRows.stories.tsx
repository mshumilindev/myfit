import type { Meta, StoryObj } from '@storybook/react-vite';
import { ClientRow, LockedRow, LogModeBadge, SignalListRow, StatusLabel } from './RosterRows';

const meta = {
  title: 'Coach/Roster rows',
  component: ClientRow,
  parameters: { layout: 'padded' },
  args: {
    name: 'Oleh Bondar',
    program: 'Upper/Lower 4×',
    weekLabel: '1 of 4',
    status: 'urgent',
    statusLabel: 'Urgent',
    onClick: () => undefined,
  },
} satisfies Meta<typeof ClientRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every status. The word carries the meaning; "All clear" has no dot. */
export const Statuses: Story = {
  render: () => (
    <div style={{ maxWidth: 560 }}>
      <ClientRow
        name="Oleh Bondar"
        program="Upper/Lower 4×"
        weekLabel="1 of 4"
        status="urgent"
        statusLabel="Urgent"
        onClick={() => undefined}
        selected
      />
      <ClientRow
        name="Sofiia Hnatiuk"
        program="Strength Base 3×"
        weekLabel="1 of 3"
        status="watch"
        statusLabel="Watch"
        onClick={() => undefined}
      />
      <ClientRow
        name="Maria Tkach"
        program="Glute Focus 3×"
        weekLabel="1 of 3"
        status="good"
        statusLabel="Good"
        onClick={() => undefined}
      />
      <ClientRow
        name="Natalia Ostapchuk"
        program="Full Body 3×"
        weekLabel="1 of 3"
        status="none"
        statusLabel="All clear"
        onClick={() => undefined}
      />
    </div>
  ),
};

/** Log mode, signal count, unread count, pending invite (not a button). */
export const WithBadges: Story = {
  render: () => (
    <div style={{ maxWidth: 560 }}>
      <ClientRow
        name="Andriy Lysenko"
        program="Rehab Upper 3×"
        weekLabel="1 of 3"
        status="urgent"
        statusLabel="Urgent"
        signalCount={2}
        signalLabel="2 signals"
        unread={12}
        unreadLabel="12 unread"
        logMode={{ mode: 'hybrid', label: 'Hybrid' }}
        onClick={() => undefined}
      />
      <ClientRow
        name="Maksym Shevchuk"
        program="Hybrid 4×"
        weekLabel="Not logged"
        status="none"
        statusLabel="All clear"
        logMode={{ mode: 'program', label: 'Program only' }}
        onClick={() => undefined}
      />
      <ClientRow
        name="Olena Marchenko"
        program="Invite sent · 6 d left"
        trailing={<small>Pending</small>}
      />
    </div>
  ),
};

export const LogModes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <LogModeBadge mode="app">App</LogModeBadge>
      <LogModeBadge mode="hybrid">Hybrid</LogModeBadge>
      <LogModeBadge mode="program">Program only</LogModeBadge>
    </div>
  ),
};

export const Signals: Story = {
  render: () => (
    <div style={{ maxWidth: 560 }}>
      <SignalListRow
        title="Bench press has not moved in 4 weeks"
        clientName="Oleh Bondar"
        severity="urgent"
        severityLabel="Urgent"
        kindLabel="Stall"
        ageLabel="today"
        selected
        onClick={() => undefined}
      />
      <SignalListRow
        title="Program has an overhead press, but the client restricted overhead work"
        clientName="Andriy Lysenko"
        severity="urgent"
        severityLabel="Urgent"
        kindLabel="Injury"
        ageLabel="yesterday"
        decidedLabel="Decided"
        onClick={() => undefined}
      />
      <SignalListRow
        title="Ready to add weight on hip thrust"
        clientName="Maria Tkach"
        severity="good"
        severityLabel="Good"
        kindLabel="Ready to progress"
        ageLabel="3 days"
        onClick={() => undefined}
      />
    </div>
  ),
};

/** A category that is not shared: lock and a sentence, never a value. */
export const Locked: Story = {
  render: () => (
    <div style={{ maxWidth: 420, display: 'grid', gap: 12 }}>
      <LockedRow>Viktoriia has not shared injuries</LockedRow>
      <StatusLabel status="watch">Watch</StatusLabel>
    </div>
  ),
};
