import { loadTracker } from '../trackerRt';
import { useEffect, useMemo } from 'react';
import { setAtlasInstalled } from '../atlas/aiConsent';
import { reconcileAtlasConsentAfter, watchAtlasRemoval } from '../atlas/withdrawOnRemove';
import { useChallenges } from '../challengesState';
import { getStoredUsage, syncSleepAutoQueue, whenAccountLoaded, whenPrefsLoaded } from '../store';
import { getRole } from '../api';
import { auth } from '../firebase';
import { migrateBrassGlass, migrateRoleAddons } from './migrateRoles';
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
  // Challenges are an Apex module: with it off they leave the bell and the launcher count.
  const allChallenges = useChallenges();
  const challengesOn = useAddonOrBase('apex-challenges');
  const ranksOn = useAddonOrBase('apex-ranks');
  const awardsOn = useAddonOrBase('apex-awards');
  const challenges = useMemo(
    () => (challengesOn ? allChallenges : []),
    [challengesOn, allChallenges],
  );
  const alcoholOn = useAddonOrBase('alcohol');
  // The Alcohol modules are a lazy chunk fetched only while the add-on is installed (SPO-500 I8).
  useEffect(() => {
    if (alcoholOn) loadTracker('alcohol', () => import('../alcoholBoot'));
  }, [alcoholOn]);
  const nicotineOn = useAddonOrBase('nicotine');
  useEffect(() => {
    if (nicotineOn) loadTracker('nicotine', () => import('../nicotineBoot'));
  }, [nicotineOn]);
  const supplementsOn = useAddonOrBase('supplements');
  useEffect(() => {
    if (supplementsOn) loadTracker('supplements', () => import('../supplementsBoot'));
  }, [supplementsOn]);
  const cycleOn = useAddonOrBase('cycle');
  useEffect(() => {
    if (cycleOn) loadTracker('cycle', () => import('../cycleBoot'));
  }, [cycleOn]);
  const healthOn = useAddonOrBase('health');
  const injuryOn = useAddonOrBase('injury-log');
  useEffect(() => migrateModules(), []);
  // Existing trainers and admins keep what they had (once their data has loaded; the marker makes it one time).
  useEffect(
    () =>
      whenAccountLoaded(() => {
        const t = auth.currentUser?.metadata.creationTime;
        migrateRoleAddons(getRole(), getStoredUsage(), t ? Date.parse(t) : null);
      }),
    [],
  );
  useEffect(() => whenPrefsLoaded(migrateBrassGlass), []);
  useEffect(() => syncSleepAutoQueue(), [sleepOn]);
  useEffect(() => setAtlasInstalled(atlasOn), [atlasOn]);
  useEffect(() => watchAtlasRemoval(), []);
  useEffect(() => (atlasOn ? undefined : reconcileAtlasConsentAfter(whenPrefsLoaded)), [atlasOn]);
  useEffect(() => setAllowedThemes(installedThemes), [installedThemes]);
  return {
    apexOn,
    masteryOn,
    ranksOn,
    awardsOn,
    challenges,
    themesOn,
    sleepOn,
    atlasOn,
    healthOn,
    injuryOn,
  };
}
