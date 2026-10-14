import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  createFixturesSchedulePort,
  scheduleSeedWithGroupMove,
  TODAY_KEY,
  WEEK0,
} from './__fixtures__/fixtures';
import { tsOf } from './time';
import { ScheduleChatFrame, ScheduleStoryFrame } from './ScheduleStoryFrame';
import { SchedulePortError, type SchedulePort } from './port';

/**
 * Schedule (S-12..S-14 plan M6) inside the real shell. Pick the viewport in the toolbar: 1440 / 1024 = time grid with the
 * session drawer (an overlay that never moves the grid; a bottom sheet on a phone), 390 = day strip + agenda. The header
 * pages the calendar (previous / next, the range in words, Today); a click, tap or drag on an empty slot opens the
 * create form (`CreateFromSlot`). The fixtures week is 5-11 Oct 2026, the fixture
 * clock is Wed 7 Oct at 09:05 (stories and tests); the demo build uses `createDemoClock()` instead: the same day with the
 * viewer's real time of day.
 */
const meta = {
  title: 'Pages/Coach/Schedule',
  component: ScheduleStoryFrame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ScheduleStoryFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

const port = () => createFixturesSchedulePort();
const at = (hash: string): Story['args'] => ({ makePort: port, hash });
const group = `r-mob:${WEEK0 + 3}`;

export const Week: Story = { args: at('#/c/schedule') };
export const Day: Story = { args: at(`#/c/schedule?view=day&d=${TODAY_KEY}`) };
export const Month: Story = { args: at('#/c/schedule?view=month') };
export const NextWeek: Story = { args: at(`#/c/schedule?d=${WEEK0 + 7}`) };
export const PreviousWeek: Story = { args: at(`#/c/schedule?d=${WEEK0 - 7}`) };
/** Click an empty slot (here Sunday 13:30, 60 min), or drag for the length: the create form with the day and time filled in. */
export const CreateFromSlot: Story = { args: at(`#/c/schedule?create=${WEEK0 + 6}.810`) };
export const CreateFromDrag: Story = { args: at(`#/c/schedule?create=${WEEK0 + 6}.810.90`) };
/** Wednesday 10:15 is inside Rehab Upper: the overlap is warned about before saving. */
export const CreateOverlap: Story = { args: at(`#/c/schedule?create=${TODAY_KEY}.615`) };
/** The legend chips are filters: here Done and Overlap are switched off (`hide=` in the hash). */
export const LegendFiltered: Story = { args: at('#/c/schedule?hide=done,overlap') };
export const Filtered: Story = { args: at('#/c/schedule?who=c1') };
export const EmptyWeek: Story = { args: at(`#/c/schedule?d=${WEEK0 + 7 * 40}`) };
export const NoSchedule: Story = {
  args: { makePort: () => createFixturesSchedulePort({ empty: true }), hash: '#/c/schedule' },
};
const never: SchedulePort = {
  ...createFixturesSchedulePort(),
  peek: () => null,
  subscribe: () => () => undefined,
};
export const Loading: Story = { args: { makePort: () => never, hash: '#/c/schedule' } };
const failing: SchedulePort = {
  ...createFixturesSchedulePort(),
  peek: () => null,
  subscribe: (_on, onError) => {
    onError(new SchedulePortError('unavailable'));
    return () => undefined;
  },
};
export const LoadFailed: Story = { args: { makePort: () => failing, hash: '#/c/schedule' } };
export const SaveFails: Story = {
  args: {
    makePort: () => createFixturesSchedulePort({ failWrite: () => true }),
    hash: '#/c/schedule?form=oneoff&client=c1',
  },
};

export const InspectorPlain: Story = {
  args: at(`#/c/schedule?open=${encodeURIComponent(`r-c1-fri:${WEEK0 + 4}`)}`),
};
/** A session that is running now (clock 10:15): Mark done / Mark missed in the action bar, "In progress". */
export const InspectorInProgress: Story = {
  args: {
    makePort: () => createFixturesSchedulePort({ now: () => tsOf(TODAY_KEY, 10 * 60 + 15) }),
    hash: `#/c/schedule?open=${encodeURIComponent(`r-c3-wed:${WEEK0 + 2}`)}`,
  },
};
/** The client's move request with Accept / Decline inside the drawer. */
export const InspectorClientRequest: Story = {
  args: at(`#/c/schedule?open=${encodeURIComponent(`r-c1-fri:${WEEK0 + 4}`)}`),
};
export const InspectorGroup: Story = {
  args: at(`#/c/schedule?open=${encodeURIComponent(`${group}`)}`),
};
export const InspectorTrainerAsk: Story = {
  args: at(`#/c/schedule?open=${encodeURIComponent(`r-c2-wed:${WEEK0 + 2}`)}`),
};

export const Builder: Story = { args: at('#/c/schedule?form=plan') };
export const BuilderForClient: Story = { args: at('#/c/schedule?form=plan&client=c1') };
export const OneOff: Story = { args: at('#/c/schedule?form=oneoff') };

export const RescheduleKnown: Story = {
  args: at(`#/c/schedule?form=move&slot=${encodeURIComponent(`r-c1-tue:${WEEK0 + 1}`)}`),
};
export const RescheduleGroup: Story = {
  args: at(`#/c/schedule?form=move&slot=${encodeURIComponent(group)}`),
};
export const RescheduleFromClient: Story = { args: at('#/c/schedule?form=pick&client=c1') };
export const RescheduleFromClientEmpty: Story = { args: at('#/c/schedule?form=pick&client=c13') };
export const RescheduleCounter: Story = { args: at('#/c/schedule?form=counter&req=rq1') };

export const WeekPage: Story = { args: at('#/c/week') };
export const WeekPageNext: Story = { args: at(`#/c/week?d=${WEEK0 + 7}`) };

/* ---- request cards in the chat ---- */
export const ChatIncoming: StoryObj = {
  render: () => (
    <ScheduleChatFrame makePort={port} clientId="c1" reqIds={['rq1']} fromClient={['rq1']} />
  ),
};
export const ChatPending: StoryObj = {
  render: () => <ScheduleChatFrame makePort={port} clientId="c2" reqIds={['rq2']} />,
};
export const ChatAccepted: StoryObj = {
  render: () => (
    <ScheduleChatFrame makePort={port} clientId="c3" reqIds={['rq3']} fromClient={['rq3']} />
  ),
};
export const ChatDeclined: StoryObj = {
  render: () => <ScheduleChatFrame makePort={port} clientId="c14" reqIds={['rq4']} />,
};

const groupMove = () => createFixturesSchedulePort({ seed: scheduleSeedWithGroupMove() });
export const InspectorGroupMove: Story = {
  args: { makePort: groupMove, hash: `#/c/schedule?open=${encodeURIComponent(group)}` },
};
export const ChatGroupPartial: StoryObj = {
  render: () => <ScheduleChatFrame makePort={groupMove} clientId="c2" reqIds={['rq-g-c2']} />,
};
export const ChatGroupPending: StoryObj = {
  render: () => <ScheduleChatFrame makePort={groupMove} clientId="c5" reqIds={['rq-g-c5']} />,
};
export const ChatGroupDeclined: StoryObj = {
  render: () => <ScheduleChatFrame makePort={groupMove} clientId="c10" reqIds={['rq-g-c10']} />,
};

/** Calendar settings drawer: working hours per weekday, "My gyms" (one runs 24/7) and the range mode Auto / Work hours / 24 h. */
export const CalendarSettings: Story = { args: at('#/c/schedule?form=settings') };
/** Add sessions drawer: kit controls only, sticky footer with Cancel / Add; warns when a time is outside the working or gym hours. */
export const AddSessions: Story = { args: at('#/c/schedule?form=plan') };
