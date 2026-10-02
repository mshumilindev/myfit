/**
 * The Alcohol pages as one switch: hub, "What I drink", "Usual days" and "Use in
 * calculations". Navigation lives in the caller (Health overlay routes).
 */
import { AlcoholCalcView } from './AlcoholCalcView';
import { AlcoholDaysView } from './AlcoholDaysView';
import { AlcoholHubView, type AlcoholScreen } from './AlcoholHubView';
import { AlcoholProductsView } from './AlcoholProductsView';

export function AlcoholScreens({
  screen,
  onOpen,
  onBack,
}: {
  screen: AlcoholScreen;
  onOpen: (screen: Exclude<AlcoholScreen, 'hub'>) => void;
  onBack: () => void;
}) {
  if (screen === 'products') return <AlcoholProductsView onBack={onBack} />;
  if (screen === 'days') return <AlcoholDaysView onBack={onBack} />;
  if (screen === 'calc') return <AlcoholCalcView onBack={onBack} />;
  return <AlcoholHubView onOpen={onOpen} onBack={onBack} />;
}
