import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkNavItem } from './SkNavItem';
import { SkSidebar, SkSidebarUser } from './SkSidebar';

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

const meta = {
  title: 'Store/SkSidebar',
  component: SkSidebar,
  args: { title: 'Add-ons', label: 'Store sections', children: null },
} satisfies Meta<typeof SkSidebar>;
export default meta;
type Story = StoryObj<typeof meta>;

const items = (active: string) => (
  <>
    {['Discover', 'Apps', 'Add-ons'].map((l) => (
      <SkNavItem key={l} icon={icon} label={l} active={active === l} />
    ))}
    <SkNavItem icon={icon} label="Selected" count={3} active={active === 'Selected'} />
    <SkNavItem icon={icon} label="Installed" count={12} active={active === 'Installed'} />
  </>
);

export const Default: Story = {
  render: (args) => (
    <SkStage>
      <div className="sk-sdb-demo">
        <SkSidebar
          {...args}
          back={<SkNavItem icon={icon} label="Back to Spotter" />}
          user={<SkSidebarUser avatar={avatar} name="Alex Kowalski" role="member" />}
        >
          {items('Discover')}
        </SkSidebar>
      </div>
    </SkStage>
  ),
};

export const SelectedAndLongName: Story = {
  render: (args) => (
    <SkStage>
      <div className="sk-sdb-demo">
        <SkSidebar
          {...args}
          back={<SkNavItem icon={icon} label="Back to Spotter" />}
          user={
            <SkSidebarUser
              avatar={avatar}
              name="Alexandra-Maria Kowalska-Wiśniewska"
              role="trainer"
            />
          }
        >
          {items('Selected')}
        </SkSidebar>
      </div>
    </SkStage>
  ),
};
