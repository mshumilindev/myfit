import type { Meta, StoryObj } from '@storybook/react-vite';
import { addonsPref } from '../../addons/enabledSet';
import { PageFrame } from '../../stories/PageFrame';
import { TlEntryRow } from '../../trainLikeAPro/TlEntryRow';
import { CatalogPromoRow } from './CatalogPromoRow';

/**
 * Programs: the "Train like a pro" entry. Before the add-on is installed it is the store-kit banner with the animated
 * icon (a still under reduced motion) and Add; afterwards the quiet row with the still icon opens the catalog.
 */
const meta = {
  title: 'Pages/Programs entry (Train like a pro)',
  component: CatalogPromoRow,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <div className="screen">
          <Story />
        </div>
      </PageFrame>
    ),
  ],
  // Programs shows the entry to a role the store offers it to, with the add-on not installed.
  loaders: [
    () => {
      localStorage.setItem('spotter.role', 'member');
      addonsPref.reset();
      return {};
    },
  ],
} satisfies Meta<typeof CatalogPromoRow>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Not installed: the banner with Add. */
export const Banner: Story = {};

/** Installed: the quiet entry row that opens the catalog. */
export const EntryRow: Story = {
  render: () => <TlEntryRow onOpen={() => undefined} />,
};
