import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkBar } from './SkBar';
import { SkBtn } from './SkBtn';
import { SkHeader } from './SkHeader';
import { SkNavItem } from './SkNavItem';
import { SkShell } from './SkShell';
import { SkSidebar, SkSidebarUser } from './SkSidebar';
import { SkTabBar } from './SkTabBar';
import { SkTray } from './SkTray';
import './SkShell.stories.css';

const icon = (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden="true"
  >
    <rect x="4" y="4" width="16" height="16" rx="4" />
  </svg>
);
const avatar = (
  <button type="button" className="sk-av sk-avbtn" aria-label="Profile">
    AK
  </button>
);
const NAMES = ['Discover', 'Apps', 'Add-ons', 'Selected', 'Installed'];

const sidebar = (
  <SkSidebar
    title="Add-ons"
    label="Store sections"
    back={<SkNavItem icon={icon} label="Back to Spotter" />}
    user={<SkSidebarUser avatar={avatar} name="Alex" role="member" />}
  >
    {NAMES.map((n, i) => (
      <SkNavItem key={n} icon={icon} label={n} active={i === 0} count={i === 3 ? 3 : undefined} />
    ))}
  </SkSidebar>
);
const header = (
  <SkHeader
    title="Discover"
    avatar={avatar}
    onExit={() => {}}
    exitLabel="Back to Spotter"
    exitIcon={icon}
  />
);
const tabBar = (
  <SkTabBar
    label="Store sections"
    active="discover"
    onSelect={() => {}}
    tabs={NAMES.map((n, i) => ({ id: n, label: n, icon, dot: i === 3 }))}
  />
);
const tray = <SkTray label="3 selected" actionLabel="Review" onAction={() => {}} />;
const content = (
  <div className="sk-col sk-g12">
    {Array.from({ length: 12 }, (_, i) => (
      <div key={i} className="sk-card sk-p16">
        Content block {i + 1}
      </div>
    ))}
  </div>
);

const meta = {
  title: 'Store/SkShell',
  component: SkShell,
  args: { children: content },
} satisfies Meta<typeof SkShell>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Narrow container: header, scroll area, tab bar, tray above the tab bar. */
export const Mobile: Story = {
  render: (args) => (
    <SkStage width="phone">
      <div className="sk-shl-frame sk-shl-frame-phone">
        <SkShell {...args} sidebar={sidebar} header={header} tabBar={tabBar} tray={tray} />
      </div>
    </SkStage>
  ),
};

/** Wide container: sidebar, no header or tab bar, narrow right-aligned tray. */
export const Desktop: Story = {
  render: (args) => (
    <SkStage width="wide" themes={['light']}>
      <div className="sk-shl-frame">
        <SkShell {...args} sidebar={sidebar} header={header} tabBar={tabBar} tray={tray} />
      </div>
    </SkStage>
  ),
};

/** Detail screen: the action bar replaces the tab bar. */
export const DetailWithBar: Story = {
  render: (args) => (
    <SkStage width="phone">
      <div className="sk-shl-frame sk-shl-frame-phone">
        <SkShell
          {...args}
          header={<SkHeader onBack={() => {}} backLabel="Back" avatar={avatar} />}
          tabBar={tabBar}
          bar={
            <SkBar>
              <SkBtn kind="pri" size="l">
                Add
              </SkBtn>
            </SkBar>
          }
        />
      </div>
    </SkStage>
  ),
};

export const NoTray: Story = {
  render: (args) => (
    <SkStage width="phone">
      <div className="sk-shl-frame sk-shl-frame-phone">
        <SkShell {...args} header={header} tabBar={tabBar} />
      </div>
    </SkStage>
  ),
};
