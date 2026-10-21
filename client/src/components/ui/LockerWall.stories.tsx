import type { Meta, StoryObj } from '@storybook/react-vite';
import { LockerWall } from './LockerWall';

const names = [
  'Mykola Lukianov',
  'Anna Koval',
  'Dmytro Shevchenko',
  'Iryna Petrenko',
  'Oleh Bondar',
  'Marek Nowak',
];
const some = (n: number) => names.slice(0, n).map((name, i) => ({ id: String(i), name }));

const meta = {
  title: 'Kit/LockerWall',
  component: LockerWall,
  args: {
    people: some(4),
    activeId: '0',
    label: 'People on this device',
    lockerLabel: (n: string, i: number) => `${n}, locker ${i + 1}`,
    onSelect: () => undefined,
  },
} satisfies Meta<typeof LockerWall>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const One: Story = { args: { people: some(1) } };
export const Two: Story = { args: { people: some(2), activeId: '1' } };
export const Five: Story = { args: { people: some(5) } };
/** Six wrap onto a second row on a narrow panel. */
export const Six: Story = { args: { people: some(6) } };
/** The person who tapped: the door opens while the device asks for Face ID or the password. */
export const OpenLocker: Story = {
  args: { people: some(4), activeId: '1', openId: '1', openLabel: 'Open' },
};
/** Signing in (Face ID or password in flight): a ring turns around the avatar and the other lockers are disabled. */
export const Busy: Story = {
  args: { people: some(4), activeId: '1', openId: '1', busyId: '1', busyLabel: 'Signing in…' },
};
