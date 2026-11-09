import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThemeSwatch, ThemeSwatchGrid } from './ThemeSwatch';
import { LocaleMatrix, Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/ThemeSwatch',
  component: ThemeSwatch,
  args: {
    name: 'Titanium',
    light: '#2b3640',
    dark: '#dbe4ec',
    lightLabel: 'L',
    darkLabel: 'D',
    selected: false,
    onSelect: () => undefined,
  },
} satisfies Meta<typeof ThemeSwatch>;
export default meta;
type Story = StoryObj<typeof meta>;

const COLOURS = [
  ['Titanium', '#2b3640', '#dbe4ec'],
  ['Lime', '#9bd600', '#c8ff2e'],
  ['Crimson', '#c8102e', '#ff4560'],
  ['Fuchsia', '#d4007f', '#ff2daa'],
  ['Amber', '#9e5a00', '#ffb020'],
  ['Olive', '#5f6b2f', '#a9b36b'],
  ['Tiffany', '#0abab5', '#0abab5'],
  ['Indigo', '#4a55d0', '#8e98ff'],
  ['Deep Purple', '#594f63', '#b3a2c4'],
] as const;

function Live({ width }: { width: number }) {
  const [sel, setSel] = useState('Titanium');
  return (
    <div style={{ width }}>
      <ThemeSwatchGrid label="Accent colour">
        {COLOURS.map(([name, light, dark]) => (
          <ThemeSwatch
            key={name}
            name={name}
            light={light}
            dark={dark}
            lightLabel="L"
            darkLabel="D"
            selected={sel === name}
            onSelect={() => setSel(name)}
          />
        ))}
      </ThemeSwatchGrid>
    </div>
  );
}

export const Playground: Story = {};

/** Not selected / selected. */
export const States: Story = {
  render: () => (
    <Stack width={358}>
      <ThemeSwatchGrid label="States">
        <ThemeSwatch
          name="Lime"
          light="#9bd600"
          dark="#c8ff2e"
          lightLabel="L"
          darkLabel="D"
          selected={false}
          onSelect={() => undefined}
        />
        <ThemeSwatch
          name="Lime"
          light="#9bd600"
          dark="#c8ff2e"
          lightLabel="L"
          darkLabel="D"
          selected
          onSelect={() => undefined}
        />
      </ThemeSwatchGrid>
    </Stack>
  ),
};

/** All nine colours as a phone grid (3 columns); pick one. */
export const PhoneGrid: Story = { render: () => <Live width={358} /> };

/** The desktop grid (4 columns from 720px). */
export const DesktopGrid: Story = {
  parameters: { viewport: { defaultViewport: 'desktop' } },
  render: () => <Live width={760} />,
};

/** Long colour names must ellipsise, never push the card wider. */
export const LongName: Story = {
  render: () => (
    <Stack width={358}>
      <ThemeSwatchGrid label="Long">
        <ThemeSwatch
          name="Deep Purple Metallic Pro"
          light="#594f63"
          dark="#b3a2c4"
          lightLabel="L"
          darkLabel="D"
          selected
          onSelect={() => undefined}
        />
        <ThemeSwatch
          name="Тіффані"
          light="#0abab5"
          dark="#0abab5"
          lightLabel="Д"
          darkLabel="Н"
          selected={false}
          onSelect={() => undefined}
        />
        <ThemeSwatch
          name="Багряний"
          light="#c8102e"
          dark="#ff4560"
          lightLabel="Д"
          darkLabel="Н"
          selected={false}
          onSelect={() => undefined}
        />
      </ThemeSwatchGrid>
    </Stack>
  ),
};

/** Same cards with each locale's day/night letters. */
export const Locales: Story = {
  render: () => (
    <LocaleMatrix
      render={(_t, id) => (
        <ThemeSwatchGrid label={id}>
          <ThemeSwatch
            name="Lime"
            light="#9bd600"
            dark="#c8ff2e"
            lightLabel={id === 'uk' ? 'Д' : 'L'}
            darkLabel={id === 'uk' ? 'Н' : 'D'}
            selected
            onSelect={() => undefined}
          />
          <ThemeSwatch
            name="Indigo"
            light="#4a55d0"
            dark="#8e98ff"
            lightLabel={id === 'uk' ? 'Д' : 'L'}
            darkLabel={id === 'uk' ? 'Н' : 'D'}
            selected={false}
            onSelect={() => undefined}
          />
        </ThemeSwatchGrid>
      )}
    />
  ),
};
