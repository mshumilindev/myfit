import { useEffect } from 'react';
import { setAtlasInstalled } from '../atlas/aiConsent';
import { reconcileAtlasConsent, watchAtlasRemoval } from '../atlas/withdrawOnRemove';
import { syncSleepAutoQueue } from '../store';
import { setAllowedThemes } from '../themes/registry';
import { useInstalledThemeIds, useThemesOn } from '../themes/useThemeAccess';
import { migrateModules, useAddonOrBase } from './enabledSet';

/**
 * What the shell reads from the installed add-ons, plus the effects that follow an install or removal (SPO-518):
 * Apex needs no screen without it; Themes needs a second look next to the base one (themes install one by one);
 * Sleep (auto-start is part of it) rebuilds or clears the server night queue; Atlas tells the consent module and
 * withdraws consent on removal.
 */
export function useAddonRuntime() {
  const apexOn = useAddonOrBase('apex');
  const themesOn = useThemesOn();
  const installedThemes = useInstalledThemeIds();
  const sleepOn = useAddonOrBase('sleep');
  const atlasOn = useAddonOrBase('atlas');
  const masteryOn = useAddonOrBase('mastery');
  const healthOn = useAddonOrBase('health');
  const injuryOn = useAddonOrBase('injury-log');
  useEffect(() => migrateModules(), []);
  useEffect(() => syncSleepAutoQueue(), [sleepOn]);
  useEffect(() => setAtlasInstalled(atlasOn), [atlasOn]);
  useEffect(() => watchAtlasRemoval(), []);
  useEffect(() => (atlasOn ? undefined : reconcileAtlasConsent()), [atlasOn]);
  useEffect(() => setAllowedThemes(installedThemes), [installedThemes]);
  return { apexOn, masteryOn, themesOn, sleepOn, atlasOn, healthOn, injuryOn };
}
