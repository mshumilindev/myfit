import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { GroupedList, ListPanel, ListRow } from './GroupedList';
import { IconTile } from './IconTile';
import { Switch } from './Switch';
import { ToneText } from './ToneText';
import { PresetChips } from './PresetChips';
import { LocaleMatrix, Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/GroupedList',
  component: GroupedList,
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
  args: { children: null },
} satisfies Meta<typeof GroupedList>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Header, rows with icon / sub / value / chevron, footer. */
export const Default: Story = {
  render: () => (
    <GroupedList header="Sleep" footer="Nights, backfill a night, your usual schedule.">
      <ListRow
        icon={<IconTile tone="sleep" icon="moon-stars" />}
        label="Last night"
        sub="23:10–06:52"
        value="7 h 42 m"
        chevron
        onClick={() => undefined}
      />
      <ListRow
        icon={<IconTile tone="sleep" icon="clock" />}
        label={
          <ToneText tone="sleep" strong>
            Start sleep
          </ToneText>
        }
        onClick={() => undefined}
      />
      <ListRow
        icon={<IconTile tone="sleep" icon="calendar-blank" />}
        label="Sleep details & schedule"
        sub="Nights, backfill a night, your usual schedule"
        chevron
        onClick={() => undefined}
      />
    </GroupedList>
  ),
};

/** Every row state: static, button, selected, dim, disabled, toned value, action rows. */
export const RowStates: Story = {
  render: () => (
    <Stack gap={24}>
      <GroupedList header="States">
        <ListRow
          icon={<IconTile tone="neutral" icon="shield-check" />}
          label="Static row"
          value="Value"
        />
        <ListRow
          icon={<IconTile tone="illness" icon="thermometer-simple" />}
          label="Toned strong value"
          sub="Since Thu 24 Sep · no end date"
          value="Day 3"
          valueTone="illness"
          valueStrong
          chevron
          onClick={() => undefined}
        />
        <ListRow
          icon={<IconTile tone="rest" icon="bed" />}
          label="Selected (web panel open)"
          selected
          aria-current="true"
          chevron
          onClick={() => undefined}
        />
        <ListRow
          icon={<IconTile tone="illness" icon="thermometer-simple" />}
          label="Dim"
          value="Active"
          dim
        />
        <ListRow
          icon={<IconTile tone="sleep" icon="clock" />}
          label="Disabled button row"
          disabled
          onClick={() => undefined}
        />
        <ListRow action tone="illness" label="I'm recovered" onClick={() => undefined} />
        <ListRow action tone="danger" label="Delete period" onClick={() => undefined} />
      </GroupedList>
      <GroupedList header="Error footer" footer="Can’t end before it starts." footerError>
        <ListRow label="Started" value="Sat 12 Sep" onClick={() => undefined} />
      </GroupedList>
    </Stack>
  ),
};

function Choices() {
  const [pick, setPick] = useState('keep');
  const [on, setOn] = useState(true);
  const [part, setPart] = useState('knee');
  return (
    <Stack gap={24}>
      <GroupedList header="Overlap · 1 workout" footer="Unwell 12–13 and 15–18 Sep.">
        <ListRow
          label="Keep that session"
          sub="The illness skips 14 Sep"
          check={pick === 'keep'}
          checkTone="illness"
          aria-pressed={pick === 'keep'}
          onClick={() => setPick('keep')}
        />
        <ListRow
          label="Remove the session"
          sub="Count 14 Sep as a sick day"
          check={pick === 'remove'}
          checkTone="illness"
          aria-pressed={pick === 'remove'}
          onClick={() => setPick('remove')}
        />
      </GroupedList>
      <GroupedList header="Dates">
        <ListRow
          as="label"
          label="Still ongoing"
          sub="No end date"
          trailing={<Switch checked={on} onChange={setOn} tone="illness" />}
        />
        <ListRow
          label="Body part"
          value="Knee"
          valueTone="injury"
          valueStrong
          aria-expanded
          onClick={() => undefined}
        />
        <ListPanel>
          <PresetChips
            tone="injury"
            items={['knee', 'ankle', 'shoulder', 'lower back', 'wrist'].map((p) => ({
              id: p,
              label: p,
              selected: part === p,
              onClick: () => setPart(p),
            }))}
          />
        </ListPanel>
      </GroupedList>
    </Stack>
  );
}

/** Checkmark choices, a switch row and an expanded ListPanel. */
export const ChoicesAndPanels: Story = { render: () => <Choices /> };

/** Raised surface (inside a sheet / panel). */
export const Raised: Story = {
  decorators: [
    (Story) => (
      <div style={{ background: 'var(--color-surface)', padding: 16, borderRadius: 20 }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <GroupedList surface="raised">
      <ListRow icon={<IconTile icon="shield-check" />} label="Streak" value="Kept" />
      <ListRow icon={<IconTile icon="clock" />} label="Program" value="Resumes today" />
    </GroupedList>
  ),
};

/** Long strings in all five locales. */
export const LongText: Story = {
  render: () => (
    <LocaleMatrix
      render={(t) => (
        <GroupedList header={t.hlLogPast} footer={t.hlLogPastNote}>
          <ListRow
            icon={<IconTile tone="rest" icon="bed" />}
            label={t.hlTookBreak}
            sub={t.hlTookBreakSub}
            value={t.hlListTimeline}
            chevron
            onClick={() => undefined}
          />
        </GroupedList>
      )}
    />
  ),
};
