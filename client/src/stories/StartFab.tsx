import { TabBar } from '../components/ui/TabBar';

/**
 * The hub with the Start button turned into a × above an open Start drawer (SPO-470). Every story, preview and test that
 * shows the Start drawer renders this next to it: the × must never be missing from a picture of the open drawer.
 */
export function StartFab({ onClose = () => undefined }: { onClose?: () => void }) {
  return (
    <TabBar
      items={[
        { id: 'today', label: 'Today', icon: 'house', active: true },
        { id: 'overview', label: 'Overview', icon: 'chart-line-up' },
        { id: 'gyms', label: 'Gyms', icon: 'map-pin' },
      ]}
      onSelect={() => undefined}
      apps={{ label: 'Apps', ariaLabel: 'Apps', onClick: () => undefined }}
      fab={{ ariaLabel: 'Start', closeLabel: 'Close', open: true, onClick: onClose }}
    />
  );
}
