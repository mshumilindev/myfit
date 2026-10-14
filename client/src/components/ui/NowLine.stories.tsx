import { useEffect, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { setCoachTimeZone } from '../../coach/format';
import {
  createFixturesSchedulePort,
  scheduleSeedDstDay,
  TODAY_KEY,
} from '../../coach/schedule/__fixtures__/fixtures';
import { ScheduleStoryFrame } from '../../coach/schedule/ScheduleStoryFrame';
import { dayOfTs, tsOf } from '../../coach/schedule/time';
import { NowDivider, NowLine } from './NowLine';

/**
 * The current-time marker of a time grid (Teams style): a thin line across today's column, a dot at its left end and,
 * in the day view, a time chip in the hour gutter. It moves on the minute of the app clock, hides outside the visible
 * hours, and is invisible to assistive tech (one "Now, HH:MM" status is spoken when the view opens and when the hour
 * changes). The kit pieces are `NowLine`, `NowDivider`, `NowStatus`, `useMinuteClock`, `useScrollToNow`; the page
 * stories show them in the real Coach Schedule (fixtures now is Wed 7 Oct 09:05 unless stated).
 */
const meta = {
  title: 'Coach/Now line',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const HOURS = [7, 8, 9, 10, 11, 12, 13];
function Column({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'var(--s-48) minmax(0, 1fr)',
        padding: 'var(--s-16)',
        maxWidth: 'calc(var(--s-48) * 9)',
      }}
    >
      <div aria-hidden="true">
        {HOURS.map((h) => (
          <div key={h} style={{ height: 'var(--s-48)', fontSize: 'var(--fs-12)' }}>
            {String(h).padStart(2, '0')}:00
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'relative',
          height: `calc(var(--s-48) * ${HOURS.length})`,
          borderLeft: 'var(--s-2) solid var(--color-divider)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export const Line: Story = {
  render: () => (
    <Column>
      <NowLine minutes={9 * 60 + 5} from={7 * 60} to={14 * 60} />
    </Column>
  ),
};
export const LineWithChip: Story = {
  render: () => (
    <Column>
      <NowLine minutes={9 * 60 + 5} from={7 * 60} to={14 * 60} label="09:05" />
    </Column>
  ),
};
export const HiddenOutsideRange: Story = {
  name: 'Hidden outside the visible hours',
  render: () => (
    <Column>
      <NowLine minutes={5 * 60 + 30} from={7 * 60} to={14 * 60} label="05:30" />
    </Column>
  ),
};
export const AgendaDivider: Story = {
  render: () => (
    <div style={{ padding: 'var(--s-16)', maxWidth: 'calc(var(--s-48) * 8)' }}>
      <NowDivider label="Now" time="09:05" />
    </div>
  ),
};

/* ---- in the real Coach Schedule ---- */
const frozen = (min: number, day = TODAY_KEY) => {
  const ts = tsOf(day, min);
  return () => createFixturesSchedulePort({ now: () => ts });
};

/** Runs `children` with the Coach zone set (reset to UTC on unmount) so DST days can be shown. */
function Zoned({ tz, children }: { tz: string; children: ReactNode }) {
  useState(() => setCoachTimeZone(tz));
  useEffect(() => () => setCoachTimeZone('UTC'), []);
  return <>{children}</>;
}

export const WeekView: Story = {
  name: 'Coach week view',
  render: () => <ScheduleStoryFrame makePort={frozen(11 * 60 + 20)} hash="#/c/schedule" />,
};
export const DayView: Story = {
  name: 'Coach day view (time chip)',
  render: () => (
    <ScheduleStoryFrame
      makePort={frozen(11 * 60 + 20)}
      hash={`#/c/schedule?view=day&d=${TODAY_KEY}`}
    />
  ),
};
export const PhoneAgenda: Story = {
  name: 'Phone agenda (Now divider)',
  parameters: { viewport: { value: 'phone' } },
  render: () => (
    <ScheduleStoryFrame
      makePort={frozen(11 * 60 + 20)}
      hash={`#/c/schedule?view=day&d=${TODAY_KEY}`}
    />
  ),
};
export const BeforeFirstSession: Story = {
  name: 'Today, nothing done yet',
  render: () => (
    <ScheduleStoryFrame
      makePort={frozen(7 * 60 + 30)}
      hash={`#/c/schedule?view=day&d=${TODAY_KEY}`}
    />
  ),
};
export const NowOutsideHours: Story = {
  name: 'Coach grid, before the visible hours (no line)',
  render: () => (
    <ScheduleStoryFrame
      makePort={frozen(5 * 60 + 30)}
      hash={`#/c/schedule?view=day&d=${TODAY_KEY}`}
    />
  ),
};
export const DifferentDay: Story = {
  name: 'Coach grid, another week (no line)',
  render: () => (
    <ScheduleStoryFrame makePort={frozen(11 * 60 + 20)} hash={`#/c/schedule?d=${TODAY_KEY + 14}`} />
  ),
};

const SPRING = dayOfTs(Date.UTC(2026, 2, 29, 12)); // Warsaw: 02:00 -> 03:00
const AUTUMN = dayOfTs(Date.UTC(2026, 9, 25, 12)); // Warsaw: 03:00 -> 02:00
const inWarsaw = (utc: number, day?: number) => () =>
  createFixturesSchedulePort({
    now: () => utc,
    ...(day === undefined ? {} : { seed: scheduleSeedDstDay(day) }),
  });
export const DstSpringDay: Story = {
  name: 'DST day, clocks go forward (Warsaw 29 Mar, 14:05 local)',
  render: () => (
    <Zoned tz="Europe/Warsaw">
      <ScheduleStoryFrame
        makePort={inWarsaw(Date.UTC(2026, 2, 29, 12, 5), SPRING)}
        hash={`#/c/schedule?view=day&d=${SPRING}`}
      />
    </Zoned>
  ),
};
export const DstAutumnDay: Story = {
  name: 'DST day, clocks go back (Warsaw 25 Oct, 13:05 local)',
  render: () => (
    <Zoned tz="Europe/Warsaw">
      <ScheduleStoryFrame
        makePort={inWarsaw(Date.UTC(2026, 9, 25, 12, 5), AUTUMN)}
        hash={`#/c/schedule?view=day&d=${AUTUMN}`}
      />
    </Zoned>
  ),
};
