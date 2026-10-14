import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, IconButton } from './Button';
import { Chip } from './Chip';
import { ExportMenu } from './ExportMenu';
import { EXPORT_STRINGS } from './ExportMenu.stories';
import { Field } from './Field';
import { PresetChips } from './PresetChips';
import { ScrollTabs } from './ScrollTabs';
import { SearchField } from './SearchField';
import { Segmented } from './Segmented';
import { Select } from './Select';
import { TimeField } from './TimeField';

/**
 * Every kit control at every step of the control scale (styles.css --ctl-h-xs/sm/md/lg), side by side on one
 * baseline. Within a row the heights must be identical — this story is the acceptance surface for the scale and
 * the one to open after changing a --ctl-* token.
 */
const meta = {
  title: 'Kit/ControlHeights',
  parameters: { layout: 'padded' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => undefined;
type Step = 'sm' | 'md' | 'lg';
const STEPS: Step[] = ['sm', 'md', 'lg'];

function Row({ step }: { step: Step }) {
  return (
    <div className="ctl-row" style={{ alignItems: 'center' }} data-step={step}>
      <code style={{ width: 28 }}>{step}</code>
      <IconButton icon="gear" label="Settings" variant="secondary" size={step} />
      <Button size={step} variant="secondary" icon="plus">
        Secondary
      </Button>
      <Button size={step}>Primary</Button>
      <Button size={step} variant="ghost">
        Ghost
      </Button>
      <Segmented
        label="View"
        size={step}
        value="week"
        onChange={noop}
        options={[
          { value: 'week', label: 'Week' },
          { value: 'day', label: 'Day' },
        ]}
      />
      <Select aria-label="Gym" size={step} defaultValue="">
        <option value="">All gyms</option>
      </Select>
      <Field aria-label="Name" size={step} placeholder="Field" />
      <TimeField aria-label="Time" size={step} defaultValue="09:00" />
      <SearchField size={step} value="" onChange={noop} placeholder="Search" clearLabel="Clear" />
      <Chip size={step} onClick={noop}>
        Chip
      </Chip>
      <ExportMenu
        size={step}
        strings={EXPORT_STRINGS}
        rows={3}
        columns={['Date']}
        onExport={() => 'ok'}
      />
    </div>
  );
}

/** sm 36 / md 44 / lg 52: one row per step, all controls the same height. */
export const AllControls: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 24 }}>
      {STEPS.map((s) => (
        <Row key={s} step={s} />
      ))}
    </div>
  ),
};

/** The dense step (28) is for chips and preset chips inside running content. */
export const DenseXs: Story = {
  render: () => (
    <div className="ctl-row">
      <Chip size="xs" onClick={noop}>
        Chip xs
      </Chip>
      <PresetChips
        size="xs"
        items={[
          { id: 'a', label: 'Today', selected: true, onClick: noop },
          { id: 'b', label: 'Tomorrow', selected: false, onClick: noop },
        ]}
      />
    </div>
  ),
};

/** Tabs take the md step (underline tabs). */
export const Tabs: Story = {
  render: () => (
    <ScrollTabs
      label="Sections"
      value="a"
      onChange={noop}
      tabs={[
        { id: 'a', label: 'Overview' },
        { id: 'b', label: 'Workouts' },
      ]}
    />
  ),
};
