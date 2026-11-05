import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkBento } from './SkBento';
import { SkBentoLink, SkBentoTile } from './SkBentoTile';
import { SkBtn } from './SkBtn';

const meta = {
  title: 'Store/SkBentoTile',
  component: SkBentoTile,
  args: { eyebrow: 'Installed', title: 'Starter pack' },
} satisfies Meta<typeof SkBentoTile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <SkStage width="phone">
      <SkBento>
        <SkBentoTile {...args} body="Short description" />
      </SkBento>
    </SkStage>
  ),
};

/** Every surface: white, dark, accent and the ten app colour families. */
export const Surfaces: Story = {
  render: () => (
    <SkStage width="phone">
      <SkBento>
        <SkBentoTile variant="white" eyebrow="White" title="Card" body="Border + card surface" />
        <SkBentoTile variant="dark" eyebrow="Dark" title="Coming soon" body="Nutrition, Music" />
        <SkBentoTile variant="accent" eyebrow="Accent" title="Recovery pack" body="Sleep, Cycle" />
        {Array.from({ length: 10 }, (_, i) => (
          <SkBentoTile key={i} tone={i} eyebrow={`Tone ${i}`} title="App" body="Colour family" />
        ))}
      </SkBento>
    </SkStage>
  ),
};

/** Design 01: hero (app of the week), stat, pack, suggest-wide, soon, clickable browse. */
export const Discover: Story = {
  render: () => (
    <SkStage width="phone">
      <SkBento>
        <SkBentoTile
          tone={2}
          size="hero"
          span={2}
          eyebrow="App of the week"
          aside={<span>App</span>}
          title="Sleep coach"
          onTitle={() => undefined}
          body="Wind-down routine and calm audio."
          footer={<SkBtn kind="inv">Add</SkBtn>}
        />
        <SkBentoTile
          eyebrow="Installed"
          big={7}
          body="apps and add-ons"
          footer={<SkBentoLink onClick={() => undefined}>See all ›</SkBentoLink>}
        />
        <SkBentoTile
          variant="accent"
          eyebrow="Starter pack"
          title="Recovery"
          titleSize="h3"
          body="Sleep, Cycle, Health"
          footer={<SkBtn kind="inv">Add 3</SkBtn>}
        />
        <SkBentoTile size="wide" span={2} eyebrow="Suggested for Sleep" title="Sleep sounds" />
        <SkBentoTile
          variant="dark"
          eyebrow="Coming soon"
          title="Nutrition"
          body="Meals and targets"
        />
        <SkBentoTile
          tone={5}
          eyebrow="Browse"
          title="By goal"
          body="Categories"
          onClick={() => undefined}
          footer={<SkBentoLink>6 categories ›</SkBentoLink>}
        />
      </SkBento>
    </SkStage>
  ),
};

export const LongText: Story = {
  render: () => (
    <SkStage width="phone">
      <SkBento>
        <SkBentoTile
          tone={7}
          span={2}
          size="hero"
          eyebrow="An extremely long eyebrow that wraps"
          title="Averyveryverylongapptitlewithoutanyspaces for the week"
          body="A long description that keeps going to prove the tile grows instead of overflowing its rounded corners."
        />
      </SkBento>
    </SkStage>
  ),
};

export const Wide: Story = {
  render: () => (
    <SkStage width="wide" themes={['light']}>
      <SkBento cols={4}>
        <SkBentoTile tone={1} size="hero" span={2} title="Hero" eyebrow="4 columns" />
        <SkBentoTile eyebrow="Installed" big={12} />
        <SkBentoTile variant="dark" eyebrow="Soon" title="Music" />
      </SkBento>
    </SkStage>
  ),
};
