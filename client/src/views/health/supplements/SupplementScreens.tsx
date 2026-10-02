/**
 * The Supplements pages as one switch: hub, "What I take" and "Use in calculations".
 * Navigation lives in the caller (Health overlay routes).
 */
import { SupplementCalcView } from './SupplementCalcView';
import { SupplementHubView, type SupplementScreen } from './SupplementHubView';
import { SupplementProductsView } from './SupplementProductsView';

export function SupplementScreens({
  screen,
  onOpen,
  onBack,
}: {
  screen: SupplementScreen;
  onOpen: (screen: Exclude<SupplementScreen, 'hub'>) => void;
  onBack: () => void;
}) {
  if (screen === 'products') return <SupplementProductsView onBack={onBack} />;
  if (screen === 'calc') return <SupplementCalcView onBack={onBack} />;
  return <SupplementHubView onOpen={onOpen} onBack={onBack} />;
}
