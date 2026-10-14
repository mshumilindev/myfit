import type { Meta, StoryObj } from '@storybook/react-vite';
import { buildFixtureWorld } from '../data/__fixtures__/fixtures';
import { idOf } from '../screens/storyPorts';
import { bareRows, musclesDay, ProgramStoryFrame } from './storyKit';

/** Client 360 > Program tab (S-03): the program the client has now, by weekday, trainer days and versions. */
const meta = {
  title: 'Pages/Coach/Program tab',
  component: ProgramStoryFrame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ProgramStoryFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

const W = buildFixtureWorld();
const at = (name: string) => ({ screen: 'client', cid: idOf(W, name), tab: 'program' }) as const;

/** client360-program */
export const Default: Story = { args: { route: at('Oleh Bondar') } };
export const BareRows: Story = { args: { route: at('Oleh Bondar'), scenario: bareRows } };
export const MusclesDay: Story = { args: { route: at('Oleh Bondar'), scenario: musclesDay } };
export const Loading: Story = { args: { route: at('Oleh Bondar'), delayMs: 60000 } };
export const OtherClient: Story = { args: { route: at('Andriy Lysenko') } };
