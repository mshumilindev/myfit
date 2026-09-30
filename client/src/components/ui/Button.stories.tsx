import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, IconButton, type ButtonVariant } from './Button';
import { LocaleMatrix, Row, Stack } from '../../stories/LocaleMatrix';

const VARIANTS: ButtonVariant[] = [
  'primary',
  'secondary',
  'ghost',
  'danger',
  'rest',
  'fill',
  'sleep',
  'sleep-fill',
  'link',
];

const meta = {
  title: 'Kit/Button',
  component: Button,
  args: { children: 'Start workout', variant: 'primary', size: 'md' },
  argTypes: { variant: { control: 'select', options: VARIANTS } },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** All variants: default, disabled, loading. */
export const Variants: Story = {
  render: () => (
    <Stack>
      {[false, true].map((disabled) => (
        <Row key={String(disabled)}>
          {VARIANTS.map((v) => (
            <Button key={v} variant={v} disabled={disabled}>
              {disabled ? `${v} · disabled` : v}
            </Button>
          ))}
        </Row>
      ))}
      <Row>
        {VARIANTS.map((v) => (
          <Button key={v} variant={v} loading>
            {v}
          </Button>
        ))}
      </Row>
    </Stack>
  ),
};

/** Sizes, icons, full width. */
export const SizesAndIcons: Story = {
  render: () => (
    <Stack width={358}>
      <Row>
        <Button size="sm">sm</Button>
        <Button size="md">md</Button>
        <Button size="lg">lg</Button>
      </Row>
      <Row>
        <Button icon="target">Leading icon</Button>
        <Button iconTrailing="arrow-right">Trailing icon</Button>
      </Row>
      <Button variant="fill" fullWidth icon="check">
        Full width
      </Button>
    </Stack>
  ),
};

/** Icon-only buttons (label is the accessible name). */
export const IconButtons: Story = {
  render: () => (
    <Row>
      <IconButton label="Close" icon="x" />
      <IconButton label="Edit" icon="pencil-simple" variant="secondary" />
      <IconButton label="Add" icon="plus" variant="primary" />
      <IconButton label="Confirm" icon="check" variant="fill" />
      <IconButton label="Disabled" icon="x" disabled />
    </Row>
  ),
};

/** Long labels in five locales. */
export const LongText: Story = {
  render: () => (
    <LocaleMatrix
      render={(t) => (
        <Row>
          <Button variant="secondary">{t.cancel}</Button>
          <Button variant="fill">{t.hlSaveChanges}</Button>
        </Row>
      )}
    />
  ),
};
