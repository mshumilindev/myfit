/**
 * The Nicotine pages as one switch: hub, "What I use" and "Use in calculations". Navigation lives in the caller (Health overlay routes).
 */
import { NicotineCalcView } from './NicotineCalcView';
import { NicotineHubView, type NicotineScreen } from './NicotineHubView';
import { NicotineProductsView } from './NicotineProductsView';

export function NicotineScreens({
  screen,
  onOpen,
  onBack,
}: {
  screen: NicotineScreen;
  onOpen: (screen: Exclude<NicotineScreen, 'hub'>) => void;
  onBack: () => void;
}) {
  if (screen === 'products') return <NicotineProductsView onBack={onBack} />;
  if (screen === 'calc') return <NicotineCalcView onBack={onBack} />;
  return <NicotineHubView onOpen={onOpen} onBack={onBack} />;
}
