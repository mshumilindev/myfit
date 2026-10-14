import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, IconButton } from './Button';
import { Chip } from './Chip';
import { ControlRow } from './ControlRow';
import { SearchField } from './SearchField';
import { Segmented } from './Segmented';
import { Select } from './Select';

/** One row, one height: every control inside takes the row's step of the control scale, whatever size prop it has. */
const meta = {
  title: 'Kit/ControlRow',
  component: ControlRow,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ControlRow>;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => undefined;

function Members() {
  return (
    <>
      <IconButton icon="caret-left" variant="secondary" label="Previous" />
      <Button variant="secondary" size="sm">
        Today
      </Button>
      <Segmented
        label="View"
        value="week"
        onChange={noop}
        size="lg"
        options={[
          { value: 'week', label: 'Week' },
          { value: 'day', label: 'Day' },
          { value: 'month', label: 'Month' },
        ]}
      />
      <Select aria-label="Gym" defaultValue="">
        <option value="">All gyms</option>
      </Select>
      <SearchField value="" onChange={noop} placeholder="Search" clearLabel="Clear" />
      <Chip onClick={noop}>Filter</Chip>
      <Button icon="plus">Add</Button>
    </>
  );
}

/** Members are given sm / lg / default on purpose; the row's md wins. */
export const Medium: Story = {
  render: () => (
    <ControlRow size="md">
      <Members />
    </ControlRow>
  ),
};
export const Small: Story = {
  render: () => (
    <ControlRow size="sm">
      <Members />
    </ControlRow>
  ),
};
export const Large: Story = {
  render: () => (
    <ControlRow size="lg">
      <Members />
    </ControlRow>
  ),
};
